import type { ReactNode } from "react";
import type { OrderStatus } from "./types";
import { delta as calcDelta } from "./format";

const paths: Record<string, ReactNode> = {
  home: <path d="M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10" />,
  bag: <path d="M6 7h12l1 13H5L6 7zM9 7a3 3 0 016 0" />,
  box: <path d="M21 8l-9-5-9 5v8l9 5 9-5V8zM3 8l9 5 9-5M12 13v8" />,
  bulb: <path d="M9 18h6M10 21h4M12 3a6 6 0 00-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0012 3z" />,
  money: <path d="M12 2v20M17 6.5C16 5.5 14.2 5 12 5c-2.8 0-4.5 1.2-4.5 3s1.7 2.6 4.5 3 4.5 1.2 4.5 3-1.7 3-4.5 3c-2.2 0-4-.6-5-1.6" />,
  check: <path d="M20 6L9 17l-5-5" />,
  clock: <path d="M12 7v5l3 2M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />,
  receipt: <path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3zM9 8h6M9 12h6" />,
  users: <path d="M16 20v-2a4 4 0 00-4-4H7a4 4 0 00-4 4v2M9.5 10a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM21 20v-2a4 4 0 00-3-3.9M16 3.1a3.5 3.5 0 010 6.8" />,
  trend: <path d="M3 17l6-6 4 4 8-8M15 7h6v6" />,
  refresh: <path d="M20 11a8 8 0 00-14.9-3M4 4v4h4M4 13a8 8 0 0014.9 3M20 20v-4h-4" />,
  logout: <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />,
  alert: <path d="M12 9v4M12 17h.01M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" />,
  inbox: <path d="M22 12h-6l-2 3h-4l-2-3H2M5.5 5h13L22 12v6a2 2 0 01-2 2H4a2 2 0 01-2-2v-6l3.5-7z" />,
  x: <path d="M18 6L6 18M6 6l12 12" />,
  whatsapp: <path d="M21 12a9 9 0 01-13.4 7.8L3 21l1.3-4.4A9 9 0 1121 12zM9 8c0 4 3 7 7 7l1.5-1.5-2-1-1 .8c-1-.4-2-1.4-2.4-2.4l.8-1-1-2L9 8z" />,
};

export function Icon({ name }: { name: keyof typeof paths | string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name]}
    </svg>
  );
}

export const STATUS_LABEL: Record<OrderStatus, string> = {
  aguardando_pagamento: "Aguardando pagamento",
  pago: "Pago",
  enviado: "Enviado",
  entregue: "Entregue",
  cancelado: "Cancelado",
};

export const STATUS_ORDER: OrderStatus[] = ["aguardando_pagamento", "pago", "enviado", "entregue", "cancelado"];

export const STATUS_COLOR: Record<OrderStatus, string> = {
  aguardando_pagamento: "var(--warn)",
  pago: "var(--ok)",
  enviado: "var(--info)",
  entregue: "var(--purple)",
  cancelado: "var(--bad)",
};

export function StatusBadge({ status }: { status: OrderStatus }) {
  return <span className={`badge ${status}`}>{STATUS_LABEL[status] ?? status}</span>;
}

export function Delta({ now, before, suffix }: { now: number; before: number; suffix?: string }) {
  const d = calcDelta(now, before);
  if (d == null) return <span className="muted">{suffix ? "sem período anterior para comparar" : ""}</span>;
  const cls = Math.abs(d) < 0.005 ? "flat" : d > 0 ? "up" : "down";
  const arrow = cls === "flat" ? "•" : d > 0 ? "▲" : "▼";
  return (
    <span className={`delta ${cls}`}>
      {arrow} {Math.abs(d * 100).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}%
      {suffix && <span className="muted" style={{ fontWeight: 400 }}> {suffix}</span>}
    </span>
  );
}

export function Kpi(props: {
  label: string;
  value: string;
  icon: string;
  tone?: "brand" | "ok" | "info" | "warn";
  foot?: ReactNode;
}) {
  return (
    <div className="card kpi">
      <div className="kpi-top">
        <span>{props.label}</span>
        <span className={`kpi-icon ${props.tone ?? ""}`}>
          <Icon name={props.icon} />
        </span>
      </div>
      <div className="kpi-value num">{props.value}</div>
      <div className="kpi-foot">{props.foot}</div>
    </div>
  );
}

export function Card(props: { title?: string; subtitle?: string; right?: ReactNode; children: ReactNode }) {
  return (
    <section className="card card-pad">
      {(props.title || props.right) && (
        <div className="card-head">
          <div>
            <h2>{props.title}</h2>
            {props.subtitle && <p>{props.subtitle}</p>}
          </div>
          {props.right}
        </div>
      )}
      {props.children}
    </section>
  );
}

export function Empty({ text, icon = "inbox" }: { text: string; icon?: string }) {
  return (
    <div className="empty">
      <Icon name={icon} />
      <p>{text}</p>
    </div>
  );
}

export function Thumb({ src }: { src?: string }) {
  return src ? <img src={src} alt="" loading="lazy" className="thumb" /> : <span className="thumb" />;
}

export function Segmented<T extends string | number>(props: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="seg" role="tablist">
      {props.options.map((o) => (
        <button key={String(o.value)} className={o.value === props.value ? "on" : ""} onClick={() => props.onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Skeleton() {
  return (
    <div className="content">
      <div className="kpis">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="skel" style={{ height: 112 }} />
        ))}
      </div>
      <div className="skel" style={{ height: 340 }} />
      <div className="grid-2">
        <div className="skel" style={{ height: 280 }} />
        <div className="skel" style={{ height: 280 }} />
      </div>
    </div>
  );
}

export function Notice({ children, error }: { children: ReactNode; error?: boolean }) {
  return (
    <div className={`notice ${error ? "err" : ""}`}>
      <Icon name="alert" />
      <div>{children}</div>
    </div>
  );
}
