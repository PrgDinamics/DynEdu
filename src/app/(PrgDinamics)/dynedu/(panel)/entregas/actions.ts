"use server";

import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type FulfillmentStatus = "REGISTERED" | "PACKING" | "DELIVERY" | "DELIVERED";

export type DeliveryOrderRow = {
  id: string;
  customer_name: string | null;
  customer_phone: string | null;
  shipping_district: string | null;
  shipping_address: string | null;
  total: number | null;
  currency: string | null;

  status: string;

  fulfillment_status: FulfillmentStatus;
  delivery_date: string | null; // YYYY-MM-DD
  fulfillment_note: string | null;
  fulfillment_updated_at: string | null;
  created_at: string;
};

export async function fetchDeliveryOrders(): Promise<DeliveryOrderRow[]> {
  const { data, error } = await supabaseAdmin
    .from("orders")
    .select(
      [
        "id",
        "customer_name",
        "customer_phone",
        "shipping_district",
        "shipping_address",
        "total",
        "currency",
        "status",
        "fulfillment_status",
        "delivery_date",
        "fulfillment_note",
        "fulfillment_updated_at",
        "created_at",
      ].join(",")
    )
    .order("created_at", { ascending: false })
    .limit(300);

  if (error) {
    console.error("[fetchDeliveryOrders] error:", error.message);
    return [];
  }

  // TS fix: supabaseAdmin typing may infer data as GenericStringError[]
  const rows = (data ?? []) as unknown as DeliveryOrderRow[];

  // Optional normalization (safe defaults)
  return rows.map((r) => ({
    ...r,
    status: r.status ?? "PENDIENTE_PAGO",
    fulfillment_status: (r.fulfillment_status ?? "REGISTERED") as FulfillmentStatus,
  }));
}
