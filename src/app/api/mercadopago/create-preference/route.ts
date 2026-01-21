import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseClient";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type CartItemInput = { productId: number; quantity: number };

function siteUrl() {
  const url = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  return url.replace(/\/+$/, "");
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

  // create default
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

export async function POST(req: Request) {
  try {
    const supabase = await createSupabaseServerClient();

    const {
      items, // CartItemInput[]
      notes,
    }: { items: CartItemInput[]; notes?: string } = await req.json();

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "Cart is empty" }, { status: 400 });
    }

    // Require authenticated buyer
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

    // Load products
    const productIds = items.map((i) => i.productId);
    const { data: products, error: prodErr } = await supabaseAdmin
      .from("productos")
      .select("id,descripcion,codigo_venta")
      .in("id", productIds);

    if (prodErr) return NextResponse.json({ error: prodErr.message }, { status: 500 });

    // Load prices
    const { data: priceRows, error: priceErr } = await supabaseAdmin
      .from("price_list_items")
      .select("producto_id,precio")
      .eq("price_list_id", priceListId)
      .in("producto_id", productIds);

    if (priceErr) return NextResponse.json({ error: priceErr.message }, { status: 500 });

    const priceMap = new Map<number, number>();
    for (const r of priceRows ?? []) priceMap.set(Number(r.producto_id), Number(r.precio));

    const productMap = new Map<number, any>();
    for (const p of products ?? []) productMap.set(Number(p.id), p);

    // Build snapshots
    let subtotal = 0;

    const orderItems = items.map((it) => {
      const p = productMap.get(it.productId);
      if (!p) throw new Error(`Product not found: ${it.productId}`);

      const unit = priceMap.get(it.productId);
      if (unit == null) throw new Error(`No price set for product: ${it.productId}`);

      const qty = Math.max(1, Number(it.quantity || 1));
      const line = Number((unit * qty).toFixed(2));
      subtotal += line;

      return {
        producto_id: it.productId,
        title_snapshot: String(p.descripcion ?? "Item"),
        codigo_venta_snapshot: p.codigo_venta ? String(p.codigo_venta) : null,
        quantity: qty,
        unit_price: Number(unit.toFixed(2)),
        line_total: line,
      };
    });

    const total = Number(subtotal.toFixed(2));

    // Create order (try EN status first, fallback ES if your DB still has ES)
    const orderBase = {
      customer_name: `${buyer.first_name} ${buyer.last_name}`.trim(),
      customer_email: buyer.email ?? user.email ?? "",
      customer_phone: buyer.phone ?? "",
      shipping_address: buyer.address_line1 ?? "",
      shipping_reference: buyer.reference ?? null,
      shipping_district: buyer.district ?? null,
      shipping_notes: notes ?? null,
      currency: "PEN",
      subtotal: total,
      discount_amount: 0,
      total,
      status: "PAYMENT_PENDING",
    };

    let orderId: string | null = null;

    {
      const { data: order, error: orderErr } = await supabaseAdmin
        .from("orders")
        .insert(orderBase)
        .select("id")
        .single();

      if (!orderErr) orderId = order.id as string;

      if (orderErr) {
        // fallback for legacy ES constraint
        const { data: order2, error: orderErr2 } = await supabaseAdmin
          .from("orders")
          .insert({ ...orderBase, status: "PENDIENTE_PAGO" })
          .select("id")
          .single();

        if (orderErr2) return NextResponse.json({ error: orderErr2.message }, { status: 500 });
        orderId = order2.id as string;
      }
    }

    // Insert order_items
    const { error: itemsErr } = await supabaseAdmin
      .from("order_items")
      .insert(orderItems.map((oi) => ({ ...oi, order_id: orderId })));

    if (itemsErr) return NextResponse.json({ error: itemsErr.message }, { status: 500 });

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

    if (payErr) return NextResponse.json({ error: payErr.message }, { status: 500 });

    // Preference payload
    const base = siteUrl();
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
      notification_url: `${base}/api/mercadopago/webhook`,
      metadata: {
        order_id: orderId,
        payment_row_id: paymentRow.id,
      },
    };

    const pref = await createPreference(preferencePayload);

    // Save preference_id
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
    return NextResponse.json({ error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
