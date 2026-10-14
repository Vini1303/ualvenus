const crypto = require("crypto");
const express = require("express");
const router = express.Router();
const store = require("../db/store");

const STATUSES = ["aguardando_pagamento", "pago", "enviado", "entregue", "cancelado"];

// Protegido por ADMIN_TOKEN (header "x-admin-token"). Sem a variável, desativado.
router.use((req, res, next) => {
  const expected = process.env.ADMIN_TOKEN;
  const given = String(req.get("x-admin-token") || "");
  const ok =
    expected &&
    given.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(given), Buffer.from(expected));
  if (!ok) return res.status(401).json({ error: "Não autorizado" });
  next();
});

// GET /api/admin/orders?status=pago
router.get("/orders", async (req, res) => {
  res.json(await store.listOrders({ status: req.query.status }));
});

// PATCH /api/admin/orders/:id  { status }   (cancelado devolve o estoque)
router.patch("/orders/:id", async (req, res) => {
  const { status } = req.body;
  if (!STATUSES.includes(status)) {
    return res.status(400).json({ error: `Status inválido. Use: ${STATUSES.join(", ")}` });
  }
  const order = await store.updateOrderStatus(req.params.id, status);
  if (!order) return res.status(404).json({ error: "Pedido não encontrado" });
  res.json(order);
});

module.exports = router;
