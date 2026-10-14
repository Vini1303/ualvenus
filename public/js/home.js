function productCardHTML(p) {
  const hasDiscount = p.discount_pct && p.discount_pct > 0;
  return `
    <a class="product-card" href="/produto.html?slug=${encodeURIComponent(p.slug)}">
      <div class="product-thumb">
        ${hasDiscount ? `<span class="badge-off">-${p.discount_pct}%</span>` : ""}
        ${p.available === false ? `<span class="badge-sold">${p.stock_status === 'on_request' ? 'Sob consulta' : 'Esgotado'}</span>` : ""}
        <img src="${p.image}" alt="${p.name}" loading="lazy">
        <span class="badge-free">Frete grátis*</span>
      </div>
      <div class="product-info">
        <p class="product-name">${p.name}</p>
        <div class="product-price-row">
          <span class="price-now">${formatBRL(p.price)}</span>
          ${hasDiscount ? `<span class="price-old">${formatBRL(p.compare_at_price)}</span>` : ""}
        </div>
        <button class="add-btn" type="button" data-quickadd="${p.id}">Ver produto</button>
      </div>
    </a>
  `;
}

function renderShelf(elId, products) {
  const el = document.getElementById(elId);
  if (!el) return;
  if (!products.length) {
    el.innerHTML = `<p style="color:var(--muted)">Em breve novos produtos por aqui.</p>`;
    return;
  }
  el.innerHTML = products.map(productCardHTML).join("");
}

function renderCategoryStrip(products = []) {
  const el = document.getElementById("catStrip");
  if (!el) return;

  if (products.length) {
    const byCategory = new Map();
    products.forEach((product) => {
      if (!byCategory.has(product.category)) byCategory.set(product.category, product);
    });

    const preferred = ["Cropped", "Top", "Blusa", "Regata"];
    const orderedNames = [
      ...preferred.filter((name) => byCategory.has(name)),
      ...Array.from(byCategory.keys())
        .filter((name) => !preferred.includes(name))
        .sort((a, b) => a.localeCompare(b, "pt-BR")),
    ];

    const categories = orderedNames.map((name) => ({ name, image: byCategory.get(name).image }));
    el.innerHTML = categories
      .map(
        (category) => `
        <a class="cat-item" href="/produtos.html?cat=${encodeURIComponent(category.name)}">
          <div class="cat-circle"><img src="${category.image}" alt="${category.name}"></div>
          <span>${category.name}</span>
        </a>
      `
      )
      .join("");
    return;
  }

  const categories = [
    { name: "Cropped", image: "/img/catalogo/cropped-assimetrico-preto.png" },
    { name: "Calça", image: "/img/catalogo/calca-pantalona-preta.png" },
    { name: "Camisetas", image: "/img/catalogo/camiseta-oversized-branca.png" },
    { name: "Body", image: "/img/catalogo/body-vinho.png" },
    { name: "Blusa de Frio", image: "/img/catalogo/blusa-frio-bege.png" },
    { name: "Jaquetas", image: "/img/catalogo/jaqueta-jeans-azul.png" },
    { name: "Shorts", image: "/img/catalogo/shorts-alfaiataria-preto.png" },
  ];
  el.innerHTML = categories
    .map(
      (category) => `
      <a class="cat-item" href="/produtos.html?cat=${encodeURIComponent(category.name)}">
        <div class="cat-circle"><img src="${category.image}" alt="${category.name}"></div>
        <span>${category.name}</span>
      </a>
    `
    )
    .join("");
}

const HERO_SLIDES = [
  {
    image: "/img/banner-nova-colecao.webp",
    alt: "Nova coleção de moda feminina",
    href: "/produtos.html",
  },
  {
    eyebrow: "Novidades Vênus",
    title: "Peças femininas com poses, cores e estilos diferentes",
    sub: "Croppeds, vestidos, bodies, calças, saias e muito mais. Encontre seu próximo look.",
    cta: "Ver novidades",
    href: "/produtos.html",
  },
  {
    eyebrow: "Cupom primeiracompra",
    title: "Sua primeira compra com desconto exclusivo",
    sub: "Use o cupom PRIMEIRACOMPRA e garanta seu desconto agora.",
    cta: "Aproveitar agora",
    href: "/produtos.html",
  },
];

function initHero() {
  const slidesEl = document.getElementById("heroSlides");
  const dotsEl = document.getElementById("heroDots");
  if (!slidesEl) return;

  slidesEl.innerHTML = HERO_SLIDES.map((s) =>
    s.image
      ? `
        <div class="hero-slide hero-slide-image">
          <a href="${s.href}" aria-label="${s.alt || "Promoção"}">
            <img src="${s.image}" alt="${s.alt || ""}">
          </a>
        </div>
      `
      : `
        <div class="hero-slide">
          <div class="hero-stripe"></div>
          <div class="hero-slide-content">
            <span class="hero-eyebrow">${s.eyebrow}</span>
            <h2 class="hero-title">${s.title}</h2>
            <p class="hero-sub">${s.sub}</p>
            <a href="${s.href}" class="hero-cta">${s.cta}</a>
          </div>
        </div>
      `
  ).join("");

  dotsEl.innerHTML = HERO_SLIDES.map(
    (_, i) => `<button class="hero-dot ${i === 0 ? "active" : ""}" data-i="${i}" aria-label="Slide ${i + 1}"></button>`
  ).join("");

  let current = 0;
  const total = HERO_SLIDES.length;

  function goTo(i) {
    current = (i + total) % total;
    slidesEl.style.transform = `translateX(-${current * 100}%)`;
    dotsEl.querySelectorAll(".hero-dot").forEach((d, idx) => d.classList.toggle("active", idx === current));
  }

  document.getElementById("heroPrev")?.addEventListener("click", () => goTo(current - 1));
  document.getElementById("heroNext")?.addEventListener("click", () => goTo(current + 1));
  dotsEl.querySelectorAll(".hero-dot").forEach((d) => d.addEventListener("click", () => goTo(Number(d.dataset.i))));

  if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    setInterval(() => goTo(current + 1), 6000);
  }
}

async function initHome() {
  initHero();
  try {
    const products = await Api.get("/api/products");
    renderCategoryStrip(products);

    const byDiscount = [...products].sort((a, b) => (b.discount_pct || 0) - (a.discount_pct || 0));
    renderShelf("shelfBestSellers", byDiscount.slice(0, 8));
    renderShelf("shelfNewArrivals", [...products].reverse().slice(0, 8));
    renderShelf("shelfPromoStock", byDiscount.slice(0, 8));
  } catch (err) {
    console.error(err);
  }
}

document.addEventListener("DOMContentLoaded", initHome);
