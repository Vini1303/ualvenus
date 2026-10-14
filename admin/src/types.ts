export type OrderStatus = "aguardando_pagamento" | "pago" | "enviado" | "entregue" | "cancelado";

export interface Summary {
  orders: number;
  revenueAll: number;
  revenueConfirmed: number;
  revenuePending: number;
  avgTicket: number;
  units: number;
  cancelled: number;
  visits: number;
  conversion: number | null;
  statusCount: Partial<Record<OrderStatus, number>>;
  prev: { orders: number; revenueAll: number };
}

export interface DayPoint {
  day: string;
  orders: number;
  revenue: number;
}

export interface ProductRow {
  id: string;
  name: string;
  category: string;
  image: string;
  price: number;
  onSale: boolean;
  available: boolean;
  stock: number;
  units: number;
  revenue: number;
  views: number;
  carts: number;
  conversion: number | null;
}

export interface CategoryRow {
  category: string;
  units: number;
  revenue: number;
  views: number;
}

export type SuggestionType = "promo" | "estoque" | "parado" | "destaque" | "calendario";

export interface Suggestion {
  type: SuggestionType;
  title: string;
  detail: string;
  productId?: string;
}

export interface Stats {
  days: number;
  generatedAt: string;
  dataPoor: boolean;
  summary: Summary;
  series: DayPoint[];
  topSold: ProductRow[];
  topRevenue: ProductRow[];
  topViewed: ProductRow[];
  topCarted: ProductRow[];
  lowStock: ProductRow[];
  categories: CategoryRow[];
  suggestions: Suggestion[];
}

export interface OrderItem {
  productId: string;
  name: string;
  image?: string;
  size: string;
  color?: string | null;
  qty: number;
  unitPrice: number;
}

export interface Order {
  id: string;
  status: OrderStatus;
  created_at: string;
  total: number;
  subtotal: number;
  paymentMethod?: string;
  items: OrderItem[];
  shipping?: { cost?: number; free?: boolean; label?: string; days?: string };
  customer?: { name?: string; email?: string; phone?: string };
  address?: {
    cep?: string;
    street?: string;
    number?: string;
    complement?: string;
    neighborhood?: string;
    city?: string;
    state?: string;
  };
}
