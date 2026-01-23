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
        "items_units"
      ].join(",")
    )
    .order("created_at", { ascending: false })
    .limit(1000)
    .returns<SalesOverviewRow[]>(); // ✅ THIS FIXES YOUR TS ERROR

  if (error) {
    console.error("[fetchSalesOverview] error:", error.message);
    return [];
  }

  return data ?? [];
}
