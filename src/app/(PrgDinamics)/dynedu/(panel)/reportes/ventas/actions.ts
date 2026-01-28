"use server";

import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type PaymentStatus =
  | "CREATED"
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "CANCELLED"
  | "REFUNDED";

export type FulfillmentStatus = "REGISTERED" | "PACKING" | "DELIVERY" | "DELIVERED";

export type SalesOverviewRow = {
  id: string;
  created_at: string;
  updated_at: string;

  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;

  shipping_district: string | null;
  shipping_address: string | null;

  currency: string | null;
  total: number | null;

  order_status: string;

  fulfillment_status: FulfillmentStatus;
  delivery_date: string | null;
  fulfillment_updated_at: string | null;

  payment_status: PaymentStatus | null;
  payment_provider: string | null;
  payment_id: string | null;
  preference_id: string | null;
  merchant_order_id: string | null;
  payment_amount: number | null;
  payment_updated_at: string | null;

  items_summary: string | null;
  items_units: number | null;
};

export async function fetchSalesOverview(): Promise<SalesOverviewRow[]> {
  const { data, error } = await supabaseAdmin
    .from("sales_overview_view")
    .select(
      [
        "id",
        "created_at",
        "updated_at",
        "customer_name",
        "customer_email",
        "customer_phone",
        "shipping_district",
        "shipping_address",
        "currency",
        "total",
        "order_status",
        "fulfillment_status",
        "delivery_date",
        "fulfillment_updated_at",
        "payment_status",
        "payment_provider",
        "payment_id",
        "preference_id",
        "merchant_order_id",
        "payment_amount",
        "payment_updated_at",
        "items_summary",
        "items_units",
      ].join(",")
    )
    .order("created_at", { ascending: false })
    .limit(1000)
    .returns<SalesOverviewRow[]>();

  if (error) {
    console.error("[fetchSalesOverview] error:", error.message);
    return [];
  }

  return data ?? [];
}

// ============================
// Sale detail (for /ventas/[id])
// ============================

export type OrderStatus = string;

export type OrderDetail = {
  id: string;
  created_at: string;
  updated_at: string;

  customer_name: string;
  customer_email: string;
  customer_phone: string;

  shipping_address: string;
  shipping_reference: string | null;
  shipping_district: string | null;
  shipping_notes: string | null;

  currency: string;
  subtotal: number;
  discount_code: string | null;
  discount_amount: number;
  total: number;

  status: OrderStatus;
};

export type OrderItemDetail = {
  id: number;
  order_id: string;
  producto_id: number | null;

  title_snapshot: string;
  codigo_venta_snapshot: string | null;

  quantity: number;
  unit_price: number;
  line_total: number;

  created_at: string;

  producto: {
    id: number;
    internal_id: string;
    descripcion: string;
  } | null;
};

export type PaymentDetail = {
  id: number;
  order_id: string;

  provider: string;
  status: PaymentStatus;

  preference_id: string | null;
  payment_id: string | null;
  merchant_order_id: string | null;

  amount: number;
  currency: string;

  created_at: string;
  updated_at: string | null;

  raw: any | null;
};

export type SaleDetail = {
  order: OrderDetail;
  items: OrderItemDetail[];
  payment: PaymentDetail | null;
};

export async function fetchSaleDetail(orderId: string): Promise<SaleDetail | null> {
  // 1) Order
  const { data: order, error: orderError } = await supabaseAdmin
    .from("orders")
    .select(
      [
        "id",
        "created_at",
        "updated_at",
        "customer_name",
        "customer_email",
        "customer_phone",
        "shipping_address",
        "shipping_reference",
        "shipping_district",
        "shipping_notes",
        "currency",
        "subtotal",
        "discount_code",
        "discount_amount",
        "total",
        "status",
      ].join(",")
    )
    .eq("id", orderId)
    .maybeSingle<OrderDetail>();

  if (orderError) {
    console.error("[fetchSaleDetail] order error:", orderError.message);
    return null;
  }
  if (!order) return null;

  // 2) Items
  const { data: items, error: itemsError } = await supabaseAdmin
    .from("order_items")
    .select(
      [
        "id",
        "order_id",
        "producto_id",
        "title_snapshot",
        "codigo_venta_snapshot",
        "quantity",
        "unit_price",
        "line_total",
        "created_at",
        "producto:productos(id,internal_id,descripcion)",
      ].join(",")
    )
    .eq("order_id", orderId)
    .order("created_at", { ascending: true })
    .returns<OrderItemDetail[]>();

  if (itemsError) {
    console.error("[fetchSaleDetail] items error:", itemsError.message);
  }

  // 3) Latest payment
  const { data: payment, error: payError } = await supabaseAdmin
    .from("payments")
    .select(
      [
        "id",
        "order_id",
        "provider",
        "status",
        "preference_id",
        "payment_id",
        "merchant_order_id",
        "amount",
        "currency",
        "created_at",
        "updated_at",
        "raw",
      ].join(",")
    )
    .eq("order_id", orderId)
    .order("updated_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle<PaymentDetail>();

  if (payError) {
    console.error("[fetchSaleDetail] payment error:", payError.message);
  }

  return {
    order,
    items: items ?? [],
    payment: payment ?? null,
  };
}
