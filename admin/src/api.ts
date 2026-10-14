import type { Order, OrderStatus, Stats } from "./types";

const KEY = "venus-admin-token";

export class AuthError extends Error {}

export const tokenStore = {
  get(): string {
    try {
      return sessionStorage.getItem(KEY) || "";
    } catch {
      return "";
    }
  },
  set(value: string) {
    try {
      sessionStorage.setItem(KEY, value);
    } catch {
      /* sem storage: o token vale só nesta aba */
    }
  },
  clear() {
    try {
      sessionStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
  },
};

async function request<T>(path: string, token: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", "x-admin-token": token },
  });
  if (res.status === 401) throw new AuthError("Token inválido");
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || `Erro ${res.status}`);
  return data as T;
}

export const api = {
  stats: (token: string, days: number) => request<Stats>(`/api/admin/stats?days=${days}`, token),
  orders: (token: string) => request<Order[]>("/api/admin/orders", token),
  setStatus: (token: string, id: string, status: OrderStatus) =>
    request<Order>(`/api/admin/orders/${encodeURIComponent(id)}`, token, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),
};
