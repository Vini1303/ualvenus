// Pequeno wrapper pra falar com o backend. Todas as páginas usam isso.
const Api = {
  async get(path) {
    const res = await fetch(path, { credentials: "include" });
    if (!res.ok) throw await Api._error(res);
    return res.json();
  },
  async post(path, body) {
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body),
    });
    if (!res.ok) throw await Api._error(res);
    return res.json();
  },
  async patch(path, body) {
    const res = await fetch(path, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body),
    });
    if (!res.ok) throw await Api._error(res);
    return res.json();
  },
  async del(path, body) {
    const res = await fetch(path, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body),
    });
    if (!res.ok) throw await Api._error(res);
    return res.json();
  },
  async _error(res) {
    try {
      const data = await res.json();
      return new Error(data.error || "Erro inesperado");
    } catch {
      return new Error("Erro inesperado");
    }
  },
};

function formatBRL(value) {
  return (value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function showToast(message) {
  let toast = document.querySelector(".toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.className = "toast";
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove("show"), 2200);
}

// Evento anônimo para o painel do lojista; no máximo 1x por sessão e item.
function trackOnce(key, body) {
  try {
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
  } catch (e) {}
  fetch("/api/track", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    keepalive: true,
  }).catch(() => {});
}
