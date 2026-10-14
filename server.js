require("dotenv").config();
const express = require("express");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const path = require("path");

const productsRouter = require("./routes/products");
const cartRouter = require("./routes/cart");
const checkoutRouter = require("./routes/checkout");
const adminRouter = require("./routes/admin");
const store = require("./db/store");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: process.env.SITE_URL || true, credentials: true }));
app.use(express.json());
app.use(cookieParser());

app.use("/api/products", productsRouter);
app.use("/api/cart", cartRouter);
app.use("/api/checkout", checkoutRouter);
app.use("/api/admin", adminRouter);

app.get("/api/health", (req, res) => res.json({ ok: true }));

app.use(express.static(path.join(__dirname, "public")));

store
  .init()
  .then(() => {
    const PAYMENT_TIMEOUT_HOURS = Number(process.env.PAYMENT_TIMEOUT_HOURS) || 2;
    const sweep = () =>
      store
        .cancelExpiredOrders(PAYMENT_TIMEOUT_HOURS)
        .then((n) => n && console.log(`${n} pedido(s) sem pagamento cancelado(s)`))
        .catch((err) => console.error("Falha ao cancelar pedidos expirados:", err.message));
    sweep();
    setInterval(sweep, 10 * 60 * 1000);

    app.listen(PORT, () => {
      console.log(`Dash Imports rodando em http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Falha ao conectar no banco:", err.message);
    process.exit(1);
  });
