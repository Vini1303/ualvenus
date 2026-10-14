const express = require("express");
const router = express.Router();
const store = require("../db/store");

const TYPES = new Set(["visit", "view"]);
const hits = new Map(); // ip -> { count, resetAt }

function limited(ip) {
  const now = Date.now();
  const h = hits.get(ip);
  if (!h || h.resetAt < now) {
    hits.set(ip, { count: 1, resetAt: now + 60000 });
    return false;
  }
  return ++h.count > 60;
}
setInterval(() => {
  const now = Date.now();
  for (const [ip, h] of hits) if (h.resetAt < now) hits.delete(ip);
}, 5 * 60000).unref();

// POST /api/track  { type: "visit" | "view", productId? }
// Evento anônimo para o painel (sem cookies, IP ou dados pessoais gravados).
router.post("/", async (req, res) => {
  if (limited(req.ip)) return res.status(429).end();
  const { type, productId } = req.body || {};
  if (!TYPES.has(type)) return res.status(400).end();
  if (type === "view") {
    if (!productId || !(await store.getProductById(productId))) return res.status(400).end();
  }
  await store.recordEvent(type, type === "view" ? productId : null);
  res.status(204).end();
});

module.exports = router;
