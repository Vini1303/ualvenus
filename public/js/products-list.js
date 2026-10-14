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
        <button class="add-btn" type="button">Ver produto</button>
      </div>
    </a>
  `;
}

async function initProductsList() {
  const params = new URLSearchParams(window.location.search);
  const cat = params.get("cat");
  const q = params.get("q");

  let title = "Todos os produtos";
  if (cat) title = cat;
  if (q) title = `Resultados para "${q}"`;

  document.getElementById("listTitle").textContent = title;
  document.getElementById("breadcrumbCurrent").textContent = title;
  document.getElementById("pageTitle").textContent = `${title} — Vênus`;

  try {
    const all = await Api.get("/api/products");
    const counts = new Map();
    all.forEach((p) => counts.set(p.category, (counts.get(p.category) || 0) + 1));
    const filters = document.getElementById("categoryFilters");
    filters.replaceChildren();
    [["", all.length], ...Array.from(counts).sort(([a], [b]) => a.localeCompare(b, "pt-BR"))]
      .forEach(([category, count]) => {
        const link = document.createElement("a");
        const query = new URLSearchParams();
        if (category) query.set("cat", category);
        if (q) query.set("q", q);
        link.href = `/produtos.html${query.size ? '?' + query : ''}`;
        link.textContent = `${category || 'Todos'} (${count})`;
        if (category.toLowerCase() === (cat || "").toLowerCase()) {
          link.classList.add("active");
          link.setAttribute("aria-current", "page");
        }
        filters.append(link);
      });
    let filtered = all;

    if (cat) {
      filtered = all.filter((p) => p.category.toLowerCase() === cat.toLowerCase());
    }

    if (q) {
      const needle = q.toLowerCase();
      filtered = filtered.filter((p) => p.name.toLowerCase().includes(needle) || p.category.toLowerCase().includes(needle));
    }

    document.getElementById("listCount").textContent = `${filtered.length} produto(s)`;

    const listEl = document.getElementById("productList");
    if (!filtered.length) {
      listEl.innerHTML = `
        <div class="empty-state" style="grid-column:1/-1;">
          <h2>Nenhum produto encontrado</h2>
          <p>Ainda não temos itens nessa categoria/busca. Veja todos os produtos disponíveis.</p>
          <a href="/produtos.html" class="hero-cta" style="background:var(--ink);color:#fff;">Ver todos os produtos</a>
        </div>
      `;
      return;
    }

    listEl.innerHTML = filtered.map(productCardHTML).join("");
  } catch (err) {
    console.error(err);
    document.getElementById("productList").innerHTML = '<p role="alert">Não foi possível carregar os produtos. Atualize a página para tentar novamente.</p>';
  }
}

document.addEventListener("DOMContentLoaded", initProductsList);
