import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { mpGetPayment } from "@/lib/mercado/mpApi";
import { mapMpPaymentStatus, mapPaymentToOrderStatus } from "@/lib/mercado/status";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const paymentId = url.searchParams.get("payment_id");
    if (!paymentId) return NextResponse.json({ error: "Missing payment_id" }, { status: 400 });

    const payment = await mpGetPayment(paymentId);
    const orderId = payment.external_reference;
    if (!orderId) return NextResponse.json({ error: "Missing external_reference" }, { status: 400 });

    const paymentStatus = mapMpPaymentStatus(payment.status);

    await supabaseAdmin
      .from("payments")
      .update({
        payment_id: String(payment.id),
        merchant_order_id: payment.merchant_order_id ? String(payment.merchant_order_id) : null,
        status: paymentStatus,
        raw: payment,
        updated_at: new Date().toISOString(),
      })
      .eq("order_id", orderId)
      .eq("provider", "mercadopago");

    const orderStatus = mapPaymentToOrderStatus(paymentStatus);
    await supabaseAdmin
      .from("orders")
      .update({ status: orderStatus, updated_at: new Date().toISOString() })
      .eq("id", orderId);

    return NextResponse.json({ ok: true, order_id: orderId, order_status: orderStatus });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Sync error" }, { status: 500 });
  }
}
