// Header, footer e gaveta de carrinho — injetados em todas as páginas a
// partir de #layout-header / #layout-footer, pra não duplicar HTML.

let NAV_CATEGORIES = [
  { label: "Cropped", cat: "Cropped" },
  { label: "Top", cat: "Top" },
  { label: "Blusa", cat: "Blusa" },
  { label: "Regata", cat: "Regata" },
  { label: "Calça", cat: "Calça" },
  { label: "Camisetas", cat: "Camisetas" },
  { label: "Body", cat: "Body" },
  { label: "Blusa de Frio", cat: "Blusa de Frio" },
  { label: "Jaquetas", cat: "Jaquetas" },
  { label: "Shorts", cat: "Shorts" },
  { label: "Vestido", cat: "Vestido" },
  { label: "Saia", cat: "Saia" },
  { label: "Conjunto", cat: "Conjunto" },
  { label: "Macacão", cat: "Macacão" },
];

const ANNOUNCE_MESSAGES = [
  "SUA COMPRA SEGURA!",
  "ENVIOS PARA TODO O BRASIL GRÁTIS!",
  'USE O CUPOM "PRIMEIRACOMPRA"',
];

const TOP_LINKS = [
  { label: "INÍCIO", href: "/" },
  { label: "PRODUTOS", href: "/produtos.html" },
  { label: "CONTATO", href: "/contato.html" },
  { label: "TROCAS E DEVOLUÇÕES", href: "/trocas-e-devolucoes.html" },
  { label: "RASTREIO", href: "/rastreio.html" },
];

function renderHeader() {
  const el = document.getElementById("layout-header");
  if (!el) return;
  el.innerHTML = `
    <div class="announce-bar">
      <button class="announce-arrow" id="announcePrev" aria-label="Aviso anterior">‹</button>
      <div class="announce-text" id="announceText">${ANNOUNCE_MESSAGES[0]}</div>
      <button class="announce-arrow" id="announceNext" aria-label="Próximo aviso">›</button>
    </div>

    <header class="site-header">
      <div class="header-row">
        <a href="/" class="logo-block">
          <img src="/img/logo-venus.jpg" alt="Vênus" class="logo-img">
        </a>

        <form class="search-form" id="searchForm">
          <input type="search" name="q" placeholder="O que você está buscando?" aria-label="Buscar produtos">
          <button type="submit" aria-label="Buscar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
          </button>
        </form>

        <div class="header-actions">
          <a href="/account/login.html" class="account-block">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8"/></svg>
            <span><strong>Olá! Faça login</strong>Ou cadastre-se</span>
          </a>
          <a href="https://wa.me/5511938006525" target="_blank" class="icon-btn" aria-label="WhatsApp" title="Fale conosco no WhatsApp">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 21l1.4-4.2A8.5 8.5 0 1 1 8 19.5L3 21z"/><path d="M8.5 9.5c0 3.5 2.5 6 6 6"/></svg>
          </a>
          <button class="icon-btn" id="cartToggle" aria-label="Abrir carrinho">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M5 8h14l-1.2 10.5a2 2 0 0 1-2 1.5H8.2a2 2 0 0 1-2-1.5L5 8z"/><path d="M9 8a3 3 0 0 1 6 0"/></svg>
            <span class="cart-count" id="cartCount" hidden>0</span>
          </button>
        </div>
      </div>

      <nav class="sub-nav">
        <div class="sub-nav-row">
          <div class="sub-nav-left">
            <button class="cat-toggle" id="catToggle">
              <span class="cat-toggle-icon">☰</span> CATEGORIAS
            </button>
            ${TOP_LINKS.map((l) => `<a href="${l.href}">${l.label}</a>`).join("")}
          </div>
          <a href="/rastreio.html" class="sub-nav-right">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M2 17V7a1 1 0 0 1 1-1h9v11"/><path d="M12 10h4l4 4v3h-2"/><circle cx="7" cy="18" r="1.8"/><circle cx="17" cy="18" r="1.8"/></svg>
            <span><strong>MEU PEDIDO</strong>Rastrear agora!</span>
          </a>
        </div>
      </nav>
    </header>

    <div class="overlay" id="catOverlay"></div>
    <aside class="cat-drawer" id="catDrawer">
      <div class="cart-head">
        <h3>Categorias</h3>
        <button class="cart-close" id="catClose" aria-label="Fechar categorias">×</button>
      </div>
      <ul class="cat-drawer-list">
        <li><a href="/produtos.html">Ver todos os produtos</a></li>
        ${NAV_CATEGORIES.map(
          (c) => `<li><a href="/produtos.html?cat=${encodeURIComponent(c.cat)}">${c.label}</a></li>`
        ).join("")}
      </ul>
    </aside>
  `;

  document.getElementById("searchForm")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const q = new FormData(e.target).get("q");
    if (q) window.location.href = `/produtos.html?q=${encodeURIComponent(q)}`;
  });

  document.getElementById("cartToggle")?.addEventListener("click", () => Cart.open());

  const catDrawer = document.getElementById("catDrawer");
  const catOverlay = document.getElementById("catOverlay");
  const openCats = () => { catDrawer.classList.add("open"); catOverlay.classList.add("open"); };
  const closeCats = () => { catDrawer.classList.remove("open"); catOverlay.classList.remove("open"); };
  document.getElementById("catToggle")?.addEventListener("click", openCats);
  document.getElementById("catClose")?.addEventListener("click", closeCats);
  catOverlay?.addEventListener("click", closeCats);

  let announceIndex = 0;
  const announceText = document.getElementById("announceText");
  const showAnnounce = (i) => {
    announceIndex = (i + ANNOUNCE_MESSAGES.length) % ANNOUNCE_MESSAGES.length;
    announceText.textContent = ANNOUNCE_MESSAGES[announceIndex];
  };
  document.getElementById("announcePrev")?.addEventListener("click", () => showAnnounce(announceIndex - 1));
  document.getElementById("announceNext")?.addEventListener("click", () => showAnnounce(announceIndex + 1));
  if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    setInterval(() => showAnnounce(announceIndex + 1), 4500);
  }
}

