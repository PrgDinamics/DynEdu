import { redirect } from "next/navigation";
import MisComprasClient from "./MisComprasClient";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type OrderRow = {
  id: string;
  created_at: string;
  total: number;
  currency: string;
  status: string;
  fulfillment_status: "REGISTERED" | "PACKING" | "DELIVERY" | "DELIVERED";
  delivery_date: string | null;
  fulfillment_updated_at: string;
};

type PaymentRow = {
  order_id: string;
  status: string;
  payment_id: string | null;
};

type FulfillmentEventRow = {
  order_id: string;
  status: "REGISTERED" | "PACKING" | "DELIVERY" | "DELIVERED";
  note: string | null;
  created_at: string;
};

export default async function MisComprasPage() {
  const supabase = await createSupabaseServerClient();

  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;

  if (!user) {
    redirect(`/auth/login?next=${encodeURIComponent("/mis-compras")}`);
  }

  const { data: ordersData, error: ordersErr } = await supabase
    .from("orders")
    .select("id,created_at,total,currency,status,fulfillment_status,delivery_date,fulfillment_updated_at")
    .eq("buyer_id", user.id)
    .order("created_at", { ascending: false })
    .limit(30);

  if (ordersErr) {
    return (
      <MisComprasClient
        userEmail={user.email ?? ""}
        initialOrders={[]}
        initialPayments={[]}
        initialEvents={[]}
        initialError={ordersErr.message}
      />
    );
  }

  const initialOrders = ((ordersData as any[]) ?? []).map((o) => ({
    ...o,
    total: Number(o.total ?? 0),
  })) as OrderRow[];

  const ids = initialOrders.map((o) => o.id);

  let initialPayments: PaymentRow[] = [];
  let initialEvents: FulfillmentEventRow[] = [];

  if (ids.length) {
    const { data: paymentsData } = await supabase
      .from("payments")
      .select("order_id,status,payment_id")
      .in("order_id", ids);

    initialPayments = (paymentsData as PaymentRow[]) ?? [];

    const { data: eventsData } = await supabase
      .from("order_fulfillment_events")
      .select("order_id,status,note,created_at")
      .in("order_id", ids)
      .order("created_at", { ascending: true });

    initialEvents = (eventsData as FulfillmentEventRow[]) ?? [];
  }

  return (
    <MisComprasClient
      userEmail={user.email ?? ""}
      initialOrders={initialOrders}
      initialPayments={initialPayments}
      initialEvents={initialEvents}
      initialError={null}
    />
  );
}
