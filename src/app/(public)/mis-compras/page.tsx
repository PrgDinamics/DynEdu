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

type OrderItemRow = {
  id: string;
  created_at: string;
  order_id: string;
  producto_id: number | null; // null = pack header
  title_snapshot: string;
  codigo_venta_snapshot: string | null;
  quantity: number;
  unit_price: number;
  line_total: number;
};

export default async function MisComprasPage() {
  const supabase = await createSupabaseServerClient();

  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;

  if (!user) {
    redirect(`/auth/login?next=${encodeURIComponent("/mis-compras")}`);
  }

  // ✅ SOLO COMPRAS CONFIRMADAS (ajusta estados según tu enum real)
  const visibleStatuses = ["PAID", "PREPARING", "SHIPPED", "DELIVERED", "REFUND"];

  const { data: ordersData, error: ordersErr } = await supabase
    .from("orders")
    .select("id,created_at,total,currency,status,fulfillment_status,delivery_date,fulfillment_updated_at")
    .eq("buyer_id", user.id)
    .in("status", visibleStatuses)
    .order("created_at", { ascending: false })
    .limit(30);

  if (ordersErr) {
    return (
      <MisComprasClient
        userEmail={user.email ?? ""}
        initialOrders={[]}
        initialPayments={[]}
        initialEvents={[]}
        initialItems={[]}
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
  let initialItems: OrderItemRow[] = [];

  if (ids.length) {
    const { data: paymentsData, error: paymentsErr } = await supabase
      .from("payments")
      .select("order_id,status,payment_id")
      .in("order_id", ids);

    if (paymentsErr) {
      return (
        <MisComprasClient
          userEmail={user.email ?? ""}
          initialOrders={initialOrders}
          initialPayments={[]}
          initialEvents={[]}
          initialItems={[]}
          initialError={`payments error: ${paymentsErr.message}`}
        />
      );
    }

    initialPayments = (paymentsData as PaymentRow[]) ?? [];

    const { data: eventsData, error: eventsErr } = await supabase
      .from("order_fulfillment_events")
      .select("order_id,status,note,created_at")
      .in("order_id", ids)
      .order("created_at", { ascending: true });

    if (eventsErr) {
      return (
        <MisComprasClient
          userEmail={user.email ?? ""}
          initialOrders={initialOrders}
          initialPayments={initialPayments}
          initialEvents={[]}
          initialItems={[]}
          initialError={`order_fulfillment_events error: ${eventsErr.message}`}
        />
      );
    }

    initialEvents = (eventsData as FulfillmentEventRow[]) ?? [];

    // ✅ IMPORTANT: traer items (packs + productos)
    const { data: itemsData, error: itemsErr } = await supabase
      .from("order_items")
      .select("id,created_at,order_id,producto_id,title_snapshot,codigo_venta_snapshot,quantity,unit_price,line_total")
      .in("order_id", ids)
      .order("created_at", { ascending: true });

    if (itemsErr) {
      return (
        <MisComprasClient
          userEmail={user.email ?? ""}
          initialOrders={initialOrders}
          initialPayments={initialPayments}
          initialEvents={initialEvents}
          initialItems={[]}
          initialError={`order_items error: ${itemsErr.message}`}
        />
      );
    }

    initialItems = ((itemsData as any[]) ?? []).map((it) => ({
      ...it,
      quantity: Number(it.quantity ?? 0),
      unit_price: Number(it.unit_price ?? 0),
      line_total: Number(it.line_total ?? 0),
    })) as OrderItemRow[];
  }

  return (
    <MisComprasClient
      userEmail={user.email ?? ""}
      initialOrders={initialOrders}
      initialPayments={initialPayments}
      initialEvents={initialEvents}
      initialItems={initialItems}
      initialError={null}
    />
  );
}
