/**
 * Métricas e sugestões do painel admin.
 *
 * As sugestões são regras simples sobre os dados da própria loja (vendas,
 * visualizações, estoque) e sobre o calendário de datas comerciais. Não há
 * consulta a preços de concorrentes ou tendências de mercado em tempo real.
 */
const store = require("../db/store");

const CONFIRMED = ["pago", "enviado", "entregue"];

const dayKey = (d) => {
  // Dia no fuso de São Paulo, formato AAAA-MM-DD.
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(d);
  return p;
};

function nthWeekdayOfMonth(year, month, weekday, n) {
  const first = new Date(Date.UTC(year, month, 1, 12));
  const offset = (weekday - first.getUTCDay() + 7) % 7;
  return new Date(Date.UTC(year, month, 1 + offset + (n - 1) * 7, 12));
}

// Próximas datas comerciais do varejo de moda no Brasil.
function upcomingDates(now = new Date()) {
  const y = now.getUTCFullYear();
  const list = [];
  for (const year of [y, y + 1]) {
    list.push(
      { name: "Dia das Mães", date: nthWeekdayOfMonth(year, 4, 0, 2), tip: "presentes, vestidos e conjuntos" },
      { name: "Dia dos Namorados", date: new Date(Date.UTC(year, 5, 12, 12)), tip: "looks para sair e peças de festa" },
      { name: "Dia dos Pais", date: nthWeekdayOfMonth(year, 7, 0, 2), tip: "foco em kits e combos" },
      { name: "Dia do Cliente", date: new Date(Date.UTC(year, 8, 15, 12)), tip: "cupom ou frete grátis" },
      { name: "Black Friday", date: nthWeekdayOfMonth(year, 10, 5, 4), tip: "maior data de promoção do ano" },
      { name: "Natal", date: new Date(Date.UTC(year, 11, 25, 12)), tip: "presentes e looks de festa" },
      { name: "Réveillon", date: new Date(Date.UTC(year, 11, 31, 12)), tip: "vestidos, cropped e brilho" }
    );
  }
  return list
    .map((e) => ({ ...e, days: Math.ceil((e.date - now) / 86400000) }))
    .filter((e) => e.days >= 0 && e.days <= 60)
    .sort((a, b) => a.days - b.days);
}

