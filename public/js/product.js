let currentProduct = null;
let selectedSize = null;
let selectedColor = null;

function installmentsLine(price) {
  const n = 3;
  const value = price / n;
  return `ou ${n}x de ${formatBRL(value)} sem juros`;
}

function productImages(p) {
  const images = Array.isArray(p.images) && p.images.length ? p.images : [p.image];
  return images.filter(Boolean);
}

function renderProduct(p) {
  currentProduct = p;
  selectedSize = null;
  selectedColor = p.colors[0] || null;

  document.getElementById("pageTitle").textContent = `${p.name} — Vênus`;
  document.getElementById("breadcrumbCat").textContent = p.category;
  document.getElementById("breadcrumbCat").href = `/produtos.html?cat=${encodeURIComponent(p.category)}`;
  document.getElementById("breadcrumbName").textContent = p.name;

  const hasDiscount = p.discount_pct && p.discount_pct > 0;
  const images = productImages(p);
  const isAvailable = p.available !== false && p.sizes.some((s) => (p.stock?.[s] ?? 0) > 0);
  const onRequest = p.stock_status === "on_request";

  const colorsHTML = p.colors.length
    ? `
      <span class="pd-section-label">Cor</span>
      <div class="pd-colors">
        ${p.colors
          .map(
            (c, i) =>
              `<button class="color-btn ${i === 0 ? "selected" : ""}" data-color="${c}">${c}</button>`
          )
          .join("")}
      </div>
    `
    : "";

  const sizesHTML = `
    <span class="pd-section-label">Tamanho</span>
    <div class="pd-sizes">
      ${p.sizes
        .map((s) => {
          const stock = p.stock?.[s] ?? 0;
          return `<button class="size-btn" data-size="${s}" ${stock <= 0 ? "disabled" : ""}>${s}</button>`;
        })
        .join("")}
    </div>
  `;

  document.getElementById("productDetail").innerHTML = `
    <div class="product-detail">
      <div class="product-gallery">
        <img src="${images[0]}" alt="${p.name}" id="mainImage">
        ${
          images.length > 1
            ? `<div class="product-thumbs">
                ${images
                  .map(
                    (image, i) =>
                      `<button class="product-thumb-btn ${i === 0 ? "selected" : ""}" type="button" data-image="${image}" aria-label="Ver foto ${i + 1}">
                        <img src="${image}" alt="${p.name} - foto ${i + 1}">
                      </button>`
                  )
                  .join("")}
              </div>`
            : ""
        }
      </div>
      <div>
        <h1 class="pd-name">${p.name}</h1>
        <div class="pd-price-row">
          <span class="pd-price-now">${formatBRL(p.price)}</span>
          ${hasDiscount ? `<span class="pd-price-old">${formatBRL(p.compare_at_price)}</span>` : ""}
          ${hasDiscount ? `<span class="pd-discount">-${p.discount_pct}%</span>` : ""}
        </div>
        <p class="pd-installments">${installmentsLine(p.price)}</p>

        ${colorsHTML}
        ${p.sizes.length ? sizesHTML : '<p class="pd-installments">Consulte os tamanhos disponíveis com nossa equipe.</p>'}
        <p class="field-error" id="sizeError" style="display:none;">Escolha um tamanho antes de continuar.</p>

        <button class="btn-primary" id="addToCartBtn" type="button" ${isAvailable ? "" : "disabled"}>
          ${isAvailable ? "Adicionar ao carrinho" : onRequest ? "Disponibilidade sob consulta" : "Produto esgotado"}
        </button>
        ${onRequest ? `<a class="product-inquiry" target="_blank" rel="noopener" href="https://wa.me/5511938006525?text=${encodeURIComponent('Olá! Gostaria de consultar os tamanhos e a disponibilidade de ' + p.name + '.')}">Consultar pelo WhatsApp</a>` : ""}

        <div class="pd-shipping-box">
          <span class="pd-section-label">Calcular frete e prazo</span>
          <form id="shippingForm">
            <input type="text" name="cep" placeholder="00000-000" maxlength="9" inputmode="numeric" required>
            <button type="submit">Calcular</button>
          </form>
          <div class="pd-shipping-result" id="shippingResult"></div>
        </div>
      </div>
    </div>
  `;

  document.querySelectorAll(".size-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".size-btn").forEach((b) => b.classList.remove("selected"));
      btn.classList.add("selected");
      selectedSize = btn.dataset.size;
      document.getElementById("sizeError").style.display = "none";
    });
  });

  document.querySelectorAll(".product-thumb-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".product-thumb-btn").forEach((b) => b.classList.remove("selected"));
      btn.classList.add("selected");
      document.getElementById("mainImage").src = btn.dataset.image;
    });
  });

  document.querySelectorAll(".color-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".color-btn").forEach((b) => b.classList.remove("selected"));
      btn.classList.add("selected");
      selectedColor = btn.dataset.color;
    });
  });

  document.getElementById("addToCartBtn").addEventListener("click", () => {
    if (!isAvailable) return;
    if (!selectedSize) {
      document.getElementById("sizeError").style.display = "block";
      return;
    }
    Cart.add({ productId: p.id, size: selectedSize, color: selectedColor, qty: 1 });
  });

  document.getElementById("shippingForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const cep = new FormData(e.target).get("cep");
    const resultEl = document.getElementById("shippingResult");
    resultEl.textContent = "Calculando...";
    try {
      // Usa o subtotal só deste produto como referência de frete grátis
      const data = await Api.get(`/api/cart/shipping?cep=${encodeURIComponent(cep)}`);
      // Se o carrinho estiver vazio, recalcula com base no preço do produto atual
      if (!Cart.data.items.length) {
        const estimateForThisProduct = p.price >= 160;
        resultEl.innerHTML = estimateForThisProduct
          ? `<strong>Frete grátis</strong> · chega em ${data.days} dias úteis`
          : `Frete estimado: <strong>${formatBRL(20)}</strong> · chega em ${data.days} dias úteis`;
      } else {
        resultEl.innerHTML = data.free
          ? `<strong>Frete grátis</strong> · chega em ${data.days} dias úteis`
          : `Frete estimado: <strong>${formatBRL(data.cost)}</strong> · chega em ${data.days} dias úteis`;
      }
    } catch (err) {
      resultEl.textContent = err.message;
    }
  });
}

