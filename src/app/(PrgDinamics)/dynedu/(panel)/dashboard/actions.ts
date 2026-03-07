"use server";

import { supabaseAdmin } from "@/lib/supabaseAdmin";

type ActiveCampaign = {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  status: "ACTIVE";
  timezone: string;
  start_ts_utc: string;
  end_ts_utc_exclusive: string;
} | null;

export type DashboardMode = "closed" | "closed_open";

export type DashboardData = {
  mode: DashboardMode;

  meta: {
    usedPriceListId: string | null;
    note: string;
    activeCampaign: ActiveCampaign;
    rangeLabel: string;
  };

  kpis: {
    campaignSales: number;
    campaignUnits: number;
    avgTicket: number;
    topClientName: string | null;
    topClientSales: number | null;
  };

  dailySalesCampaign: Array<{ date: string; amount: number }>;

  topProductsCampaign: Array<{ label: string; units: number; amount: number }>;

  consignacionesByStatus: Array<{ status: string; count: number }>;

  ops: {
    openOrders: number;
    pendingConsignaciones: number;
    openConsignaciones: number;
    deliveriesWeek: number;
  };

  alerts: {
    lowStock: Array<{
      productoId: string;
      internalId: string | null;
      descripcion: string | null;
      stockFisico: number;
    }>;
    noPrice: Array<{
      productoId: string;
      internalId: string | null;
      descripcion: string | null;
    }>;
  };

  deliveredWebSales: Array<{
    id: string;
    customer_name: string | null;
    customer_email: string | null;
    shipping_district: string | null;
    total: number;
    currency: string | null;
    delivered_at: string | null;
    mp_payment_id: string | null;
  }>;
};

function startOfDayISO(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.toISOString();
}

async function getActiveCampaignForDashboard(): Promise<ActiveCampaign> {
  const { data, error } = await supabaseAdmin
    .from("v_active_campaign")
    .select("id,name,start_date,end_date,status,timezone,start_ts_utc,end_ts_utc_exclusive")
    .maybeSingle();

  if (error && error.code !== "PGRST116") {
    console.error("Error fetching active campaign:", error);
    throw error;
  }

  return (data ?? null) as ActiveCampaign;
}

