import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseClient";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type ProductCartItem = { type?: "PRODUCT"; productId: number; quantity: number };
type PackCartItem = { type: "PACK"; packId: number; quantity: number };

type CartItemInput = ProductCartItem | PackCartItem;

type ShippingInput = {
  address?: string | null;
  reference?: string | null;
  district?: string | null;
  notes?: string | null;
};

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
  // IMPORTANT:
  // Never drop buyer_id in fallback attempts. Otherwise orders will exist but won't appear in "Mis Compras".
  const attempts = [
    orderBase,
    (() => {
      const { fulfillment_status, fulfillment_updated_at, ...rest } = orderBase;
      return rest;
    })(),
    (() => {
      const { fulfillment_status, fulfillment_updated_at, discount_code, discount_id, ...rest } =
        orderBase;
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

function normalizeCode(raw: any) {
  return String(raw ?? "").trim().toUpperCase();
}

function maybeRucFromCode(code: string) {
  const m = /^([0-9]{11})-/.exec(code);
  return m?.[1] || null;
}

function round2(n: any) {
  const x = Number(n ?? 0);
  if (!Number.isFinite(x)) return 0;
  return Number(x.toFixed(2));
}

async function getBuyerRuc(buyer: any): Promise<string | null> {
  const colegioId = (buyer as any)?.colegio_id;
  if (!colegioId) return null;

  const { data, error } = await supabaseAdmin
    .from("colegios")
    .select("ruc")
    .eq("id", colegioId)
    .maybeSingle();

  if (error) return null;
  const ruc = String((data as any)?.ruc ?? "").trim();
  return ruc || null;
}

type DiscountRow = {
  id: number;
  code: string;
  type: "PERCENT" | "FIXED";
  value: number;
  active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  min_subtotal: number | null;
  max_uses: number | null;
  uses_count: number;
  applies_to: "ALL" | "PRODUCT" | "PRICE_LIST" | "COLEGIO_PRODUCT";
  product_id: number | null;
  colegio_id: number | null;
  currency: string | null;
};

function inWindow(now: Date, starts?: string | null, ends?: string | null) {
  if (starts) {
    const s = new Date(starts);
    if (!Number.isNaN(s.getTime()) && now < s) return false;
  }
  if (ends) {
    const e = new Date(ends);
    if (!Number.isNaN(e.getTime()) && now > e) return false;
  }
  return true;
}

function applyPercentToUnit(unit: number, pct: number) {
  const p = Math.max(0, Math.min(100, pct));
  return round2(unit * (1 - p / 100));
}

function applyFixedToUnit(unit: number, fixed: number) {
  return round2(Math.max(0, unit - Math.max(0, fixed)));
}

// Normalize items (legacy support)
function normalizeItems(raw: any): CartItemInput[] {
  const arr = Array.isArray(raw) ? raw : [];
  return arr
    .map((it) => {
      if (!it) return null;

      // PACK
      if (it.type === "PACK" && Number.isFinite(Number(it.packId))) {
        return {
          type: "PACK",
          packId: Number(it.packId),
          quantity: Math.max(1, Number(it.quantity ?? 1)),
        } as PackCartItem;
      }

      // PRODUCT explicit
      if ((it.type === "PRODUCT" || !it.type) && Number.isFinite(Number(it.productId))) {
        return {
          type: "PRODUCT",
          productId: Number(it.productId),
          quantity: Math.max(1, Number(it.quantity ?? 1)),
        } as ProductCartItem;
      }

      // legacy
      if (Number.isFinite(Number(it.productId))) {
        return {
          type: "PRODUCT",
          productId: Number(it.productId),
          quantity: Math.max(1, Number(it.quantity ?? 1)),
        } as ProductCartItem;
      }

      return null;
    })
    .filter(Boolean) as CartItemInput[];
}

export async function POST(req: Request) {
  let orderId: string | null = null;

  try {
    const supabase = await createSupabaseServerClient();
    const body = await req.json().catch(() => ({}));

    const items = normalizeItems(body?.items);
    const shipping: ShippingInput | null = body?.shipping ?? null;
    const previewOnly: boolean = Boolean(body?.previewOnly);
    const discountCode = normalizeCode(body?.discount_code);

    const notes: string | null =
      typeof body?.notes === "string"
        ? body.notes
        : typeof shipping?.notes === "string"
        ? shipping?.notes
        : null;

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

    // ----------------------------
    // Collect IDs
    // ----------------------------
    const directProductIds = items
      .filter((x): x is ProductCartItem => (x as any).type !== "PACK")
      .map((x) => Number((x as any).productId));

    const packIds = items
      .filter((x): x is PackCartItem => (x as any).type === "PACK")
      .map((x) => Number((x as any).packId));

    // ----------------------------
    // Load Packs + Pack Items
    // ----------------------------
    const packsMap = new Map<number, any>();

    if (packIds.length) {
      const { data: packs, error: packsErr } = await supabaseAdmin
        .from("packs")
        .select("id,nombre,descripcion,codigo,codigo_venta,is_public")
        .in("id", packIds);

      if (packsErr) return NextResponse.json({ error: packsErr.message }, { status: 500 });

      const nonPublicPacks = (packs ?? []).filter((p: any) => p.is_public === false);
      if (nonPublicPacks.length) {
        return NextResponse.json({ error: "INVALID_PACKS_IN_CART" }, { status: 400 });
      }

      for (const p of packs ?? []) packsMap.set(Number((p as any).id), p);
    }

    type PackCompRow = {
      pack_id: number;
      producto_id: number;
      cantidad: number;
    };

    const packCompsMap = new Map<number, PackCompRow[]>();

    if (packIds.length) {
      const { data: packItems, error: packItemsErr } = await supabaseAdmin
        .from("pack_items")
        .select("pack_id,producto_id,cantidad")
        .in("pack_id", packIds);

      if (packItemsErr) {
        return NextResponse.json({ error: packItemsErr.message }, { status: 500 });
      }

      for (const r of (packItems ?? []) as any[]) {
        const pid = Number(r.pack_id);
        const arr = packCompsMap.get(pid) ?? [];
        arr.push({
          pack_id: pid,
          producto_id: Number(r.producto_id),
          cantidad: Number(r.cantidad ?? 1),
        });
        packCompsMap.set(pid, arr);
      }
    }

    // Collect all product IDs (direct + pack components)
    const requiredProductIdsSet = new Set<number>();
    for (const id of directProductIds) requiredProductIdsSet.add(Number(id));

    for (const it of items) {
      if ((it as any).type === "PACK") {
        const packId = Number((it as any).packId);
        const comps = packCompsMap.get(packId) ?? [];
        for (const c of comps) requiredProductIdsSet.add(Number(c.producto_id));
      }
    }

    const requiredProductIds = Array.from(requiredProductIdsSet);

    // ----------------------------
    // Load Products + Prices + Stock
    // ----------------------------
    const { data: products, error: prodErr } = await supabaseAdmin
      .from("productos")
      .select("id,descripcion,codigo_venta,is_public")
      .in("id", requiredProductIds);

    if (prodErr) return NextResponse.json({ error: prodErr.message }, { status: 500 });

    const nonPublicProducts = (products ?? []).filter((p: any) => p.is_public === false);
    if (nonPublicProducts.length) {
      return NextResponse.json({ error: "INVALID_PRODUCTS_IN_CART" }, { status: 400 });
    }

    const { data: priceRows, error: priceErr } = await supabaseAdmin
      .from("price_list_items")
      .select("producto_id,precio")
      .eq("price_list_id", priceListId)
      .in("producto_id", requiredProductIds);

    if (priceErr) return NextResponse.json({ error: priceErr.message }, { status: 500 });

    const { data: stockRows, error: stockErr } = await supabaseAdmin
      .from("stock_actual_view")
      .select("producto_id,available")
      .in("producto_id", requiredProductIds);

    if (stockErr) return NextResponse.json({ error: stockErr.message }, { status: 500 });

    const stockMap = new Map<number, number>();
    for (const s of stockRows ?? []) {
      stockMap.set(Number((s as any).producto_id), Number((s as any).available ?? 0));
    }

    const priceMap = new Map<number, number>();
    for (const r of priceRows ?? []) {
      priceMap.set(Number((r as any).producto_id), Number((r as any).precio));
    }

    const productMap = new Map<number, any>();
    for (const p of products ?? []) productMap.set(Number((p as any).id), p);

    // Pack prices: expects price_list_items.pack_id + producto_id null
    const packPriceMap = new Map<number, number>();
    if (packIds.length) {
      const { data: packPriceRows, error: packPriceErr } = await supabaseAdmin
        .from("price_list_items")
        .select("pack_id,precio")
        .eq("price_list_id", priceListId)
        .in("pack_id", packIds);

      if (packPriceErr) return NextResponse.json({ error: packPriceErr.message }, { status: 500 });

      for (const r of (packPriceRows ?? []) as any[]) {
        const pid = Number((r as any).pack_id);
        if (Number.isFinite(pid)) packPriceMap.set(pid, Number((r as any).precio));
      }
    }

    // ----------------------------
    // Aggregate stock requirements (important for packs)
    // ----------------------------
    const requiredQtyByProduct = new Map<number, number>();

    for (const it of items) {
      const qty = Math.max(1, Number((it as any).quantity ?? 1));

      if ((it as any).type === "PACK") {
        const packId = Number((it as any).packId);
        const comps = packCompsMap.get(packId) ?? [];

        if (!packsMap.get(packId)) throw new Error(`Pack not found: ${packId}`);
        if (!comps.length) throw new Error(`Pack has no items: ${packId}`);

        for (const c of comps) {
          const need = qty * Math.max(1, Number(c.cantidad ?? 1));
          const prev = requiredQtyByProduct.get(c.producto_id) ?? 0;
          requiredQtyByProduct.set(c.producto_id, prev + need);
        }
      } else {
        const productId = Number((it as any).productId);
        const prev = requiredQtyByProduct.get(productId) ?? 0;
        requiredQtyByProduct.set(productId, prev + qty);
      }
    }

    for (const [pid, need] of requiredQtyByProduct.entries()) {
      const available = stockMap.get(pid) ?? 0;
      if (available < need) {
        const p = productMap.get(pid);
        throw new Error(
          `Stock insuficiente para "${String(p?.descripcion ?? `Producto ${pid}`)}". Disponible: ${available}, solicitado: ${need}`
        );
      }
    }

    // ----------------------------
    // Build priced lines (for MP + discounts) and order_items (for DB/reserve)
    // ----------------------------
    type PricedLine = {
      producto_id: number | null; // pack header is null
      title_snapshot: string;
      codigo_venta_snapshot: string | null;
      quantity: number;
      unit_price_list: number;
      unit_price: number;
      line_total: number;
      type: "PRODUCT" | "PACK_HEADER";
    };

    type OrderItemLine = {
      producto_id: number | null;
      title_snapshot: string;
      codigo_venta_snapshot: string | null;
      quantity: number;
      unit_price_list?: number;
      unit_price: number;
      line_total: number;
      kind: "PRODUCT" | "PACK_COMPONENT" | "PACK_HEADER";
    };

    let subtotal = 0;

    const pricedLines: PricedLine[] = [];
    const reserveLines: OrderItemLine[] = []; // producto_id NOT NULL only (safe for reserve RPC)
    const headerLines: OrderItemLine[] = []; // producto_id NULL (insert after reserve)

    for (const it of items) {
      const qty = Math.max(1, Number((it as any).quantity ?? 1));

      if ((it as any).type === "PACK") {
        const packId = Number((it as any).packId);
        const pack = packsMap.get(packId);
        if (!pack) throw new Error(`Pack not found: ${packId}`);

        const packUnit = packPriceMap.get(packId);
        if (packUnit == null) {
          throw new Error(
            `No price set for pack: ${packId}. Ensure price_list_items has (price_list_id, pack_id) row.`
          );
        }

        const packName = String((pack as any).nombre ?? `Pack ${packId}`);
        const packCode =
          (pack as any).codigo_venta
            ? String((pack as any).codigo_venta)
            : (pack as any).codigo
            ? String((pack as any).codigo)
            : null;

        const header: PricedLine = {
          producto_id: null,
          title_snapshot: `${packName} (Pack)`,
          codigo_venta_snapshot: packCode,
          quantity: qty,
          unit_price_list: round2(packUnit),
          unit_price: round2(packUnit),
          line_total: round2(packUnit * qty),
          type: "PACK_HEADER",
        };

        pricedLines.push(header);
        headerLines.push({
          producto_id: null,
          title_snapshot: header.title_snapshot,
          codigo_venta_snapshot: header.codigo_venta_snapshot,
          quantity: header.quantity,
          unit_price_list: header.unit_price_list,
          unit_price: header.unit_price,
          line_total: header.line_total,
          kind: "PACK_HEADER",
        });

        subtotal = round2(subtotal + header.line_total);

        // Components: for reservation only (price 0)
        const comps = packCompsMap.get(packId) ?? [];
        for (const c of comps) {
          const prod = productMap.get(c.producto_id);
          const componentQty = qty * Math.max(1, Number(c.cantidad ?? 1));

          reserveLines.push({
            producto_id: c.producto_id,
            title_snapshot: `${packName} (Pack) — ${String(
              prod?.descripcion ?? `Producto ${c.producto_id}`
            )}`,
            codigo_venta_snapshot: prod?.codigo_venta ? String(prod.codigo_venta) : null,
            quantity: componentQty,
            unit_price: 0,
            line_total: 0,
            kind: "PACK_COMPONENT",
          });
        }
      } else {
        const productId = Number((it as any).productId);
        const p = productMap.get(productId);
        if (!p) throw new Error(`Product not found: ${productId}`);

        const unit = priceMap.get(productId);
        if (unit == null) throw new Error(`No price set for product: ${productId}`);

        const line = round2(unit * qty);
        subtotal = round2(subtotal + line);

        const row: PricedLine = {
          producto_id: productId,
          title_snapshot: String(p.descripcion ?? "Item"),
          codigo_venta_snapshot: p.codigo_venta ? String(p.codigo_venta) : null,
          quantity: qty,
          unit_price_list: round2(unit),
          unit_price: round2(unit),
          line_total: line,
          type: "PRODUCT",
        };

        pricedLines.push(row);
        reserveLines.push({
          producto_id: row.producto_id,
          title_snapshot: row.title_snapshot,
          codigo_venta_snapshot: row.codigo_venta_snapshot,
          quantity: row.quantity,
          unit_price_list: row.unit_price_list,
          unit_price: row.unit_price,
          line_total: row.line_total,
          kind: "PRODUCT",
        });
      }
    }

    // baseItems are the priced lines (used for discounts + MP)
    const baseItems = pricedLines.map((x) => ({
      producto_id: x.producto_id,
      title_snapshot: x.title_snapshot,
      codigo_venta_snapshot: x.codigo_venta_snapshot,
      quantity: x.quantity,
      unit_price_list: x.unit_price_list,
      unit_price: x.unit_price,
      line_total: x.line_total,
    }));

    // ----------------------------
    // DISCOUNT (optional)
    // ----------------------------
    let discountRow: DiscountRow | null = null;
    let discountAmount = 0;
    let message: string | null = null;

    if (discountCode) {
      const buyerRuc = await getBuyerRuc(buyer);

      if (!buyerRuc) {
        return NextResponse.json({ error: "COLEGIO_REQUIRED_FOR_DISCOUNT" }, { status: 403 });
      }

      const rucPrefix = maybeRucFromCode(discountCode);
      if (rucPrefix && rucPrefix !== buyerRuc) {
        return NextResponse.json(
          { error: "DISCOUNT_NOT_ALLOWED_FOR_SCHOOL" },
          { status: 403 }
        );
      }

      const { data: d, error: dErr } = await supabaseAdmin
        .from("discounts")
        .select(
          "id,code,type,value,active,starts_at,ends_at,min_subtotal,max_uses,uses_count,applies_to,product_id,colegio_id,currency"
        )
        .eq("code", discountCode)
        .maybeSingle();

      if (dErr) return NextResponse.json({ error: dErr.message }, { status: 500 });

      if (!d) {
        message = "Código no encontrado.";
      } else {
        const now = new Date();

        const row = {
          ...(d as any),
          id: Number((d as any).id),
          value: Number((d as any).value),
          uses_count: Number((d as any).uses_count ?? 0),
          product_id: (d as any).product_id == null ? null : Number((d as any).product_id),
          colegio_id: (d as any).colegio_id == null ? null : Number((d as any).colegio_id),
        } as DiscountRow;

        if (!row.active) message = "Este código está desactivado.";
        else if (!inWindow(now, row.starts_at, row.ends_at)) message = "Este código está fuera de vigencia.";
        else if (row.max_uses != null && row.uses_count >= row.max_uses) message = "Este código ya alcanzó su límite de usos.";
        else if (row.min_subtotal != null && subtotal < Number(row.min_subtotal)) message = "No cumples el monto mínimo para aplicar este código.";
        else if (row.currency && row.currency !== "PEN") message = "Código inválido para esta moneda.";
        else {
          const eligibleIdx: number[] = [];

          const buyerColegioId = (buyer as any)?.colegio_id ? Number((buyer as any).colegio_id) : null;

          if (!buyerColegioId) {
            message = "Debes tener un colegio asociado en tu perfil para usar descuentos.";
          } else {
            baseItems.forEach((it: any, idx: number) => {
              if (row.applies_to === "ALL") eligibleIdx.push(idx);

              if (row.applies_to === "PRODUCT" && row.product_id && it.producto_id === row.product_id) {
                eligibleIdx.push(idx);
              }

              if (
                row.applies_to === "COLEGIO_PRODUCT" &&
                row.product_id &&
                row.colegio_id &&
                it.producto_id === row.product_id &&
                row.colegio_id === buyerColegioId
              ) {
                eligibleIdx.push(idx);
              }
            });

            if (row.applies_to === "COLEGIO_PRODUCT" && row.colegio_id && row.colegio_id !== buyerColegioId) {
              message = "Este código no corresponde a tu colegio.";
            }
          }

          if (!eligibleIdx.length) {
            message = "Este código no aplica a los productos del carrito.";
          } else {
            discountRow = row;

            if (row.type === "PERCENT") {
              for (const idx of eligibleIdx) {
                const it = baseItems[idx] as any;
                const newUnit = applyPercentToUnit(it.unit_price_list, row.value);
                it.unit_price = newUnit;
                it.line_total = round2(newUnit * it.quantity);
              }
            } else {
              let remaining = round2(row.value);

              for (const idx of eligibleIdx) {
                if (remaining <= 0) break;

                const it = baseItems[idx] as any;
                const maxLineDiscount = round2(it.unit_price_list * it.quantity);
                const lineDiscount = Math.min(remaining, maxLineDiscount);

                const perUnit = round2(lineDiscount / it.quantity);
                const newUnit = applyFixedToUnit(it.unit_price_list, perUnit);

                it.unit_price = newUnit;
                it.line_total = round2(newUnit * it.quantity);

                const applied = round2(maxLineDiscount - it.line_total);
                remaining = round2(remaining - applied);
              }
            }

            const newTotal = round2(baseItems.reduce((acc: number, it: any) => acc + it.line_total, 0));
            discountAmount = round2(Math.max(0, subtotal - newTotal));
          }
        }
      }
    }

    const total = round2(subtotal - discountAmount);

    if (previewOnly) {
      return NextResponse.json({
        ok: true,
        preview: true,
        normalized_code: discountCode || null,
        applied: !!discountRow && discountAmount > 0,
        message,
        subtotal,
        discount_amount: discountAmount,
        total,
      });
    }

    const shippingAddress =
      String(shipping?.address ?? "").trim() ||
      String((buyer as any).address_line1 ?? "").trim() ||
      "";

    const shippingDistrict =
      String(shipping?.district ?? "").trim() ||
      String((buyer as any).district ?? "").trim() ||
      null;

    const shippingReference =
      String(shipping?.reference ?? "").trim() ||
      String((buyer as any).reference ?? "").trim() ||
      null;

    if (!shippingAddress) {
      return NextResponse.json({ error: "ADDRESS_REQUIRED" }, { status: 400 });
    }

    const orderBase = {
      buyer_id: user.id,

      customer_name: `${(buyer as any).first_name ?? ""} ${(buyer as any).last_name ?? ""}`.trim(),
      customer_email: user.email ?? "",
      customer_phone: (buyer as any).phone ?? "",

      shipping_address: shippingAddress,
      shipping_reference: shippingReference,
      shipping_district: shippingDistrict,
      shipping_notes: notes ?? null,

      currency: "PEN",
      subtotal,
      discount_amount: discountAmount,
      total,

      discount_code: discountRow ? discountRow.code : null,
      discount_id: discountRow ? discountRow.id : null,

      // ✅ Esto es lo que manda en "Mis Compras": si es PAYMENT_PENDING, NO se mostrará.
      status: "PAYMENT_PENDING",

      // ⚠️ Lo dejamos en REGISTERED para no romper constraints/enum/check en DB.
      // La "realidad" de si se muestra o no se controla por orders.status en /mis-compras.
      fulfillment_status: "REGISTERED",
      fulfillment_updated_at: new Date().toISOString(),
    };

    orderId = await insertOrderWithFallback(orderBase);

    // 1) Insert reserve lines first (producto_id NOT NULL only)
    const reservePayload = reserveLines.map((oi) => ({
      order_id: orderId,
      producto_id: oi.producto_id,
      title_snapshot: oi.title_snapshot,
      codigo_venta_snapshot: oi.codigo_venta_snapshot,
      quantity: oi.quantity,
      unit_price: oi.unit_price,
      line_total: oi.line_total,
      unit_price_list: oi.unit_price_list,
    }));

    {
      const { error: itemsErr1 } = await supabaseAdmin.from("order_items").insert(reservePayload as any);

      if (itemsErr1) {
        const { error: itemsErr2 } = await supabaseAdmin
          .from("order_items")
          .insert(reservePayload.map(({ unit_price_list, ...rest }) => rest) as any);

        if (itemsErr2) throw new Error(itemsErr2.message);
      }
    }

    // Reserve stock (uses order_items)
    const { error: reserveErr } = await supabaseAdmin.rpc("reserve_stock_for_order", {
      p_order_id: orderId,
    });

    if (reserveErr) {
      try {
        await supabaseAdmin.rpc("release_stock_for_order", {
          p_order_id: orderId,
          p_reason: "reserve_failed",
        });
      } catch {}

      await supabaseAdmin.from("orders").delete().eq("id", orderId);

      return NextResponse.json({ error: "OUT_OF_STOCK", detail: reserveErr.message }, { status: 409 });
    }

    // 2) Insert pack header lines after reserve (producto_id NULL)
    if (headerLines.length) {
      const headerPayload = headerLines.map((oi) => ({
        order_id: orderId,
        producto_id: oi.producto_id, // null
        title_snapshot: oi.title_snapshot,
        codigo_venta_snapshot: oi.codigo_venta_snapshot,
        quantity: oi.quantity,
        unit_price: oi.unit_price,
        line_total: oi.line_total,
        unit_price_list: oi.unit_price_list,
      }));

      const { error: headerErr } = await supabaseAdmin.from("order_items").insert(headerPayload as any);

      if (headerErr) {
        const msg = String(headerErr.message || "");
        if (msg.toLowerCase().includes("null") && msg.toLowerCase().includes("producto_id")) {
          throw new Error(
            "DB constraint: order_items.producto_id does not allow NULL. " +
              "To show packs as bundle, allow NULL for pack header rows or add a dedicated pack_id column."
          );
        }

        const { error: headerErr2 } = await supabaseAdmin
          .from("order_items")
          .insert(headerPayload.map(({ unit_price_list, ...rest }) => rest) as any);

        if (headerErr2) throw new Error(headerErr2.message);
      }
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
      items: baseItems.map((it: any) => ({
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
      metadata: {
        order_id: orderId,
        payment_row_id: paymentRow.id,
        discount_code: discountRow ? discountRow.code : null,
      },
    };

    let pref: any;
    try {
      pref = await createPreference(preferencePayload);
    } catch (e: any) {
      try {
        await supabaseAdmin.rpc("release_stock_for_order", {
          p_order_id: orderId,
          p_reason: "preference_failed",
        });
      } catch {}
      await supabaseAdmin.from("orders").delete().eq("id", orderId);
      throw e;
    }

    await supabaseAdmin.from("payments").update({ preference_id: pref.id, raw: pref }).eq("id", paymentRow.id);

    // Best-effort: redemptions + bump uses_count
    if (discountRow && discountAmount > 0) {
      try {
        await supabaseAdmin.from("discount_redemptions").insert({
          discount_id: discountRow.id,
          order_id: orderId,
          email: user.email ?? null,
          phone: (buyer as any).phone ?? null,
          amount_applied: discountAmount,
        } as any);

        await supabaseAdmin
          .from("discounts")
          .update({
            uses_count: (discountRow.uses_count ?? 0) + 1,
            updated_at: new Date().toISOString(),
          })
          .eq("id", discountRow.id);
      } catch {
        // ignore
      }
    }

    return NextResponse.json({
      ok: true,
      orderId,
      init_point: pref.init_point,
      sandbox_init_point: pref.sandbox_init_point,
      subtotal,
      discount_amount: discountAmount,
      total,
      applied_discount: discountRow ? discountRow.code : null,
    });
  } catch (e: any) {
    if (orderId) {
      try {
        await supabaseAdmin.rpc("release_stock_for_order", {
          p_order_id: orderId,
          p_reason: "unexpected_error",
        });
      } catch {}
      try {
        await supabaseAdmin.from("orders").delete().eq("id", orderId);
      } catch {}
    }

    return NextResponse.json({ error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
