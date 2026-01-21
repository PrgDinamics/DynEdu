import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { mapMpPaymentStatus, mapPaymentToOrderStatus } from "@/lib/mercado/status";

async function fetchMpPayment(paymentId: string) {
  const token = process.env.MP_ACCESS_TOKEN;
  if (!token) throw new Error("Missing MP_ACCESS_TOKEN");

  const res = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`MP fetch failed: ${res.status} ${txt}`);
  }

  return res.json();
}

export async function POST(req: Request) {
  try {
    // 1) Validate webhook secret (if set)
    const url = new URL(req.url);
    const secret = url.searchParams.get("secret") || "";
    const expected = process.env.MP_WEBHOOK_SECRET || "";

    if (expected && secret !== expected) {
      return NextResponse.json({ error: "INVALID_WEBHOOK_SECRET" }, { status: 401 });
    }

    // 2) Parse webhook body
    const body = await req.json().catch(() => ({} as any));
    const paymentId: string | undefined = body?.data?.id || body?.id;

    // If it's not a payment notification, just ack.
    if (!paymentId) {
      return NextResponse.json({ ok: true });
    }

    // 3) Fetch canonical status from Mercado Pago
    const mpPayment = await fetchMpPayment(String(paymentId));

    const mpStatus = mpPayment?.status as string | undefined;
    const dbPaymentStatus = mapMpPaymentStatus(mpStatus);

    const externalRef = String(mpPayment?.external_reference || "");
    const merchantOrderId = mpPayment?.order?.id ? String(mpPayment.order.id) : null;

    // external_reference MUST be the order_id (uuid)
    if (!externalRef) {
      return NextResponse.json({ ok: true });
    }

    // 4) Update payments row
    const { error: payErr } = await supabaseAdmin
      .from("payments")
      .update({
        status: dbPaymentStatus,
        payment_id: String(paymentId),
        merchant_order_id: merchantOrderId,
        raw: mpPayment,
        updated_at: new Date().toISOString(),
      })
      .eq("order_id", externalRef)
      .eq("provider", "mercadopago");

    if (payErr) throw payErr;

    // 5) Update order status
    const orderStatus = mapPaymentToOrderStatus(dbPaymentStatus);

    const { error: orderErr } = await supabaseAdmin
      .from("orders")
      .update({
        status: orderStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", externalRef);

    if (orderErr) throw orderErr;

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    // Important: MP will retry if you return 500.
    // If you prefer retries, keep 500. If you prefer no retries, return 200 with ok:false.
    return NextResponse.json({ error: e?.message || "Unexpected error" }, { status: 500 });
  }
}