function renderFooter() {
  const el = document.getElementById("layout-footer");
  if (!el) return;
  el.innerHTML = `
    <footer class="site-footer">
      <div class="container footer-grid">
        <div class="footer-col">
          <div class="footer-logo">VÊNUS</div>
          <p>Moda feminina com entrega para todo o Brasil. Compra 100% segura.</p>
        </div>
        <div class="footer-col">
          <h4>Institucional</h4>
          <ul>
            <li><a href="/contato.html">Contato</a></li>
            <li><a href="/trocas-e-devolucoes.html">Trocas e devoluções</a></li>
            <li><a href="/rastreio.html">Rastreio do pedido</a></li>
          </ul>
        </div>
        <div class="footer-col">
          <h4>Categorias</h4>
          <ul id="footerCategories">
            ${NAV_CATEGORIES
              .map((c) => `<li><a href="/produtos.html?cat=${encodeURIComponent(c.cat)}">${c.label}</a></li>`)
              .join("")}
          </ul>
        </div>
        <div class="footer-col">
          <h4>Atendimento</h4>
          <ul>
            <li><a href="https://wa.me/5511938006525" target="_blank">WhatsApp: (11) 93800-6525</a></li>
            <li>Seg. a Sáb. — 9h às 19h</li>
          </ul>
        </div>
      </div>
      <div class="container footer-bottom">
        <span>© ${new Date().getFullYear()} Vênus. Todos os direitos reservados.</span>
        <div class="payment-icons">
          <span>PIX</span><span>VISA</span><span>MASTER</span><span>BOLETO</span>
        </div>
      </div>
    </footer>
    <a href="https://wa.me/5511938006525" target="_blank" class="whatsapp-fab" aria-label="Fale no WhatsApp">
      <svg viewBox="0 0 32 32"><path d="M16 3C9 3 3 9 3 16c0 2.5.7 4.8 2 6.8L3 29l6.4-2C11.3 28 13.6 29 16 29c7 0 13-6 13-13S23 3 16 3zm0 23.5c-2.1 0-4.1-.6-5.8-1.6l-.4-.3-3.6 1.1 1.1-3.5-.3-.4C5.9 20 5.3 18 5.3 16 5.3 10.2 10.2 5.3 16 5.3S26.7 10.2 26.7 16 21.8 26.5 16 26.5zm6-7.6c-.3-.2-1.9-1-2.2-1.1-.3-.1-.5-.2-.7.1-.2.3-.8 1-1 1.2-.2.2-.4.2-.6.1-1.6-.7-2.7-1.7-3.6-3.2-.3-.5.3-.5.8-1.5.1-.2 0-.4-.1-.5-.1-.2-.7-1.7-1-2.3-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.6.1-.8.4-.3.3-1 1-.9 2.4.1 1.5 1.2 3 1.4 3.2.2.2 2 3.1 4.9 4.2 2.4 1 2.4.8 2.8.7.5-.1 1.6-.6 1.8-1.3.2-.6.2-1.1.1-1.2-.1-.1-.3-.2-.6-.4z"/></svg>
    </a>
    <div class="overlay" id="cartOverlay"></div>
    <aside class="cart-drawer" id="cartDrawer">
      <div class="cart-head">
        <h3>Seu carrinho</h3>
        <button class="cart-close" id="cartClose" aria-label="Fechar carrinho">×</button>
      </div>
      <div class="cart-body" id="cartBody"></div>
      <div class="cart-foot" id="cartFoot"></div>
    </aside>
  `;

  document.getElementById("cartClose")?.addEventListener("click", () => Cart.close());
  document.getElementById("cartOverlay")?.addEventListener("click", () => Cart.close());
}

document.addEventListener("DOMContentLoaded", () => {
  renderHeader();
  renderFooter();
  Cart.refresh();
  trackOnce("visit", { type: "visit" });
  Api.get("/api/products/categories").then((categories) => {
    NAV_CATEGORIES = categories.map((cat) => ({ label: cat, cat }));
    const links = NAV_CATEGORIES.map((c) =>
      `<li><a href="/produtos.html?cat=${encodeURIComponent(c.cat)}">${c.label}</a></li>`
    ).join("");
    document.querySelector(".cat-drawer-list").innerHTML =
      '<li><a href="/produtos.html">Ver todos os produtos</a></li>' + links;
    document.getElementById("footerCategories").innerHTML = links;
  }).catch(console.error);
});
