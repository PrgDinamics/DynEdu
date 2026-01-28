import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  try {
    const supabase = await createSupabaseServerClient();

    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const orderId = String(body?.orderId ?? "").trim();
    const reason = String(body?.reason ?? "payment_not_approved").trim();
    if (!orderId) return NextResponse.json({ error: "orderId required" }, { status: 400 });

    const { data: order, error: ordErr } = await supabase
      .from("orders")
      .select("id,buyer_id,status")
      .eq("id", orderId)
      .maybeSingle();

    if (ordErr) return NextResponse.json({ error: ordErr.message }, { status: 500 });
    if (!order) return NextResponse.json({ error: "ORDER_NOT_FOUND" }, { status: 404 });
    if (order.buyer_id !== user.id) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

    const status = String(order.status ?? "").toUpperCase();
    const cancellable = ["PAYMENT_PENDING", "CREATED", "PENDING"].includes(status);
    if (!cancellable) return NextResponse.json({ ok: true, skipped: true, reason: "NOT_PENDING" });

    const { error: relErr } = await supabaseAdmin.rpc("release_stock_for_order", {
      p_order_id: orderId,
      p_reason: reason,
    });
    if (relErr) console.error("[release_stock_for_order] error:", relErr.message);

    const { error: updErr } = await supabaseAdmin
      .from("orders")
      .update({ status: "FAILED", updated_at: new Date().toISOString() })
      .eq("id", orderId);

    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

    try {
      await supabaseAdmin
        .from("payments")
        .update({ status: "CANCELLED", updated_at: new Date().toISOString() })
        .eq("order_id", orderId);
    } catch {}

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
