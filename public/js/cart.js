const Cart = {
  data: { items: [], subtotal: 0 },

  async refresh() {
    try {
      this.data = await Api.get("/api/cart");
    } catch (err) {
      console.error("Erro ao carregar carrinho:", err);
    }
    this.render();
  },

  open() {
    document.getElementById("cartDrawer")?.classList.add("open");
    document.getElementById("cartOverlay")?.classList.add("open");
  },

  close() {
    document.getElementById("cartDrawer")?.classList.remove("open");
    document.getElementById("cartOverlay")?.classList.remove("open");
  },

  async add({ productId, size, color, qty }) {
    try {
      this.data = await Api.post("/api/cart/items", { productId, size, color, qty });
      this.render();
      showToast("Adicionado ao carrinho!");
      this.open();
    } catch (err) {
      showToast(err.message);
    }
  },

  async updateQty(productId, size, color, qty) {
    try {
      this.data = await Api.patch("/api/cart/items", { productId, size, color, qty });
      this.render();
    } catch (err) {
      showToast(err.message);
    }
  },

  async remove(productId, size, color) {
    try {
      this.data = await Api.del("/api/cart/items", { productId, size, color });
      this.render();
    } catch (err) {
      showToast(err.message);
    }
  },

  render() {
    const countEl = document.getElementById("cartCount");
    const totalQty = this.data.items.reduce((s, i) => s + i.qty, 0);
    if (countEl) {
      countEl.textContent = totalQty;
      countEl.hidden = totalQty === 0;
    }

    const body = document.getElementById("cartBody");
    const foot = document.getElementById("cartFoot");
    if (!body || !foot) return;

    if (!this.data.items.length) {
      body.innerHTML = `<div class="cart-empty">Seu carrinho está vazio.<br>Que tal dar uma olhada nos lançamentos?</div>`;
      foot.innerHTML = `<a href="/produtos.html" class="btn-secondary">Ver produtos</a>`;
      return;
    }

    body.innerHTML = this.data.items
      .map(
        (item) => `
      <div class="cart-item">
        <img src="${item.image}" alt="${item.name}" loading="lazy">
        <div>
          <p class="cart-item-name">${item.name}</p>
          <p class="cart-item-meta">Tam: ${item.size}${item.color ? " · " + item.color : ""}</p>
          <div class="qty-control">
            <button data-action="dec" data-id="${item.productId}" data-size="${item.size}" data-color="${item.color || ""}">−</button>
            <span>${item.qty}</span>
            <button data-action="inc" data-id="${item.productId}" data-size="${item.size}" data-color="${item.color || ""}">+</button>
          </div>
          <button class="cart-item-remove" data-action="remove" data-id="${item.productId}" data-size="${item.size}" data-color="${item.color || ""}">Remover</button>
        </div>
        <div class="cart-item-price">${formatBRL(item.unitPrice * item.qty)}</div>
      </div>
    `
      )
      .join("");

    body.querySelectorAll("button[data-action]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const { id, size, color, action } = btn.dataset;
        const item = this.data.items.find(
          (i) => i.productId === id && i.size === size && (i.color || "") === color
        );
        if (!item) return;
        if (action === "inc") this.updateQty(id, size, color || null, item.qty + 1);
        if (action === "dec") this.updateQty(id, size, color || null, item.qty - 1);
        if (action === "remove") this.remove(id, size, color || null);
      });
    });

    const missing = 160 - this.data.subtotal;
    foot.innerHTML = `
      ${
        missing > 0
          ? `<div class="free-shipping-note">Faltam <strong>${formatBRL(missing)}</strong> para você ganhar frete grátis 🚚</div>`
          : `<div class="free-shipping-note">🎉 Você garantiu frete grátis!</div>`
      }
      <div class="cart-subtotal-row"><span>Subtotal</span><span>${formatBRL(this.data.subtotal)}</span></div>
      <a href="/checkout.html" class="btn-primary">Finalizar compra</a>
    `;
  },
};
