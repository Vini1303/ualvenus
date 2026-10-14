import { useCallback, useEffect, useState } from "react";
import { api, AuthError, tokenStore } from "./api";
import type { Order, OrderStatus, Stats } from "./types";
import { Login } from "./Login";
import { Inventory, OrderDrawer, Orders, Overview, Products, Suggestions } from "./views";
import { Icon, Notice, Segmented, Skeleton } from "./ui";

type Tab = "geral" | "pedidos" | "produtos" | "estoque" | "sugestoes";

const TABS: { id: Tab; label: string; icon: string; title: string }[] = [
  { id: "geral", label: "Visão geral", icon: "home", title: "Visão geral" },
  { id: "pedidos", label: "Pedidos", icon: "bag", title: "Pedidos" },
  { id: "produtos", label: "Produtos", icon: "box", title: "Produtos e interesse" },
  { id: "estoque", label: "Estoque", icon: "layers", title: "Estoque" },
  { id: "sugestoes", label: "Sugestões", icon: "bulb", title: "Sugestões" },
];

export default function App() {
  const [token, setToken] = useState(tokenStore.get());
  const [loginError, setLoginError] = useState("");
  const [tab, setTab] = useState<Tab>("geral");
  const [days, setDays] = useState(30);
  const [stats, setStats] = useState<Stats | null>(null);
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ text: string; err?: boolean } | null>(null);

  const logout = useCallback((msg = "") => {
    tokenStore.clear();
    setToken("");
    setStats(null);
    setOrders(null);
    setLoginError(msg);
  }, []);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      const [s, o] = await Promise.all([api.stats(token, days), api.orders(token)]);
      setStats(s);
      setOrders(o);
    } catch (err) {
      if (err instanceof AuthError) logout("Token inválido, ou o painel está desativado (ADMIN_TOKEN não definido no servidor).");
      else setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [token, days, logout]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpenId(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function changeStatus(id: string, status: OrderStatus) {
    if (status === "cancelado" && !window.confirm(`Cancelar o pedido ${id}? O estoque será devolvido.`)) return;
    setBusy(true);
    try {
      await api.setStatus(token, id, status);
      setToast({ text: "Status atualizado" });
      await load();
    } catch (err) {
      if (err instanceof AuthError) logout("Sessão expirada.");
      else setToast({ text: (err as Error).message, err: true });
    } finally {
      setBusy(false);
    }
  }

  if (!token) {
    return (
      <Login
        error={loginError}
        onSubmit={(t) => {
          tokenStore.set(t);
          setLoginError("");
          setToken(t);
        }}
      />
    );
  }

  const current = TABS.find((t) => t.id === tab)!;
  const pendingCount = stats?.summary.statusCount.aguardando_pagamento || 0;
  const openOrder = orders?.find((o) => o.id === openId) || null;

  return (
    <div className="shell">
      <aside className="side">
        <div className="brand">
          <div className="brand-mark">V</div>
          <div>
            <b>Vênus</b>
            <span>Painel do lojista</span>
          </div>
        </div>
        <nav className="nav">
          {TABS.map((t) => (
            <button key={t.id} className={tab === t.id ? "on" : ""} onClick={() => setTab(t.id)}>
              <Icon name={t.icon} />
              {t.label}
              {t.id === "pedidos" && pendingCount > 0 && <span className="count">{pendingCount}</span>}
            </button>
          ))}
        </nav>
        <div className="side-foot">
          <a href="/" target="_blank" rel="noopener noreferrer">Ver a loja ↗</a>
        </div>
      </aside>

      <div className="main">
        <div className="topbar">
          <div>
            <h1>{current.title}</h1>
            <div className="sub">
              {stats ? `Atualizado às ${new Date(stats.generatedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}` : "Carregando…"}
            </div>
          </div>
          <div className="tools">
            {tab !== "pedidos" && tab !== "estoque" && (
              <Segmented
                value={days}
                onChange={setDays}
                options={[{ value: 7, label: "7 dias" }, { value: 30, label: "30 dias" }, { value: 90, label: "90 dias" }, { value: 365, label: "1 ano" }]}
              />
            )}
            <button className="btn" onClick={load} disabled={loading}><Icon name="refresh" /> {loading ? "Atualizando" : "Atualizar"}</button>
            <button className="btn ghost" onClick={() => logout()}><Icon name="logout" /> Sair</button>
          </div>
        </div>

        {error && <div className="content"><Notice error>{error}</Notice></div>}
        {!stats || !orders ? (
          error ? null : <Skeleton />
        ) : tab === "geral" ? (
          <Overview stats={stats} />
        ) : tab === "pedidos" ? (
          <Orders orders={orders} onOpen={(o) => setOpenId(o.id)} />
        ) : tab === "produtos" ? (
          <Products stats={stats} />
        ) : tab === "estoque" ? (
          <Inventory stats={stats} />
        ) : (
          <Suggestions stats={stats} />
        )}
      </div>

      {openOrder && <OrderDrawer order={openOrder} busy={busy} onClose={() => setOpenId(null)} onStatus={changeStatus} />}
      {toast && <div className={`toast ${toast.err ? "err" : ""}`} role="status">{toast.text}</div>}
    </div>
  );
}
