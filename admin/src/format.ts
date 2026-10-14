export const brl = (v: number) =>
  (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const int = (v: number) => (v || 0).toLocaleString("pt-BR");

export const pct = (v: number | null) =>
  v == null ? "—" : (v * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + "%";

export const dateTime = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

export const shortDay = (day: string) => {
  const [, m, d] = day.split("-");
  return `${d}/${m}`;
};

/** Variação percentual entre o período atual e o anterior (null se não há base). */
export const delta = (now: number, before: number): number | null =>
  before > 0 ? (now - before) / before : null;

export const whatsappLink = (phone: string | undefined, text: string) => {
  const digits = (phone || "").replace(/\D/g, "");
  if (!digits) return "";
  const full = digits.length <= 11 ? `55${digits}` : digits;
  return `https://wa.me/${full}?text=${encodeURIComponent(text)}`;
};
