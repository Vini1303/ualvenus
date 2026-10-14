const express = require("express");
const router = express.Router();
const store = require("../db/store");
const shippingService = require("../services/shipping");
const paymentService = require("../services/payment");
const cartRoutes = require("./cart");

// POST /api/checkout
// body: { customer: {name, email, phone}, address: {...} | cep, paymentMethod }
router.post("/", async (req, res) => {
  const cart = await cartRoutes.getOrCreateCart(req, res);

  if (!cart.items.length) {
    return res.status(400).json({ error: "Carrinho vazio" });
  }

  const { customer, address, paymentMethod } = req.body;

  if (!customer?.name || !customer?.email || !customer?.phone) {
    return res.status(400).json({ error: "Preencha nome, e-mail e telefone" });
  }
  if (!address?.cep || !address?.street || !address?.number || !address?.city) {
    return res.status(400).json({ error: "Endereço de entrega incompleto" });
  }

  const subtotal = store.cartSubtotal(cart);
  let shippingEstimate;
  try {
    shippingEstimate = shippingService.estimateShipping(address.cep, subtotal);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  try {
    const order = await store.createOrder({
      cart,
      customer,
      address,
      shipping: shippingEstimate,
      paymentMethod: paymentMethod || "pix",
    });

    const payment = await paymentService.createPayment(order);

    res.json({ order, payment });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/checkout/order/:id
// Resposta pública: sem dados pessoais do cliente (nome, telefone, endereço).
router.get("/order/:id", async (req, res) => {
  const order = await store.getOrder(req.params.id);
  if (!order) return res.status(404).json({ error: "Pedido não encontrado" });
  const { id, items, shipping, subtotal, total, paymentMethod, status, created_at } = order;
  res.json({ id, items, shipping, subtotal, total, paymentMethod, status, created_at });
});

module.exports = router;
