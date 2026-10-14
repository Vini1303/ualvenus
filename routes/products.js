const express = require("express");
const router = express.Router();
const store = require("../db/store");

// GET /api/products?category=Nike
router.get("/", async (req, res) => {
  const { category } = req.query;
  res.json(await store.getProducts({ category }));
});

// GET /api/products/categories
router.get("/categories", async (req, res) => {
  res.json(await store.getCategories());
});

// GET /api/products/:slug
router.get("/:slug", async (req, res) => {
  const product = await store.getProductBySlug(req.params.slug);
  if (!product) return res.status(404).json({ error: "Produto não encontrado" });
  res.json(product);
});

module.exports = router;
