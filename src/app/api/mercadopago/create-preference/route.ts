import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseClient";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type CartItemInput = { productId: number; quantity: number };

function siteUrlFromRequest(req: Request) {
  const env = process.env.NEXT_PUBLIC_SITE_URL;
  if (env) return env.replace(/\/+$/, "");

  const proto = req.headers.get("x-forwarded-proto") || "https";
  const host =
    req.headers.get("x-forwarded-host") ||
    req.headers.get("host") ||
    "localhost:3000";

  return `${proto}://${host}`.replace(/\/+$/, "");
}

async function getDefaultPriceListId() {
  const { data, error } = await supabaseAdmin
    .from("price_lists")
    .select("id")
    .eq("es_predeterminada", true)
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (data?.id) return data.id;

  const { data: created, error: createErr } = await supabaseAdmin
    .from("price_lists")
    .insert({ nombre: "Default", moneda: "PEN", es_predeterminada: true })
    .select("id")
    .single();

  if (createErr) throw new Error(createErr.message);
  return created.id as number;
}

async function createPreference(payload: any) {
  const token = process.env.MP_ACCESS_TOKEN;
  if (!token) throw new Error("MP_ACCESS_TOKEN is missing");

  const res = await fetch("https://api.mercadopago.com/checkout/preferences", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(json?.message || json?.error || "Mercado Pago preference error");
  }
  return json;
}

async function insertOrderWithFallback(orderBase: any) {
  // Try with the full object, then retry stripping optional fields if your DB doesn't have them.
  const attempts = [
    orderBase,
    (() => {
      const { buyer_id, fulfillment_status, fulfillment_updated_at, ...rest } = orderBase;
      return rest;
    })(),
    (() => {
      const { buyer_id, ...rest } = orderBase;
      return rest;
    })(),
  ];

  let lastErr: any = null;

  for (const payload of attempts) {
    const { data, error } = await supabaseAdmin
      .from("orders")
      .insert(payload)
      .select("id")
      .single();

    if (!error && data?.id) return String(data.id);
    lastErr = error;
  }

  throw new Error(lastErr?.message || "Order insert failed");
}

