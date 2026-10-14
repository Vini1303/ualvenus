import { useMemo, useRef, useState } from "react";
import type { DayPoint } from "./types";
import { brl, shortDay } from "./format";

type Mode = "revenue" | "orders";

const W = 800;
const H = 260;
const PAD = { l: 52, r: 12, t: 12, b: 28 };

function niceMax(v: number) {
  if (v <= 0) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / pow;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * pow;
}

export function AreaChart({ data, mode }: { data: DayPoint[]; mode: Mode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<number | null>(null);

  const { pts, max, line, area, ticks } = useMemo(() => {
    const values = data.map((d) => (mode === "revenue" ? d.revenue : d.orders));
    const max = niceMax(Math.max(...values, 0));
    const iw = W - PAD.l - PAD.r;
    const ih = H - PAD.t - PAD.b;
    const x = (i: number) => PAD.l + (data.length <= 1 ? iw / 2 : (i / (data.length - 1)) * iw);
    const y = (v: number) => PAD.t + ih - (v / max) * ih;
    const pts = values.map((v, i) => ({ x: x(i), y: y(v), v }));
    const line = pts.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
    const area = pts.length
      ? `${line} L${pts[pts.length - 1].x.toFixed(1)},${H - PAD.b} L${pts[0].x.toFixed(1)},${H - PAD.b} Z`
      : "";
    const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => ({ y: y(max * f), label: max * f }));
    return { pts, max, line, area, ticks };
  }, [data, mode]);

  const fmt = (v: number) =>
    mode === "revenue"
      ? v >= 1000
        ? `R$ ${(v / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil`
        : `R$ ${Math.round(v)}`
      : String(Math.round(v));

  function onMove(e: React.MouseEvent) {
    const box = ref.current?.getBoundingClientRect();
    if (!box || !pts.length) return;
    const px = ((e.clientX - box.left) / box.width) * W;
    let best = 0;
    let dist = Infinity;
    pts.forEach((p, i) => {
      const d = Math.abs(p.x - px);
      if (d < dist) {
        dist = d;
        best = i;
      }
    });
    setHover(best);
  }

  const step = Math.max(1, Math.ceil(data.length / 7));
  const hp = hover != null ? pts[hover] : null;
  const hd = hover != null ? data[hover] : null;

  return (
    <div className="chart" ref={ref} onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label="Gráfico por dia">
        <defs>
          <linearGradient id="fillGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--chart)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--chart)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <g className="grid">
          {ticks.map((t, i) => (
            <g key={i}>
              <line x1={PAD.l} x2={W - PAD.r} y1={t.y} y2={t.y} />
              <text x={PAD.l - 8} y={t.y + 4} textAnchor="end">
                {fmt(t.label)}
              </text>
            </g>
          ))}
        </g>
        {data.map((d, i) =>
          i % step === 0 ? (
            <text key={d.day} x={pts[i].x} y={H - 8} textAnchor="middle">
              {shortDay(d.day)}
            </text>
          ) : null
        )}
        {max > 0 && <path d={area} fill="url(#fillGrad)" />}
        <path d={line} fill="none" stroke="var(--chart)" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        {hp && (
          <g>
            <line x1={hp.x} x2={hp.x} y1={PAD.t} y2={H - PAD.b} stroke="var(--muted)" strokeDasharray="3 3" strokeOpacity=".6" />
            <circle cx={hp.x} cy={hp.y} r="5" fill="var(--surface)" stroke="var(--chart)" strokeWidth="2.5" />
          </g>
        )}
      </svg>
      {hp && hd && (
        <div className="tip" style={{ left: `${(hp.x / W) * 100}%`, top: `${(hp.y / H) * 100}%` }}>
          <b>{mode === "revenue" ? brl(hd.revenue) : `${hd.orders} pedido(s)`}</b>
          {shortDay(hd.day)} · {mode === "revenue" ? `${hd.orders} pedido(s)` : brl(hd.revenue)}
        </div>
      )}
    </div>
  );
}
