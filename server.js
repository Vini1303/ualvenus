require("dotenv").config();
const express = require("express");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const path = require("path");

const productsRouter = require("./routes/products");
const cartRouter = require("./routes/cart");
const checkoutRouter = require("./routes/checkout");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: process.env.SITE_URL || true, credentials: true }));
app.use(express.json());
app.use(cookieParser());

app.use("/api/products", productsRouter);
app.use("/api/cart", cartRouter);
app.use("/api/checkout", checkoutRouter);

app.get("/api/health", (req, res) => res.json({ ok: true }));

app.use(express.static(path.join(__dirname, "public")));

app.listen(PORT, () => {
  console.log(`Dash Imports rodando em http://localhost:${PORT}`);
});
