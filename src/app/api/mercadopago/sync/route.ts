import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { mpGetPayment } from "@/lib/mercado/mpApi";
import { mapMpPaymentStatus, mapPaymentToOrderStatus } from "@/lib/mercado/status";

function orderStatusEsFromEn(en: string) {
  switch (en) {
    case "PAID":
      return "PAGADO";
    case "PREPARING":
      return "PREPARANDO";
    case "SHIPPED":
      return "ENVIADO";
    case "DELIVERED":
      return "ENTREGADO";
    case "CANCELLED":
      return "CANCELADO";
    case "FAILED":
      return "FALLIDO";
    case "REFUND":
      return "REEMBOLSO";
    case "PAYMENT_PENDING":
    default:
      return "PENDIENTE_PAGO";
  }
}

async function updateOrderStatusWithFallback(orderId: string, statusEn: string) {
  const now = new Date().toISOString();

  const { error: errEn } = await supabaseAdmin
    .from("orders")
    .update({ status: statusEn, updated_at: now })
    .eq("id", orderId);

  if (!errEn) return;

  const statusEs = orderStatusEsFromEn(statusEn);
  const { error: errEs } = await supabaseAdmin
    .from("orders")
    .update({ status: statusEs, updated_at: now })
    .eq("id", orderId);

  if (errEs) throw errEs;
}

async function applyStockForOrderOnce(orderId: string) {
  const { data: items, error: itemsErr } = await supabaseAdmin
    .from("order_items")
    .select("producto_id, quantity")
    .eq("order_id", orderId);

  if (itemsErr) throw itemsErr;

  for (const it of items ?? []) {
    const productoId = Number(it.producto_id);
    const qty = Math.max(1, Number(it.quantity ?? 1));

    const { data: stockRow, error: stockErr } = await supabaseAdmin
      .from("stock_actual")
      .select("stock_fisico")
      .eq("producto_id", productoId)
      .maybeSingle();

    if (stockErr) throw stockErr;

    const currentFisico = Number(stockRow?.stock_fisico ?? 0);
    const nextFisico = Math.max(0, currentFisico - qty);

    const { error: updErr } = await supabaseAdmin
      .from("stock_actual")
      .update({
        stock_fisico: nextFisico,
        updated_at: new Date().toISOString(),
        updated_by: `sync-sale:${orderId}`,
      })
      .eq("producto_id", productoId);

    if (updErr) throw updErr;

    // movimientos (si existe la tabla en tu schema)
    try {
      await supabaseAdmin.from("movimientos").insert({
        producto_id: productoId,
        tipo: "VENTA_WEB",
        cantidad: qty,
        ref_id: orderId,
        meta: { source: "sync" },
      });
    } catch {
      // si la tabla no existe o cambia de nombre, no rompas el sync
    }
  }
}

export async function GET(req: Request) {
  try {
    // ✅ Protect sync endpoint
    const url = new URL(req.url);
    const secret = url.searchParams.get("secret") || "";
    const expected = process.env.MP_SYNC_SECRET || "";

    if (expected && secret !== expected) {
      return NextResponse.json({ error: "INVALID_SYNC_SECRET" }, { status: 401 });
    }

    const paymentId = url.searchParams.get("payment_id");
    if (!paymentId) return NextResponse.json({ error: "Missing payment_id" }, { status: 400 });

    const payment = await mpGetPayment(paymentId);
    const orderId = payment.external_reference;
    if (!orderId) return NextResponse.json({ error: "Missing external_reference" }, { status: 400 });

    const paymentStatus = mapMpPaymentStatus(payment.status);
    const orderStatusEn = mapPaymentToOrderStatus(paymentStatus);

    // ✅ Read previous payment status for idempotency
    const { data: existingPayment, error: readPayErr } = await supabaseAdmin
      .from("payments")
      .select("status")
      .eq("order_id", orderId)
      .eq("provider", "mercadopago")
      .maybeSingle();

    if (readPayErr) throw readPayErr;

    const prevStatus = String(existingPayment?.status ?? "");
    const shouldApplyStock = paymentStatus === "APPROVED" && prevStatus !== "APPROVED";

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

    await updateOrderStatusWithFallback(orderId, orderStatusEn);

    if (shouldApplyStock) {
      await applyStockForOrderOnce(orderId);
    }

    return NextResponse.json({
      ok: true,
      order_id: orderId,
      payment_status: paymentStatus,
      order_status: orderStatusEn,
      stock_applied: shouldApplyStock,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Sync error" }, { status: 500 });
  }
}
