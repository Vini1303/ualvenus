/**
 * Camada de dados.
 *
 * - Produtos: lidos de data/products.json (catálogo versionado no Git).
 * - Carrinhos, pedidos e estoque vendido: Postgres (DATABASE_URL).
 *   Estoque disponível = estoque do products.json - vendido (tabela stock_sold),
 *   assim o catálogo pode ser redeployado sem perder as vendas.
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { Pool } = require("pg");

const PRODUCTS_FILE = path.join(__dirname, "..", "data", "products.json");
const PRODUCTS = JSON.parse(fs.readFileSync(PRODUCTS_FILE, "utf-8"));

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL && process.env.NODE_ENV !== "test") {
  console.error("DATABASE_URL não definida. Configure a URL do Postgres (ver .env.example).");
  process.exit(1);
}

// Render: a URL externa (…render.com) exige SSL; a interna não.
const useSsl = /render\.com|sslmode=require/.test(DATABASE_URL || "");
let pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: useSsl ? { rejectUnauthorized: false } : false,
});

// Permite trocar o pool em testes.
function _setPool(p) {
  pool = p;
}

async function init() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS carts (
      id TEXT PRIMARY KEY,
      data JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      status TEXT NOT NULL,
      data JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS stock_sold (
      product_id TEXT NOT NULL,
      size TEXT NOT NULL,
      sold INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (product_id, size)
    );
  `);
}

// ---------- Produtos ----------

async function soldMap() {
  const { rows } = await pool.query("SELECT product_id, size, sold FROM stock_sold");
  const map = new Map();
  rows.forEach((r) => map.set(`${r.product_id}|${r.size}`, r.sold));
  return map;
}

function withStock(product, sold) {
  if (!product.stock) return product;
  const stock = {};
  for (const [size, qty] of Object.entries(product.stock)) {
    stock[size] = Math.max(0, qty - (sold.get(`${product.id}|${size}`) || 0));
  }
  return { ...product, stock };
}

async function getProducts({ category } = {}) {
  const sold = await soldMap();
  let products = PRODUCTS.filter((p) => p.published !== false);
  if (category) {
    products = products.filter((p) => p.category.toLowerCase() === category.toLowerCase());
  }
  return products.map((p) => withStock(p, sold));
}

async function getProductBySlug(slug) {
  const product = PRODUCTS.find((p) => p.published !== false && p.slug === slug);
  return product ? withStock(product, await soldMap()) : null;
}

async function getProductById(id) {
  const product = PRODUCTS.find((p) => p.id === id);
  return product ? withStock(product, await soldMap()) : null;
}

async function getCategories() {
  const set = new Set(PRODUCTS.filter((p) => p.published !== false).map((p) => p.category));
  return Array.from(set).sort();
}

// ---------- Carrinho ----------
// Fica salvo no servidor, identificado por um cart_id em cookie httpOnly,
// para validar estoque/preço de verdade no checkout.

async function createCart() {
  const cart = { id: crypto.randomUUID(), items: [], created_at: new Date().toISOString() };
  await pool.query("INSERT INTO carts (id, data) VALUES ($1, $2)", [cart.id, JSON.stringify(cart)]);
  return cart;
}

async function getCart(cartId) {
  const { rows } = await pool.query("SELECT data FROM carts WHERE id = $1", [cartId]);
  return rows[0] ? rows[0].data : null;
}

async function saveCart(cart) {
  cart.updated_at = new Date().toISOString();
  await pool.query(
    `INSERT INTO carts (id, data, updated_at) VALUES ($1, $2, now())
     ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`,
    [cart.id, JSON.stringify(cart)]
  );
  return cart;
}

async function addCartItem(cartId, { productId, size, color, qty }) {
  const cart = (await getCart(cartId)) || (await createCart());
  const product = await getProductById(productId);
  if (!product) throw new Error("Produto não encontrado");
  if (!Number.isInteger(qty) || qty <= 0) throw new Error("Quantidade inválida");

  const stockAvailable = product.stock?.[size] ?? 0;
  const existing = cart.items.find(
    (i) => i.productId === productId && i.size === size && i.color === color
  );
  const currentQtyInCart = existing ? existing.qty : 0;

  if (currentQtyInCart + qty > stockAvailable) {
    throw new Error(`Estoque insuficiente para o tamanho ${size}. Disponível: ${stockAvailable}`);
  }

  if (existing) {
    existing.qty += qty;
  } else {
    cart.items.push({
      productId,
      name: product.name,
      slug: product.slug,
      image: product.image,
      size,
      color: color || null,
      qty,
      unitPrice: product.price,
    });
  }
  return saveCart(cart);
}

async function updateCartItem(cartId, { productId, size, color, qty }) {
  const cart = await getCart(cartId);
  if (!cart) throw new Error("Carrinho não encontrado");

  const item = cart.items.find(
    (i) => i.productId === productId && i.size === size && i.color === color
  );
  if (!item) throw new Error("Item não encontrado no carrinho");

  if (qty <= 0) {
    cart.items = cart.items.filter((i) => i !== item);
  } else {
    const product = await getProductById(productId);
    const stockAvailable = product?.stock?.[size] ?? 0;
    if (qty > stockAvailable) {
      throw new Error(`Estoque insuficiente para o tamanho ${size}. Disponível: ${stockAvailable}`);
    }
    item.qty = qty;
  }
  return saveCart(cart);
}

async function removeCartItem(cartId, { productId, size, color }) {
  const cart = await getCart(cartId);
  if (!cart) throw new Error("Carrinho não encontrado");
  cart.items = cart.items.filter(
    (i) => !(i.productId === productId && i.size === size && i.color === color)
  );
  return saveCart(cart);
}

function cartSubtotal(cart) {
  return cart.items.reduce((sum, i) => sum + i.unitPrice * i.qty, 0);
}

// ---------- Pedidos ----------

function generateOrderNumber() {
  const n = crypto.randomInt(100000, 1000000);
  return `DI-${n}`;
}

async function createOrder({ cart, customer, address, shipping, paymentMethod }) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Baixa de estoque atômica: só incrementa "vendido" se ainda houver saldo.
    for (const item of cart.items) {
      const product = PRODUCTS.find((p) => p.id === item.productId);
      const base = product?.stock?.[item.size] ?? 0;
      const { rowCount } = await client.query(
        `INSERT INTO stock_sold (product_id, size, sold)
         SELECT $1::text, $2::text, $3::int WHERE $4::int >= $3::int
         ON CONFLICT (product_id, size)
         DO UPDATE SET sold = stock_sold.sold + $3::int
         WHERE $4::int - stock_sold.sold >= $3::int`,
        [item.productId, item.size, item.qty, base]
      );
      if (!rowCount) {
        throw new Error(`Estoque insuficiente para ${item.name} (tam. ${item.size}). Atualize o carrinho.`);
      }
    }

    const subtotal = cartSubtotal(cart);
    const order = {
      items: cart.items,
      customer,
      address,
      shipping,
      subtotal,
      total: subtotal + (shipping?.cost || 0),
      paymentMethod,
      status: "aguardando_pagamento",
      created_at: new Date().toISOString(),
    };

    // Número aleatório: em caso (raro) de colisão, sorteia outro.
    for (let attempt = 0; ; attempt++) {
      order.id = generateOrderNumber();
      const { rowCount } = await client.query(
        "INSERT INTO orders (id, status, data) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING",
        [order.id, order.status, JSON.stringify(order)]
      );
      if (rowCount) break;
      if (attempt >= 5) throw new Error("Não foi possível gerar o número do pedido");
    }

    await client.query("COMMIT");

    // Esvazia o carrinho depois de virar pedido
    cart.items = [];
    await saveCart(cart);
    return order;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

async function getOrder(orderNumber) {
  const { rows } = await pool.query("SELECT status, data FROM orders WHERE id = $1", [orderNumber]);
  return rows[0] ? { ...rows[0].data, status: rows[0].status } : null;
}

async function listOrders({ status, limit = 100 } = {}) {
  const params = [];
  let where = "";
  if (status) {
    params.push(status);
    where = "WHERE status = $1";
  }
  params.push(limit);
  const { rows } = await pool.query(
    `SELECT status, data FROM orders ${where} ORDER BY created_at DESC LIMIT $${params.length}`,
    params
  );
  return rows.map((r) => ({ ...r.data, status: r.status }));
}

// Cancelar devolve o estoque reservado pelo pedido.
// `onlyIfStatus`: só muda se o pedido ainda estiver nesse status (evita
// cancelar um pedido que foi pago no meio do caminho).
async function updateOrderStatus(orderNumber, status, { onlyIfStatus } = {}) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query("SELECT status, data FROM orders WHERE id = $1 FOR UPDATE", [
      orderNumber,
    ]);
    if (!rows[0]) {
      await client.query("ROLLBACK");
      return null;
    }
    const previous = rows[0].status;
    if (onlyIfStatus && previous !== onlyIfStatus) {
      await client.query("ROLLBACK");
      return null;
    }
    if (status === "cancelado" && previous !== "cancelado") {
      for (const item of rows[0].data.items) {
        await client.query(
          "UPDATE stock_sold SET sold = GREATEST(0, sold - $3::int) WHERE product_id = $1 AND size = $2",
          [item.productId, item.size, item.qty]
        );
      }
    }
    const data = { ...rows[0].data, status };
    await client.query("UPDATE orders SET status = $2, data = $3 WHERE id = $1", [
      orderNumber,
      status,
      JSON.stringify(data),
    ]);
    await client.query("COMMIT");
    return data;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

// Cancela pedidos sem pagamento após `hours` horas e devolve o estoque.
async function cancelExpiredOrders(hours = 2) {
  const { rows } = await pool.query(
    `SELECT id FROM orders
     WHERE status = 'aguardando_pagamento' AND created_at < $1`,
    [new Date(Date.now() - hours * 60 * 60 * 1000)]
  );
  let cancelled = 0;
  for (const { id } of rows) {
    const done = await updateOrderStatus(id, "cancelado", { onlyIfStatus: "aguardando_pagamento" });
    if (done) cancelled++;
  }
  return cancelled;
}

module.exports = {
  init,
  cancelExpiredOrders,
  _setPool,
  getProducts,
  getProductBySlug,
  getProductById,
  getCategories,
  createCart,
  getCart,
  saveCart,
  addCartItem,
  updateCartItem,
  removeCartItem,
  cartSubtotal,
  createOrder,
  getOrder,
  listOrders,
  updateOrderStatus,
};
