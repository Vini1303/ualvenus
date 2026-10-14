const express = require("express");
const router = express.Router();
const store = require("../db/store");

// GET /api/products?category=Nike
router.get("/", (req, res) => {
  const { category } = req.query;
  res.json(store.getProducts({ category }));
});

// GET /api/products/categories
router.get("/categories", (req, res) => {
  res.json(store.getCategories());
});

// GET /api/products/:slug
router.get("/:slug", (req, res) => {
  const product = store.getProductBySlug(req.params.slug);
  if (!product) return res.status(404).json({ error: "Produto não encontrado" });
  res.json(product);
});

module.exports = router;
