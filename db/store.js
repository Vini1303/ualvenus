/**
 * Camada de dados simples baseada em arquivos JSON.
 *
 * Isso roda em qualquer lugar (Railway, VPS, Vercel*) sem precisar compilar
 * nada nativo. Para uma loja com volume alto de pedidos, troque isto por um
 * banco de dados de verdade (Postgres é uma boa opção em Railway/Vercel) —
 * a interface abaixo (getProducts, createOrder, etc.) foi pensada pra ser
 * fácil de portar: só reescreva as funções deste arquivo mantendo a mesma
 * assinatura.
 *
 * *Atenção Vercel: funções serverless têm sistema de arquivos efêmero/somente
 * leitura fora de /tmp. Se for hospedar lá, troque este arquivo por um banco
 * externo (Postgres/Neon, Supabase, etc.) antes de ir pra produção.
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const DATA_DIR = path.join(__dirname, "..", "data");
const PRODUCTS_FILE = path.join(DATA_DIR, "products.json");
const CARTS_FILE = path.join(DATA_DIR, "carts.json");
const ORDERS_FILE = path.join(DATA_DIR, "orders.json");

function readJSON(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf-8"));
  } catch (e) {
    return fallback;
  }
}

function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf-8");
}

if (!fs.existsSync(CARTS_FILE)) writeJSON(CARTS_FILE, {});
if (!fs.existsSync(ORDERS_FILE)) writeJSON(ORDERS_FILE, {});

// ---------- Produtos ----------

function getProducts({ category } = {}) {
  const products = readJSON(PRODUCTS_FILE, []).filter((p) => p.published !== false);
  if (category) {
    return products.filter(
      (p) => p.category.toLowerCase() === category.toLowerCase()
    );
  }
  return products;
}

function getProductBySlug(slug) {
  const products = getProducts();
  return products.find((p) => p.slug === slug) || null;
}

function getProductById(id) {
  const products = readJSON(PRODUCTS_FILE, []);
  return products.find((p) => p.id === id) || null;
}

function getCategories() {
  const products = getProducts();
  const set = new Set(products.map((p) => p.category));
  return Array.from(set).sort();
}

// ---------- Carrinho ----------
// Carrinho fica salvo no servidor (não é só localStorage), identificado por
// um cart_id guardado num cookie httpOnly. Isso é o que torna possível
// validar estoque/preço de verdade no checkout, em vez de confiar só no que
// o navegador manda.

function createCart() {
  const carts = readJSON(CARTS_FILE, {});
  const id = crypto.randomUUID();
  carts[id] = { id, items: [], created_at: new Date().toISOString() };
  writeJSON(CARTS_FILE, carts);
  return carts[id];
}

function getCart(cartId) {
  const carts = readJSON(CARTS_FILE, {});
  return carts[cartId] || null;
}

function saveCart(cart) {
  const carts = readJSON(CARTS_FILE, {});
  cart.updated_at = new Date().toISOString();
  carts[cart.id] = cart;
  writeJSON(CARTS_FILE, carts);
  return cart;
}

function addCartItem(cartId, { productId, size, color, qty }) {
  let cart = getCart(cartId) || createCart();
  const product = getProductById(productId);
  if (!product) throw new Error("Produto não encontrado");

  const stockAvailable = product.stock?.[size] ?? 0;

  const existing = cart.items.find(
    (i) => i.productId === productId && i.size === size && i.color === color
  );
  const currentQtyInCart = existing ? existing.qty : 0;

  if (currentQtyInCart + qty > stockAvailable) {
    throw new Error(
      `Estoque insuficiente para o tamanho ${size}. Disponível: ${stockAvailable}`
    );
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

function updateCartItem(cartId, { productId, size, color, qty }) {
  const cart = getCart(cartId);
  if (!cart) throw new Error("Carrinho não encontrado");

  const item = cart.items.find(
    (i) => i.productId === productId && i.size === size && i.color === color
  );
  if (!item) throw new Error("Item não encontrado no carrinho");

  if (qty <= 0) {
    cart.items = cart.items.filter((i) => i !== item);
  } else {
    const product = getProductById(productId);
    const stockAvailable = product?.stock?.[size] ?? 0;
    if (qty > stockAvailable) {
      throw new Error(
        `Estoque insuficiente para o tamanho ${size}. Disponível: ${stockAvailable}`
      );
    }
    item.qty = qty;
  }
  return saveCart(cart);
}

function removeCartItem(cartId, { productId, size, color }) {
  const cart = getCart(cartId);
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
  const n = Math.floor(100000 + Math.random() * 900000);
  return `DI-${n}`;
}

function createOrder({ cart, customer, address, shipping, paymentMethod }) {
  const orders = readJSON(ORDERS_FILE, {});
  const subtotal = cartSubtotal(cart);
  const total = subtotal + (shipping?.cost || 0);

  // Baixa de estoque "de verdade" no momento da criação do pedido.
  const products = readJSON(PRODUCTS_FILE, []);
  for (const item of cart.items) {
    const product = products.find((p) => p.id === item.productId);
    if (!product) continue;
    const current = product.stock[item.size] ?? 0;
    product.stock[item.size] = Math.max(0, current - item.qty);
  }
  writeJSON(PRODUCTS_FILE, products);

  const orderNumber = generateOrderNumber();
  const order = {
    id: orderNumber,
    items: cart.items,
    customer,
    address,
    shipping,
    subtotal,
    total,
    paymentMethod,
    status: "aguardando_pagamento",
    created_at: new Date().toISOString(),
  };
  orders[orderNumber] = order;
  writeJSON(ORDERS_FILE, orders);

  // Esvazia o carrinho depois de virar pedido
  cart.items = [];
  saveCart(cart);

  return order;
}

function getOrder(orderNumber) {
  const orders = readJSON(ORDERS_FILE, {});
  return orders[orderNumber] || null;
}

function updateOrderStatus(orderNumber, status) {
  const orders = readJSON(ORDERS_FILE, {});
  if (!orders[orderNumber]) return null;
  orders[orderNumber].status = status;
  writeJSON(ORDERS_FILE, orders);
  return orders[orderNumber];
}

module.exports = {
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
  updateOrderStatus,
};