export async function getDashboardData(input?: { mode?: DashboardMode }): Promise<DashboardData> {
  const mode: DashboardMode = input?.mode ?? "closed";

  const note =
    mode === "closed"
      ? "Cálculo basado en consignaciones CERRADAS (estimado)."
      : "Cálculo basado en consignaciones CERRADAS + ABIERTAS (estimado).";

  const { data: defaultPriceList, error: plErr } = await supabaseAdmin
    .from("price_lists")
    .select("id")
    .eq("es_predeterminada", true)
    .maybeSingle();

  if (plErr) console.error("Error fetching default price list:", plErr);

  const usedPriceListId = defaultPriceList?.id ?? null;

  const todayStart = startOfDayISO(new Date());
  const activeCampaign = await getActiveCampaignForDashboard();

  const rangeStart =
    activeCampaign?.start_ts_utc ??
    new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

  const rangeEndExclusive = activeCampaign?.end_ts_utc_exclusive ?? new Date().toISOString();

  const rangeLabel = activeCampaign
    ? `${activeCampaign.start_date} → ${activeCampaign.end_date} (${activeCampaign.timezone})`
    : "Mes actual (fallback)";

  const allowedEstados = mode === "closed" ? ["CERRADA"] : ["CERRADA", "ABIERTA"];

  // 1) KPI sales/units
  const { data: consignacionesCampaign, error: consErr } = await supabaseAdmin
    .from("consignaciones")
    .select("id, created_at, estado, colegio_id")
    .gte("created_at", rangeStart)
    .lt("created_at", rangeEndExclusive)
    .in("estado", allowedEstados);

  if (consErr) console.error("Error fetching consignacionesCampaign:", consErr);

  const consignacionIds = (consignacionesCampaign ?? []).map((c: any) => c.id);

  const { data: consignacionItemsMonth, error: itemsErr } =
    consignacionIds.length === 0
      ? ({ data: [] as any[], error: null } as any)
      : await supabaseAdmin
          .from("consignacion_items")
          .select("consignacion_id, producto_id, cantidad_vendida")
          .in("consignacion_id", consignacionIds);

  if (itemsErr) console.error("Error fetching consignacionItemsMonth:", itemsErr);

  const { data: prices, error: priceErr } =
    usedPriceListId == null
      ? ({ data: [] as any[], error: null } as any)
      : await supabaseAdmin
          .from("price_list_items")
          .select("producto_id, precio")
          .eq("price_list_id", usedPriceListId);

  if (priceErr) console.error("Error fetching price_list_items:", priceErr);

  const priceByProduct = new Map<string, number>();
  (prices ?? []).forEach((p: any) =>
    priceByProduct.set(String(p.producto_id), Number(p.precio ?? 0))
  );

  let campaignUnits = 0;
  let campaignSales = 0;

  for (const it of consignacionItemsMonth ?? []) {
    const qty = Number((it as any).cantidad_vendida ?? 0);
    if (qty <= 0) continue;
    campaignUnits += qty;
    const price = priceByProduct.get(String((it as any).producto_id)) ?? 0;
    campaignSales += qty * price;
  }

  const avgTicket =
    consignacionesCampaign && consignacionesCampaign.length > 0
      ? campaignSales / consignacionesCampaign.length
      : 0;

  // Top colegio (cliente)
  const salesByColegio = new Map<string, number>();
  const consById = new Map<string, any>();
  (consignacionesCampaign ?? []).forEach((c: any) => consById.set(String(c.id), c));

  for (const it of consignacionItemsMonth ?? []) {
    const qty = Number((it as any).cantidad_vendida ?? 0);
    if (qty <= 0) continue;

    const cons = consById.get(String((it as any).consignacion_id));
    if (!cons?.colegio_id) continue;

    const price = priceByProduct.get(String((it as any).producto_id)) ?? 0;
    const prev = salesByColegio.get(String(cons.colegio_id)) ?? 0;
    salesByColegio.set(String(cons.colegio_id), prev + qty * price);
  }

  let topClientId: string | null = null;
  let topClientSales = 0;

  for (const [k, v] of salesByColegio.entries()) {
    if (v > topClientSales) {
      topClientSales = v;
      topClientId = k;
    }
  }

  const { data: topClientRow, error: topErr } =
    topClientId == null
      ? ({ data: null as any, error: null } as any)
      : await supabaseAdmin
          .from("colegios")
          .select("nombre_comercial, ruc")
          .eq("id", Number(topClientId))
          .maybeSingle();

  if (topErr) console.error("Error fetching topClientRow:", topErr);

  const topClientName =
    topClientRow
      ? `${topClientRow.nombre_comercial ?? "—"} (RUC: ${topClientRow.ruc ?? "—"})`
      : null;

  // 2) daily sales (campaign)
  const { data: consignacionesRange, error: consRangeErr } = await supabaseAdmin
    .from("consignaciones")
    .select("id, created_at, estado")
    .gte("created_at", rangeStart)
    .lt("created_at", rangeEndExclusive)
    .in("estado", allowedEstados);

  if (consRangeErr) console.error("Error fetching consignacionesRange:", consRangeErr);

  const c30ids = (consignacionesRange ?? []).map((c: any) => c.id);

  const { data: items30d, error: items30Err } =
    c30ids.length === 0
      ? ({ data: [] as any[], error: null } as any)
      : await supabaseAdmin
          .from("consignacion_items")
          .select("consignacion_id, producto_id, cantidad_vendida")
          .in("consignacion_id", c30ids);

  if (items30Err) console.error("Error fetching items30d:", items30Err);

  const createdAtByConsId = new Map<string, string>();
  (consignacionesRange ?? []).forEach((c: any) =>
    createdAtByConsId.set(String(c.id), c.created_at)
  );

  const dayAmount = new Map<string, number>();
  for (const it of items30d ?? []) {
    const qty = Number((it as any).cantidad_vendida ?? 0);
    if (qty <= 0) continue;

    const createdAt = createdAtByConsId.get(String((it as any).consignacion_id));
    if (!createdAt) continue;
    const day = String(createdAt).slice(0, 10);
    const price = priceByProduct.get(String((it as any).producto_id)) ?? 0;
    const amount = qty * price;
    dayAmount.set(day, (dayAmount.get(day) ?? 0) + amount);
  }

  const dailySalesCampaign = Array.from(dayAmount.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, amount]) => ({ date, amount }));

  // 3) top products
  const unitsByProduct = new Map<string, number>();
  const amountByProduct = new Map<string, number>();

  for (const it of consignacionItemsMonth ?? []) {
    const pid = String((it as any).producto_id);
    const qty = Number((it as any).cantidad_vendida ?? 0);
    if (qty <= 0) continue;

    unitsByProduct.set(pid, (unitsByProduct.get(pid) ?? 0) + qty);

    const price = priceByProduct.get(pid) ?? 0;
    amountByProduct.set(pid, (amountByProduct.get(pid) ?? 0) + qty * price);
  }

  // ✅ FIX: no mostrar productos con 0 unidades
  const topProdIds = Array.from(unitsByProduct.entries())
    .filter(([, u]) => (u ?? 0) > 0)
    .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
    .slice(0, 5)
    .map(([id]) => id);

  const { data: prodRows, error: prodErr } =
    topProdIds.length === 0
      ? ({ data: [] as any[], error: null } as any)
      : await supabaseAdmin
          .from("productos")
          .select("id, descripcion")
          .in("id", topProdIds.map((x) => Number(x)));

  if (prodErr) console.error("Error fetching top products:", prodErr);

  const prodNameById = new Map<string, string>();
  (prodRows ?? []).forEach((p: any) =>
    prodNameById.set(String(p.id), p.descripcion ?? `Producto ${p.id}`)
  );

  const topProductsCampaign = topProdIds.map((pid) => ({
    label: prodNameById.get(pid) ?? `Producto ${pid}`,
    units: unitsByProduct.get(pid) ?? 0,
    amount: amountByProduct.get(pid) ?? 0,
  }));

  // 4) consignaciones by status
  const { data: statusCounts, error: statusErr } = await supabaseAdmin
    .from("consignaciones")
    .select("estado")
    .gte("created_at", rangeStart)
    .lt("created_at", rangeEndExclusive)
    .in("estado", allowedEstados);

  if (statusErr) console.error("Error fetching consignacionesByStatus:", statusErr);

  const statusMap = new Map<string, number>();
  for (const r of statusCounts ?? []) {
    const s = (r as any).estado ?? "—";
    statusMap.set(s, (statusMap.get(s) ?? 0) + 1);
  }

  const consignacionesByStatus = Array.from(statusMap.entries()).map(([status, count]) => ({
    status,
    count,
  }));

  // 5) ops
  const { count: openOrdersCount, error: openOrdersErr } = await supabaseAdmin
    .from("pedidos")
    .select("id", { count: "exact", head: true })
    .in("estado", ["BORRADOR", "PENDIENTE", "PARCIAL"]);

  if (openOrdersErr) console.error("Error fetching openOrdersCount:", openOrdersErr);

  const { count: pendingConsCount, error: pendingConsErr } = await supabaseAdmin
    .from("consignaciones")
    .select("id", { count: "exact", head: true })
    .eq("estado", "ABIERTA");

  if (pendingConsErr) console.error("Error fetching pendingConsCount:", pendingConsErr);

  const { count: openConsCount, error: openConsErr } = await supabaseAdmin
    .from("consignaciones")
    .select("id", { count: "exact", head: true })
    .eq("estado", "ABIERTA");

  if (openConsErr) console.error("Error fetching openConsCount:", openConsErr);

  const { count: deliveriesWeek, error: delErr } = await supabaseAdmin
    .from("orders")
    .select("id", { count: "exact", head: true })
    .gte("delivery_date", todayStart);

  if (delErr) console.error("Error fetching deliveriesWeek:", delErr);

  // 6) alerts - low stock (✅ FIX internal_id: viene de productos)
  // 6) alerts - low stock (compatible with minimal stock_actual_view)
