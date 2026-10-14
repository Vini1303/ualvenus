import { useMemo, useState } from "react";
import type { Order, OrderStatus, ProductRow, Stats } from "./types";
import { AreaChart } from "./Chart";
import { brl, dateTime, int, pct, whatsappLink } from "./format";
import {
  Card, Delta, Empty, Icon, Kpi, Notice, Segmented, StatusBadge, STATUS_COLOR, STATUS_LABEL, STATUS_ORDER, Thumb,
} from "./ui";

function Prod({ p, extra }: { p: ProductRow; extra?: string }) {
  return (
    <div className="prod">
      <Thumb src={p.image} />
      <div>
        <b>{p.name}</b>
        <small>{extra ?? p.category}</small>
      </div>
    </div>
  );
}

function Table({ head, children }: { head: { label: string; right?: boolean }[]; children: React.ReactNode }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {head.map((h) => (
              <th key={h.label} className={h.right ? "r" : ""}>{h.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

/* ---------------- Visão geral ---------------- */
export function Overview({ stats }: { stats: Stats }) {
  const s = stats.summary;
  const [mode, setMode] = useState<"revenue" | "orders">("revenue");
  const maxUnits = Math.max(1, ...stats.topSold.map((p) => p.units));
  const maxCat = Math.max(1, ...stats.categories.map((c) => c.revenue));
  const totalStatus = Object.values(s.statusCount).reduce((a, b) => a + (b || 0), 0);

  return (
    <div className="content">
      {stats.dataPoor && (
        <Notice>Ainda há poucos dados neste período. Os números e as sugestões ficam mais úteis conforme a loja recebe visitas e pedidos.</Notice>
      )}
      <div className="kpis">
        <Kpi label="Faturamento" value={brl(s.revenueAll)} icon="money" tone="brand"
          foot={<Delta now={s.revenueAll} before={s.prev.revenueAll} suffix="vs. período anterior" />} />
        <Kpi label="Pedidos" value={int(s.orders)} icon="bag" tone="info"
          foot={<><Delta now={s.orders} before={s.prev.orders} /> <span>{int(s.units)} unidades</span></>} />
        <Kpi label="Ticket médio" value={brl(s.avgTicket)} icon="receipt" foot="por pedido" />
        <Kpi label="Conversão" value={pct(s.conversion)} icon="trend" tone="ok" foot={`${int(s.visits)} visitantes`} />
        <Kpi label="Pago e confirmado" value={brl(s.revenueConfirmed)} icon="check" tone="ok" foot="pago, enviado ou entregue" />
        <Kpi label="A receber" value={brl(s.revenuePending)} icon="clock" tone="warn" foot={`${s.statusCount.aguardando_pagamento || 0} aguardando pagamento`} />
        <Kpi label="Cancelados" value={int(s.cancelled)} icon="x" foot="inclui os sem pagamento em 2h" />
        <Kpi label="Visitantes" value={int(s.visits)} icon="users" foot="sessões no site" />
      </div>

      <Card
        title={mode === "revenue" ? "Faturamento por dia" : "Pedidos por dia"}
        subtitle={`Últimos ${stats.days} dias, sem pedidos cancelados`}
        right={<Segmented value={mode} onChange={setMode} options={[{ value: "revenue", label: "Faturamento" }, { value: "orders", label: "Pedidos" }]} />}
      >
        <AreaChart data={stats.series} mode={mode} />
      </Card>

      <div className="grid-21">
        <Card title="Mais vendidos" subtitle="Por unidades vendidas">
          {stats.topSold.length ? (
            <Table head={[{ label: "Produto" }, { label: "Vendas" }, { label: "Un.", right: true }, { label: "Receita", right: true }]}>
              {stats.topSold.map((p) => (
                <tr key={p.id}>
                  <td><Prod p={p} /></td>
                  <td><div className="bar-cell"><div className="bar"><i style={{ width: `${(p.units / maxUnits) * 100}%` }} /></div></div></td>
                  <td className="r num">{p.units}</td>
                  <td className="r num">{brl(p.revenue)}</td>
                </tr>
              ))}
            </Table>
          ) : (
            <Empty text="Nenhuma venda no período." />
          )}
        </Card>

        <div style={{ display: "grid", gap: 18, alignContent: "start" }}>
          <Card title="Pedidos por status">
            {totalStatus ? (
              <>
                <div className="stack">
                  {STATUS_ORDER.map((st) => {
                    const n = s.statusCount[st] || 0;
                    return n ? <i key={st} title={STATUS_LABEL[st]} style={{ width: `${(n / totalStatus) * 100}%`, background: STATUS_COLOR[st] }} /> : null;
                  })}
                </div>
                <div className="legend">
                  {STATUS_ORDER.map((st) => (
                    <div key={st}>
                      <span><i className="dot" style={{ background: STATUS_COLOR[st] }} />{STATUS_LABEL[st]}</span>
                      <b className="num">{s.statusCount[st] || 0}</b>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <Empty text="Sem pedidos no período." />
            )}
          </Card>

          <Card title="Categorias" subtitle="Receita no período">
            {stats.categories.some((c) => c.revenue || c.views) ? (
              <div className="legend" style={{ marginTop: 0 }}>
                {stats.categories.filter((c) => c.revenue || c.views).slice(0, 8).map((c) => (
                  <div key={c.category} className="cat-row">
                    <div className="row"><span>{c.category}</span><b className="num">{brl(c.revenue)}</b></div>
                    <div className="bar"><i style={{ width: `${(c.revenue / maxCat) * 100}%` }} /></div>
                  </div>
                ))}
              </div>
            ) : (
              <Empty text="Sem dados ainda." />
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Pedidos ---------------- */
export function Orders({ orders, onOpen }: { orders: Order[]; onOpen: (o: Order) => void }) {
  const [filter, setFilter] = useState<OrderStatus | "todos">("todos");
  const [q, setQ] = useState("");

  const counts = useMemo(() => {
    const c: Partial<Record<OrderStatus, number>> = {};
    orders.forEach((o) => (c[o.status] = (c[o.status] || 0) + 1));
    return c;
  }, [orders]);

  const list = orders.filter((o) => {
    if (filter !== "todos" && o.status !== filter) return false;
    const needle = q.trim().toLowerCase();
    if (!needle) return true;
    return [o.id, o.customer?.name, o.customer?.phone, o.customer?.email].some((v) => (v || "").toLowerCase().includes(needle));
  });

  return (
    <div className="content">
      <Card>
        <div className="filters">
          <div className="chips">
            <button className={`chip ${filter === "todos" ? "on" : ""}`} onClick={() => setFilter("todos")}>
              Todos<small>{orders.length}</small>
            </button>
            {STATUS_ORDER.map((st) => (
              <button key={st} className={`chip ${filter === st ? "on" : ""}`} onClick={() => setFilter(st)}>
                {STATUS_LABEL[st]}<small>{counts[st] || 0}</small>
              </button>
            ))}
          </div>
          <input className="search" placeholder="Buscar por pedido, nome ou telefone" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {list.length ? (
          <Table head={[{ label: "Pedido" }, { label: "Data" }, { label: "Cliente" }, { label: "Itens", right: true }, { label: "Total", right: true }, { label: "Status" }]}>
            {list.map((o) => (
              <tr key={o.id} className="click" onClick={() => onOpen(o)}>
                <td><b>{o.id}</b></td>
                <td className="muted">{dateTime(o.created_at)}</td>
                <td>{o.customer?.name || "—"}<br /><small className="muted">{o.customer?.phone}</small></td>
                <td className="r num">{o.items.reduce((a, i) => a + i.qty, 0)}</td>
                <td className="r num"><b>{brl(o.total)}</b></td>
                <td><StatusBadge status={o.status} /></td>
              </tr>
            ))}
          </Table>
        ) : (
          <Empty text={orders.length ? "Nenhum pedido com esse filtro." : "Nenhum pedido ainda. Eles aparecem aqui assim que alguém comprar."} />
        )}
      </Card>
    </div>
  );
}

export function OrderDrawer(props: {
  order: Order;
  busy: boolean;
  onClose: () => void;
  onStatus: (id: string, status: OrderStatus) => void;
}) {
  const { order: o } = props;
  const a = o.address || {};
  const wa = whatsappLink(o.customer?.phone, `Olá ${o.customer?.name || ""}! Sobre o seu pedido ${o.id} na Vênus.`);

  return (
    <>
      <div className="drawer-bg" onClick={props.onClose} />
      <aside className="drawer" role="dialog" aria-label={`Pedido ${o.id}`}>
        <header>
          <div>
            <h2 style={{ fontSize: 18 }}>{o.id}</h2>
            <p className="muted" style={{ marginTop: 2 }}>{dateTime(o.created_at)}</p>
          </div>
          <button className="btn ghost" onClick={props.onClose} aria-label="Fechar"><Icon name="x" /></button>
        </header>

        <section>
          <h3>Status</h3>
          <select className="status" value={o.status} disabled={props.busy} onChange={(e) => props.onStatus(o.id, e.target.value as OrderStatus)}>
            {STATUS_ORDER.map((st) => <option key={st} value={st}>{STATUS_LABEL[st]}</option>)}
          </select>
          {o.status === "aguardando_pagamento" && <p className="muted">Cancelado automaticamente se o pagamento não for confirmado a tempo.</p>}
        </section>

        <section>
          <h3>Cliente</h3>
          <div><b>{o.customer?.name}</b></div>
          <div className="muted">{o.customer?.email}</div>
          <div className="muted">{o.customer?.phone}</div>
          {wa && <a className="btn" href={wa} target="_blank" rel="noopener noreferrer" style={{ justifySelf: "start" }}><Icon name="whatsapp" /> Chamar no WhatsApp</a>}
        </section>

        <section>
          <h3>Entrega</h3>
          <div>{a.street}, {a.number}{a.complement ? ` — ${a.complement}` : ""}</div>
          <div className="muted">{a.neighborhood} · {a.city}/{a.state} · CEP {a.cep}</div>
          {o.shipping?.days && <div className="muted">Prazo estimado: {o.shipping.days} dias úteis</div>}
        </section>

        <section>
          <h3>Itens</h3>
          {o.items.map((i, idx) => (
            <div className="item" key={idx}>
              <Thumb src={i.image} />
              <div style={{ flex: 1 }}>
                <b>{i.name}</b>
                <div className="muted">Tam. {i.size}{i.color ? ` · ${i.color}` : ""} · {i.qty}×</div>
              </div>
              <b className="num">{brl(i.qty * i.unitPrice)}</b>
            </div>
          ))}
          <div className="row muted"><span>Subtotal</span><span className="num">{brl(o.subtotal)}</span></div>
          <div className="row muted"><span>Frete</span><span className="num">{o.shipping?.cost ? brl(o.shipping.cost) : "Grátis"}</span></div>
          <div className="row"><b>Total</b><b className="num">{brl(o.total)}</b></div>
        </section>
      </aside>
    </>
  );
}

/* ---------------- Produtos ---------------- */
export function Products({ stats }: { stats: Stats }) {
  return (
    <div className="content">
      <div className="grid-2">
        <Card title="Mais visualizados" subtitle="Interesse e conversão em venda">
          {stats.topViewed.length ? (
            <Table head={[{ label: "Produto" }, { label: "Views", right: true }, { label: "Carrinho", right: true }, { label: "Vendas", right: true }, { label: "Conv.", right: true }]}>
              {stats.topViewed.map((p) => (
                <tr key={p.id}>
                  <td><Prod p={p} /></td>
                  <td className="r num">{p.views}</td>
                  <td className="r num">{p.carts}</td>
                  <td className="r num">{p.units}</td>
                  <td className="r num">{pct(p.conversion)}</td>
                </tr>
              ))}
            </Table>
          ) : (
            <Empty text="As visualizações começam a aparecer conforme os clientes navegam." />
          )}
        </Card>
        <Card title="Mais adicionados ao carrinho" subtitle="Intenção de compra">
          {stats.topCarted.length ? (
            <Table head={[{ label: "Produto" }, { label: "Carrinho", right: true }, { label: "Vendas", right: true }]}>
              {stats.topCarted.map((p) => (
                <tr key={p.id}>
                  <td><Prod p={p} /></td>
                  <td className="r num">{p.carts}</td>
                  <td className="r num">{p.units}</td>
                </tr>
              ))}
            </Table>
          ) : (
            <Empty text="Ainda sem dados de carrinho." />
          )}
        </Card>
      </div>

      <Card title="Estoque baixo" subtitle="Produtos com 3 unidades ou menos">
        {stats.lowStock.length ? (
          <Table head={[{ label: "Produto" }, { label: "Estoque", right: true }, { label: "Vendidos", right: true }, { label: "Preço", right: true }]}>
            {stats.lowStock.map((p) => (
              <tr key={p.id}>
                <td><Prod p={p} /></td>
                <td className="r"><span className={`badge plain ${p.stock === 0 ? "low" : "mid"}`}>{p.stock === 0 ? "Esgotado" : `${p.stock} un.`}</span></td>
                <td className="r num">{p.units}</td>
                <td className="r num">{brl(p.price)}</td>
              </tr>
            ))}
          </Table>
        ) : (
          <Empty icon="check" text="Nenhum produto com estoque baixo." />
        )}
      </Card>
    </div>
  );
}

/* ---------------- Sugestões ---------------- */
const SUG_LABEL = { promo: "Promoção", estoque: "Reposição", parado: "Estoque parado", destaque: "Destaque", calendario: "Calendário" } as const;

export function Suggestions({ stats }: { stats: Stats }) {
  return (
    <div className="content">
      <p className="muted">
        Sugestões geradas por regras sobre as vendas, visualizações e estoque da sua loja e pelo calendário de datas comerciais. Elas não consultam
        preços de concorrentes nem tendências de mercado em tempo real.
      </p>
      {stats.suggestions.length ? (
        <div className="sug-grid">
          {stats.suggestions.map((s, i) => (
            <article key={i} className={`card sug ${s.type}`}>
              <span className={`tag ${s.type}`}>{SUG_LABEL[s.type] ?? s.type}</span>
              <b>{s.title}</b>
              <p>{s.detail}</p>
            </article>
          ))}
        </div>
      ) : (
        <Card><Empty icon="bulb" text="Nenhuma sugestão por enquanto. Elas aparecem conforme a loja ganha movimento." /></Card>
      )}
    </div>
  );
}