export async function POST(req: Request) {
  let orderId: string | null = null;

  try {
    const supabase = await createSupabaseServerClient();
    const { items, notes }: { items: CartItemInput[]; notes?: string } = await req.json();

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "Cart is empty" }, { status: 400 });
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
    }

    const { data: buyer, error: buyerErr } = await supabaseAdmin
      .from("buyers")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    if (buyerErr) return NextResponse.json({ error: buyerErr.message }, { status: 500 });
    if (!buyer) return NextResponse.json({ error: "BUYER_PROFILE_REQUIRED" }, { status: 403 });

    const priceListId = await getDefaultPriceListId();
    const productIds = items.map((i) => i.productId);

    const { data: products, error: prodErr } = await supabaseAdmin
      .from("productos")
      .select("id,descripcion,codigo_venta,is_public")
      .in("id", productIds);

    if (prodErr) return NextResponse.json({ error: prodErr.message }, { status: 500 });

    const nonPublic = (products ?? []).filter((p: any) => p.is_public === false);
    if (nonPublic.length) {
      return NextResponse.json({ error: "INVALID_PRODUCTS_IN_CART" }, { status: 400 });
    }

    const { data: priceRows, error: priceErr } = await supabaseAdmin
      .from("price_list_items")
      .select("producto_id,precio")
      .eq("price_list_id", priceListId)
      .in("producto_id", productIds);

    if (priceErr) return NextResponse.json({ error: priceErr.message }, { status: 500 });

    // Read available from VIEW (informative pre-check)
    const { data: stockRows, error: stockErr } = await supabaseAdmin
      .from("stock_actual_view")
      .select("producto_id,available")
      .in("producto_id", productIds);

    if (stockErr) return NextResponse.json({ error: stockErr.message }, { status: 500 });

    const stockMap = new Map<number, number>();
    for (const s of stockRows ?? []) stockMap.set(Number(s.producto_id), Number(s.available ?? 0));

    const priceMap = new Map<number, number>();
    for (const r of priceRows ?? []) priceMap.set(Number(r.producto_id), Number(r.precio));

    const productMap = new Map<number, any>();
    for (const p of products ?? []) productMap.set(Number(p.id), p);

    let subtotal = 0;

    const orderItems = items.map((it) => {
      const p = productMap.get(it.productId);
      if (!p) throw new Error(`Product not found: ${it.productId}`);

      const unit = priceMap.get(it.productId);
      if (unit == null) throw new Error(`No price set for product: ${it.productId}`);

      const qty = Math.max(1, Number(it.quantity || 1));

      const available = stockMap.get(it.productId) ?? 0;
      if (available < qty) {
        throw new Error(
          `Stock insuficiente para "${String(p.descripcion)}". Disponible: ${available}, solicitado: ${qty}`
        );
      }

      const line = Number((unit * qty).toFixed(2));
      subtotal += line;

      return {
        producto_id: it.productId,
        title_snapshot: String(p.descripcion ?? "Item"),
        codigo_venta_snapshot: p.codigo_venta ? String(p.codigo_venta) : null,
        quantity: qty,
        unit_price: Number(Number(unit).toFixed(2)),
        line_total: line,
      };
    });

    const total = Number(subtotal.toFixed(2));

    // Orders table in your db script is ES status only.
    // Keep ES by default to avoid CHECK errors.
    const orderBase = {
      // optional if exists:
      buyer_id: user.id,

      customer_name: `${buyer.first_name ?? ""} ${buyer.last_name ?? ""}`.trim() || `${buyer.first_name} ${buyer.last_name}`.trim(),
      customer_email: user.email ?? "",
      customer_phone: buyer.phone ?? "",

      shipping_address: buyer.address_line1 ?? "",
      shipping_reference: buyer.reference ?? null,
      shipping_district: buyer.district ?? null,
      shipping_notes: notes ?? null,

      currency: "PEN",
      subtotal: total,
      discount_amount: 0,
      total: total,

      status: "PAYMENT_PENDING",

      // optional if exists:
      fulfillment_status: "REGISTERED",
      fulfillment_updated_at: new Date().toISOString(),
    };

    orderId = await insertOrderWithFallback(orderBase);

    // Insert order_items
    const { error: itemsErr } = await supabaseAdmin
      .from("order_items")
      .insert(orderItems.map((oi) => ({ ...oi, order_id: orderId })));

    if (itemsErr) throw new Error(itemsErr.message);

    // ✅ RESERVE (atomic + race-safe)
    const { error: reserveErr } = await supabaseAdmin.rpc("reserve_stock_for_order", {
      p_order_id: orderId,
    });

    if (reserveErr) {
      // Cleanup: delete order to release cascades; release RPC is best-effort
      try {
        await supabaseAdmin.rpc("release_stock_for_order", { p_order_id: orderId, p_reason: "reserve_failed" });
      } catch {}
      await supabaseAdmin.from("orders").delete().eq("id", orderId);
      return NextResponse.json(
        { error: "OUT_OF_STOCK", detail: reserveErr.message },
        { status: 409 }
      );
    }

    // Create payment row
    const { data: paymentRow, error: payErr } = await supabaseAdmin
      .from("payments")
      .insert({
        order_id: orderId,
        provider: "mercadopago",
        status: "CREATED",
        amount: total,
        currency: "PEN",
      })
      .select("id")
      .single();

    if (payErr) throw new Error(payErr.message);
    if (!paymentRow?.id) throw new Error("Payment row id missing");

    const base = siteUrlFromRequest(req);

    const webhookSecret = process.env.MP_WEBHOOK_SECRET || "";
    const notificationUrl = webhookSecret
      ? `${base}/api/mercadopago/webhook?secret=${encodeURIComponent(webhookSecret)}`
      : `${base}/api/mercadopago/webhook`;

    const preferencePayload = {
      items: orderItems.map((it) => ({
        title: it.title_snapshot,
        quantity: it.quantity,
        unit_price: it.unit_price,
        currency_id: "PEN",
      })),
      external_reference: String(orderId),
      back_urls: {
        success: `${base}/pago/success?orderId=${orderId}`,
        pending: `${base}/pago/pending?orderId=${orderId}`,
        failure: `${base}/pago/failure?orderId=${orderId}`,
      },
      auto_return: "approved",
      notification_url: notificationUrl,
      metadata: { order_id: orderId, payment_row_id: paymentRow.id },
    };

    let pref: any;
    try {
      pref = await createPreference(preferencePayload);
    } catch (e: any) {
      // If MP preference creation fails, release reservation + delete order
      try {
        await supabaseAdmin.rpc("release_stock_for_order", { p_order_id: orderId, p_reason: "preference_failed" });
      } catch {}
      await supabaseAdmin.from("orders").delete().eq("id", orderId);
      throw e;
    }

    await supabaseAdmin
      .from("payments")
      .update({ preference_id: pref.id, raw: pref })
      .eq("id", paymentRow.id);

    return NextResponse.json({
      ok: true,
      orderId,
      preferenceId: pref.id,
      init_point: pref.init_point,
      sandbox_init_point: pref.sandbox_init_point,
    });
  } catch (e: any) {
    // best effort cleanup if orderId exists
    if (orderId) {
      try {
        await supabaseAdmin.rpc("release_stock_for_order", { p_order_id: orderId, p_reason: "unexpected_error" });
      } catch {}
      try {
        await supabaseAdmin.from("orders").delete().eq("id", orderId);
      } catch {}
    }

    return NextResponse.json({ error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
