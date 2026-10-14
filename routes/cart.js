const express = require("express");
const router = express.Router();
const store = require("../db/store");
const shipping = require("../services/shipping");

const CART_COOKIE = "dash_cart_id";

async function getOrCreateCart(req, res) {
  let cartId = req.cookies[CART_COOKIE];
  let cart = cartId ? await store.getCart(cartId) : null;
  if (!cart) {
    cart = await store.createCart();
    res.cookie(CART_COOKIE, cart.id, {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 dias
    });
  }
  return cart;
}

function serializeCart(cart) {
  const subtotal = store.cartSubtotal(cart);
  return { ...cart, subtotal };
}

// GET /api/cart
router.get("/", async (req, res) => {
  const cart = await getOrCreateCart(req, res);
  res.json(serializeCart(cart));
});

// POST /api/cart/items  { productId, size, color, qty }
router.post("/items", async (req, res) => {
  const cart = await getOrCreateCart(req, res);
  const { productId, size, color, qty } = req.body;
  if (!productId || !size || !qty) {
    return res.status(400).json({ error: "productId, size e qty são obrigatórios" });
  }
  try {
    const updated = await store.addCartItem(cart.id, {
      productId,
      size,
      color: color || null,
      qty: Number(qty),
    });
    res.json(serializeCart(updated));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PATCH /api/cart/items  { productId, size, color, qty }
router.patch("/items", async (req, res) => {
  const cart = await getOrCreateCart(req, res);
  const { productId, size, color, qty } = req.body;
  try {
    const updated = await store.updateCartItem(cart.id, {
      productId,
      size,
      color: color || null,
      qty: Number(qty),
    });
    res.json(serializeCart(updated));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/cart/items  { productId, size, color }
router.delete("/items", async (req, res) => {
  const cart = await getOrCreateCart(req, res);
  const { productId, size, color } = req.body;
  try {
    const updated = await store.removeCartItem(cart.id, {
      productId,
      size,
      color: color || null,
    });
    res.json(serializeCart(updated));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/cart/shipping?cep=01001000
router.get("/shipping", async (req, res) => {
  const cart = await getOrCreateCart(req, res);
  const subtotal = store.cartSubtotal(cart);
  try {
    const estimate = shipping.estimateShipping(req.query.cep, subtotal);
    res.json(estimate);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
module.exports.CART_COOKIE = CART_COOKIE;
module.exports.getOrCreateCart = getOrCreateCart;