async function getStats(days = 30) {
  const now = new Date();
  const since = new Date(now.getTime() - days * 86400000);
  const [orders, events, catalog, sold] = await Promise.all([
    store.getOrdersSince(since),
    store.getEventCounts(since),
    Promise.resolve(store.getCatalog()),
    store.getSoldMap(),
  ]);

  const byId = new Map(catalog.map((p) => [p.id, p]));
  const stockLeft = (p) =>
    Object.entries(p.stock || {}).reduce(
      (sum, [size, q]) => sum + Math.max(0, q - (sold.get(`${p.id}|${size}`) || 0)),
      0
    );

  // ----- Pedidos -----
  const live = orders.filter((o) => o.status !== "cancelado");
  const confirmed = orders.filter((o) => CONFIRMED.includes(o.status));
  const sum = (list) => list.reduce((s, o) => s + (o.total || 0), 0);
  const statusCount = {};
  orders.forEach((o) => (statusCount[o.status] = (statusCount[o.status] || 0) + 1));

  // Série diária (receita dos pedidos não cancelados)
  const series = [];
  for (let i = days - 1; i >= 0; i--) {
    series.push({ day: dayKey(new Date(now.getTime() - i * 86400000)), orders: 0, revenue: 0 });
  }
  const seriesIdx = new Map(series.map((s, i) => [s.day, i]));
  live.forEach((o) => {
    const i = seriesIdx.get(dayKey(new Date(o.created_at)));
    if (i !== undefined) {
      series[i].orders++;
      series[i].revenue += o.total || 0;
    }
  });

  // ----- Produtos -----
  const perProduct = new Map();
  const slot = (id) => {
    if (!perProduct.has(id)) perProduct.set(id, { id, units: 0, revenue: 0, views: 0, carts: 0 });
    return perProduct.get(id);
  };
  live.forEach((o) =>
    o.items.forEach((i) => {
      const r = slot(i.productId);
      r.units += i.qty;
      r.revenue += i.qty * i.unitPrice;
    })
  );
  let visits = 0;
  events.forEach((e) => {
    if (e.type === "visit") visits += e.n;
    else if (e.type === "view" && e.productId) slot(e.productId).views += e.n;
    else if (e.type === "add_to_cart" && e.productId) slot(e.productId).carts += e.n;
  });

  const rows = catalog.map((p) => {
    const r = perProduct.get(p.id) || { units: 0, revenue: 0, views: 0, carts: 0 };
    return {
      id: p.id,
      name: p.name,
      category: p.category,
      image: p.image,
      price: p.price,
      onSale: Boolean(p.discount_pct),
      stock: stockLeft(p),
      units: r.units,
      revenue: r.revenue,
      views: r.views,
      carts: r.carts,
      conversion: r.views ? r.units / r.views : null,
    };
  });

  const top = (key, n = 10) =>
    rows.filter((r) => r[key] > 0).sort((a, b) => b[key] - a[key]).slice(0, n);

  // Categorias
  const cats = new Map();
  rows.forEach((r) => {
    const c = cats.get(r.category) || { category: r.category, units: 0, revenue: 0, views: 0 };
    c.units += r.units;
    c.revenue += r.revenue;
    c.views += r.views;
    cats.set(r.category, c);
  });

  // ----- Sugestões -----
  const suggestions = [];
  const money = (v) => `R$ ${v.toFixed(2).replace(".", ",")}`;

  rows
    .filter((r) => r.views >= 15 && r.units === 0 && r.stock > 0)
    .sort((a, b) => b.views - a.views)
    .slice(0, 5)
    .forEach((r) =>
      suggestions.push({
        type: "promo",
        title: `${r.name}: muito visto, nenhuma venda`,
        detail: `${r.views} visualizações e ${r.carts} no carrinho em ${days} dias, sem vendas. Teste um desconto de 10% a 15%, revise as fotos ou o preço (hoje ${money(r.price)}).`,
        productId: r.id,
      })
    );

  rows
    .filter((r) => r.carts >= 3 && r.units < r.carts / 2 && r.stock > 0)
    .slice(0, 3)
    .forEach((r) =>
      suggestions.push({
        type: "promo",
        title: `${r.name}: vai ao carrinho, mas não fecha`,
        detail: `${r.carts} adições ao carrinho e ${r.units} vendidas. Frete grátis ou um cupom pode destravar a compra.`,
        productId: r.id,
      })
    );

  rows
    .filter((r) => r.units >= 3 && r.stock > 0 && r.stock <= 5)
    .sort((a, b) => b.units - a.units)
    .slice(0, 5)
    .forEach((r) =>
      suggestions.push({
        type: "estoque",
        title: `${r.name}: vende bem e está acabando`,
        detail: `${r.units} vendidas e restam ${r.stock}. Reponha e evite promoção neste item.`,
        productId: r.id,
      })
    );

  rows
    .filter((r) => r.units === 0 && r.views < 5 && r.stock >= 10 && !r.onSale)
    .sort((a, b) => b.stock - a.stock)
    .slice(0, 5)
    .forEach((r) =>
      suggestions.push({
        type: "parado",
        title: `${r.name}: estoque parado`,
        detail: `${r.stock} unidades, ${r.views} visualizações e nenhuma venda. Considere destacar na home ou entrar num combo/queima de estoque.`,
        productId: r.id,
      })
    );

  const bestCat = [...cats.values()].filter((c) => c.revenue > 0).sort((a, b) => b.revenue - a.revenue)[0];
  if (bestCat) {
    suggestions.push({
      type: "destaque",
      title: `Categoria campeã: ${bestCat.category}`,
      detail: `${money(bestCat.revenue)} em ${bestCat.units} unidades. Dê destaque na home e nos anúncios.`,
    });
  }

  upcomingDates(now).slice(0, 3).forEach((e) =>
    suggestions.push({
      type: "calendario",
      title: `${e.name} em ${e.days} dia(s)`,
      detail: `Data de alta procura: ${e.tip}. Planeje campanha e estoque com antecedência.`,
    })
  );

  const dataPoor = orders.length < 10 && visits < 100;

  return {
    days,
    generatedAt: now.toISOString(),
    dataPoor,
    summary: {
      orders: live.length,
      revenueAll: sum(live),
      revenueConfirmed: sum(confirmed),
      revenuePending: sum(orders.filter((o) => o.status === "aguardando_pagamento")),
      avgTicket: live.length ? sum(live) / live.length : 0,
      units: live.reduce((s, o) => s + o.items.reduce((a, i) => a + i.qty, 0), 0),
      cancelled: statusCount.cancelado || 0,
      visits,
      conversion: visits ? live.length / visits : null,
      statusCount,
    },
    series,
    topSold: top("units"),
    topRevenue: top("revenue"),
    topViewed: top("views"),
    topCarted: top("carts"),
    lowStock: rows.filter((r) => r.stock <= 3).sort((a, b) => a.stock - b.stock).slice(0, 15),
    categories: [...cats.values()].sort((a, b) => b.revenue - a.revenue),
    suggestions,
  };
}

module.exports = { getStats };