async function loadRelated(product) {
  try {
    const all = await Api.get("/api/products");
    const related = all.filter((p) => p.category === product.category && p.id !== product.id).slice(0, 8);
    const el = document.getElementById("relatedProducts");
    if (!related.length) {
      document.querySelector("#relatedProducts").closest("section").style.display = "none";
      return;
    }
    el.innerHTML = related
      .map(
        (p) => `
        <a class="product-card" href="/produto.html?slug=${encodeURIComponent(p.slug)}">
          <div class="product-thumb">
            ${p.discount_pct ? `<span class="badge-off">-${p.discount_pct}%</span>` : ""}
            ${p.available === false ? `<span class="badge-sold">${p.stock_status === 'on_request' ? 'Sob consulta' : 'Esgotado'}</span>` : ""}
            <img src="${p.image}" alt="${p.name}" loading="lazy">
          </div>
          <div class="product-info">
            <p class="product-name">${p.name}</p>
            <div class="product-price-row">
              <span class="price-now">${formatBRL(p.price)}</span>
            </div>
          </div>
        </a>
      `
      )
      .join("");
  } catch (err) {
    console.error(err);
  }
}

async function initProductPage() {
  const params = new URLSearchParams(window.location.search);
  const slug = params.get("slug");
  if (!slug) {
    document.getElementById("productDetail").innerHTML = `<div class="empty-state"><h2>Produto não encontrado</h2></div>`;
    return;
  }
  try {
    const product = await Api.get(`/api/products/${encodeURIComponent(slug)}`);
    renderProduct(product);
    loadRelated(product);
    trackOnce(`view:${product.id}`, { type: "view", productId: product.id });
  } catch (err) {
    document.getElementById("productDetail").innerHTML = `<div class="empty-state"><h2>Produto não encontrado</h2><p>${err.message}</p></div>`;
  }
}

document.addEventListener("DOMContentLoaded", initProductPage);