const lowStock: DashboardData["alerts"]["lowStock"] = [];

const { data: stockRows, error: stockErr } = await supabaseAdmin
  .from("stock_actual_view")
  .select("producto_id, stock_fisico") // ✅ only fields that should exist
  .order("stock_fisico", { ascending: true })
  .limit(50);

if (stockErr) console.error("Error fetching stock_actual_view:", stockErr);

const lowCandidates = (stockRows ?? [])
  .map((r: any) => ({
    producto_id: Number(r.producto_id),
    stock_fisico: Number(r.stock_fisico ?? 0),
  }))
  .filter((r) => Number.isFinite(r.producto_id) && r.stock_fisico <= 2)
  .slice(0, 5);

const lowIds = lowCandidates.map((r) => r.producto_id);

const { data: lowProdRows, error: lowProdErr } =
  lowIds.length === 0
    ? ({ data: [] as any[], error: null } as any)
    : await supabaseAdmin
        .from("productos")
        .select("id, internal_id, descripcion")
        .in("id", lowIds);

if (lowProdErr) console.error("Error fetching productos for lowStock:", lowProdErr);

const prodById = new Map<number, any>();
(lowProdRows ?? []).forEach((p: any) => prodById.set(Number(p.id), p));

for (const r of lowCandidates) {
  const p = prodById.get(r.producto_id);
  lowStock.push({
    productoId: String(r.producto_id),
    internalId: p?.internal_id ?? null,
    descripcion: p?.descripcion ?? null,
    stockFisico: r.stock_fisico,
  });
}

  // 7) alerts - no price in default list (limit 5)
  const noPrice: DashboardData["alerts"]["noPrice"] = [];
  if (usedPriceListId != null) {
    const { data: prods, error: noPriceErr } = await supabaseAdmin
      .from("productos")
      .select("id, internal_id, descripcion")
      .limit(500);

    if (noPriceErr) console.error("Error fetching productos for noPrice:", noPriceErr);

    const priced = new Set<string>((prices ?? []).map((p: any) => String(p.producto_id)));
    for (const p of prods ?? []) {
      const id = String((p as any).id);
      if (!priced.has(id)) {
        noPrice.push({
          productoId: id,
          internalId: (p as any).internal_id ?? null,
          descripcion: (p as any).descripcion ?? null,
        });
      }
      if (noPrice.length >= 5) break;
    }
  }

  // 8) delivered web sales (paid + delivered)
  const { data: deliveredOrders, error: delWebErr } = await supabaseAdmin
    .from("orders")
    .select(
      `
      id,
      customer_name,
      customer_email,
      shipping_district,
      total,
      currency,
      delivery_date,
      fulfillment_updated_at,
      payments!inner(status, payment_id)
    `
    )
    .gte("created_at", rangeStart)
    .lt("created_at", rangeEndExclusive)
    .eq("fulfillment_status", "DELIVERED")
    .eq("payments.status", "APPROVED")
    .order("fulfillment_updated_at", { ascending: false })
    .limit(5);

  if (delWebErr) console.error("Error fetching delivered web sales:", delWebErr);

  const deliveredWebSales =
    (deliveredOrders ?? []).map((o: any) => ({
      id: String(o.id),
      customer_name: o.customer_name ?? null,
      customer_email: o.customer_email ?? null,
      shipping_district: o.shipping_district ?? null,
      total: Number(o.total ?? 0),
      currency: o.currency ?? null,
      delivered_at: (o.delivery_date ?? o.fulfillment_updated_at ?? null) as string | null,
      mp_payment_id: o.payments?.payment_id ?? null,
    })) ?? [];

  return {
    mode,
    meta: { usedPriceListId, note, activeCampaign, rangeLabel },
    kpis: {
      campaignSales,
      campaignUnits,
      avgTicket,
      topClientName,
      topClientSales: topClientId ? topClientSales : null,
    },
    dailySalesCampaign,
    topProductsCampaign,
    consignacionesByStatus,
    ops: {
      openOrders: openOrdersCount ?? 0,
      pendingConsignaciones: pendingConsCount ?? 0,
      openConsignaciones: openConsCount ?? 0,
      deliveriesWeek: deliveriesWeek ?? 0,
    },
    alerts: { lowStock, noPrice },
    deliveredWebSales,
  };
}