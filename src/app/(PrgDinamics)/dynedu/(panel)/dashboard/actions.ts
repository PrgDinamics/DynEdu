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

  // ✅ NEW: ventas web ya ENTREGADAS (y con pago aprobado)
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

  // NOTE: Este dashboard es "estimado" basado en consignaciones + precios.
  const note =
    mode === "closed"
      ? "Cálculo basado en consignaciones CERRADAS (estimado)."
      : "Cálculo basado en consignaciones CERRADAS + ABIERTAS (estimado).";

  // Try to find default price list
  const { data: defaultPriceList } = await supabaseAdmin
    .from("price_lists")
    .select("id")
    .eq("is_default", true)
    .maybeSingle();

  const usedPriceListId = defaultPriceList?.id ?? null;

  const todayStart = startOfDayISO(new Date());
  const activeCampaign = await getActiveCampaignForDashboard();

  // Range used for ALL KPIs + charts
  // - If there's no active campaign, fallback to "month-to-date".
  const rangeStart =
    activeCampaign?.start_ts_utc ??
    new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

  const rangeEndExclusive = activeCampaign?.end_ts_utc_exclusive ?? new Date().toISOString();

  const rangeLabel = activeCampaign
    ? `${activeCampaign.start_date} → ${activeCampaign.end_date} (${activeCampaign.timezone})`
    : "Mes actual (fallback)";

  // 1) KPI month sales (estimated)
  const allowedStatuses =
    mode === "closed"
      ? ["CERRADA"]
      : ["CERRADA", "ABIERTA", "EN_CURSO", "PENDIENTE", "APROBADA", "DEVOLUCION_PENDIENTE"];

  const { data: consignacionesCampaign } = await supabaseAdmin
    .from("consignaciones")
    .select("id, created_at, status, colegio_id")
    .gte("created_at", rangeStart)
    .lt("created_at", rangeEndExclusive)
    .in("status", allowedStatuses);

  const consignacionIds = (consignacionesCampaign ?? []).map((c: any) => c.id);

  // items
  const { data: consignacionItemsMonth } =
    consignacionIds.length === 0
      ? { data: [] as any[] }
      : await supabaseAdmin
          .from("consignacion_items")
          .select("consignacion_id, producto_id, cantidad")
          .in("consignacion_id", consignacionIds);

  // price list items
  const { data: prices } =
    usedPriceListId == null
      ? { data: [] as any[] }
      : await supabaseAdmin
          .from("price_list_items")
          .select("producto_id, price")
          .eq("price_list_id", usedPriceListId);

  const priceByProduct = new Map<string, number>();
  (prices ?? []).forEach((p: any) => priceByProduct.set(p.producto_id, Number(p.price ?? 0)));

  let campaignUnits = 0;
  let campaignSales = 0;

  for (const it of consignacionItemsMonth ?? []) {
    const qty = Number((it as any).cantidad ?? 0);
    campaignUnits += qty;
    const price = priceByProduct.get((it as any).producto_id) ?? 0;
    campaignSales += qty * price;
  }

  const avgTicket =
    consignacionesCampaign && consignacionesCampaign.length > 0
      ? campaignSales / consignacionesCampaign.length
      : 0;

  // top client (by colegio) month
  const salesByColegio = new Map<string, number>();
  for (const it of consignacionItemsMonth ?? []) {
    const price = priceByProduct.get((it as any).producto_id) ?? 0;
    const consignacion = (consignacionesCampaign ?? []).find(
      (c: any) => c.id === (it as any).consignacion_id,
    );
    if (!consignacion?.colegio_id) continue;
    const prev = salesByColegio.get(consignacion.colegio_id) ?? 0;
    salesByColegio.set(
      consignacion.colegio_id,
      prev + Number((it as any).cantidad ?? 0) * price,
    );
  }

  let topClientId: string | null = null;
  let topClientSales = 0;
  for (const [k, v] of salesByColegio.entries()) {
    if (v > topClientSales) {
      topClientSales = v;
      topClientId = k;
    }
  }

  const { data: topClientRow } =
    topClientId == null
      ? { data: null as any }
      : await supabaseAdmin.from("colegios").select("nombre").eq("id", topClientId).maybeSingle();

  const topClientName = topClientRow?.nombre ?? null;

  // 2) daily sales (campaign) (estimated)
  const { data: consignacionesRange } = await supabaseAdmin
    .from("consignaciones")
    .select("id, created_at")
    .gte("created_at", rangeStart)
    .lt("created_at", rangeEndExclusive)
    .in("status", allowedStatuses);

  const c30ids = (consignacionesRange ?? []).map((c: any) => c.id);

  const { data: items30d } =
    c30ids.length === 0
      ? { data: [] as any[] }
      : await supabaseAdmin
          .from("consignacion_items")
          .select("consignacion_id, producto_id, cantidad")
          .in("consignacion_id", c30ids);

  const createdAtByConsId = new Map<string, string>();
  (consignacionesRange ?? []).forEach((c: any) => createdAtByConsId.set(c.id, c.created_at));

  const dayAmount = new Map<string, number>();
  for (const it of items30d ?? []) {
    const createdAt = createdAtByConsId.get((it as any).consignacion_id);
    if (!createdAt) continue;
    const day = String(createdAt).slice(0, 10);
    const price = priceByProduct.get((it as any).producto_id) ?? 0;
    const amount = Number((it as any).cantidad ?? 0) * price;
    dayAmount.set(day, (dayAmount.get(day) ?? 0) + amount);
  }

  const dailySalesCampaign = Array.from(dayAmount.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, amount]) => ({ date, amount }));

  // 3) top products month (estimated)
  const unitsByProduct = new Map<string, number>();
  const amountByProduct = new Map<string, number>();

  for (const it of consignacionItemsMonth ?? []) {
    const pid = String((it as any).producto_id);
    const qty = Number((it as any).cantidad ?? 0);

    unitsByProduct.set(pid, (unitsByProduct.get(pid) ?? 0) + qty);

    const price = priceByProduct.get(pid) ?? 0;
    amountByProduct.set(pid, (amountByProduct.get(pid) ?? 0) + qty * price);
  }

  const topProdIds = Array.from(unitsByProduct.entries())
    .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
    .slice(0, 5)
    .map(([id]) => id);

  const { data: prodRows } =
    topProdIds.length === 0
      ? { data: [] as any[] }
      : await supabaseAdmin.from("productos").select("id, descripcion").in("id", topProdIds);

  const prodNameById = new Map<string, string>();
  (prodRows ?? []).forEach((p: any) =>
    prodNameById.set(p.id, p.descripcion ?? `Producto ${p.id}`),
  );

  const topProductsCampaign = topProdIds.map((pid) => ({
    label: prodNameById.get(pid) ?? `Producto ${pid}`,
    units: unitsByProduct.get(pid) ?? 0,
    amount: amountByProduct.get(pid) ?? 0,
  }));

  // 4) consignaciones by status
  const { data: statusCounts } = await supabaseAdmin
    .from("consignaciones")
    .select("status")
    .gte("created_at", rangeStart)
    .lt("created_at", rangeEndExclusive)
    .in("status", allowedStatuses);

  const statusMap = new Map<string, number>();
  for (const r of statusCounts ?? []) {
    const s = (r as any).status ?? "—";
    statusMap.set(s, (statusMap.get(s) ?? 0) + 1);
  }
  const consignacionesByStatus = Array.from(statusMap.entries()).map(([status, count]) => ({
    status,
    count,
  }));

  // 5) ops
  const { count: openOrdersCount } = await supabaseAdmin
    .from("pedido_colegios")
    .select("id", { count: "exact", head: true })
    .eq("estado", "ABIERTO");

  const { count: pendingConsCount } = await supabaseAdmin
    .from("consignaciones")
    .select("id", { count: "exact", head: true })
    .in("status", ["PENDIENTE", "APROBADA", "DEVOLUCION_PENDIENTE"]);

  const { count: openConsCount } = await supabaseAdmin
    .from("consignaciones")
    .select("id", { count: "exact", head: true })
    .in("status", ["ABIERTA", "EN_CURSO"]);

  // deliveries in 7 days
  const { count: deliveriesWeek } = await supabaseAdmin
    .from("orders")
    .select("id", { count: "exact", head: true })
    .gte("delivery_date", todayStart);

  // 6) alerts - low stock
  const lowStock: DashboardData["alerts"]["lowStock"] = [];
  const { data: stockRows } = await supabaseAdmin
    .from("stock_actual_view")
    .select("producto_id, internal_id, descripcion, stock_fisico")
    .order("stock_fisico", { ascending: true })
    .limit(10);

  for (const r of stockRows ?? []) {
    const stock = Number((r as any).stock_fisico ?? 0);
    if (stock <= 2) {
      lowStock.push({
        productoId: (r as any).producto_id,
        internalId: (r as any).internal_id ?? null,
        descripcion: (r as any).descripcion ?? null,
        stockFisico: stock,
      });
    }
  }

  // 7) alerts - no price in default list
  const noPrice: DashboardData["alerts"]["noPrice"] = [];
  if (usedPriceListId != null) {
    const { data: prods } = await supabaseAdmin
      .from("productos")
      .select("id, internal_id, descripcion")
      .limit(200);

    const priced = new Set<string>((prices ?? []).map((p: any) => p.producto_id));
    for (const p of prods ?? []) {
      const id = (p as any).id;
      if (!priced.has(id)) {
        noPrice.push({
          productoId: id,
          internalId: (p as any).internal_id ?? null,
          descripcion: (p as any).descripcion ?? null,
        });
      }
      if (noPrice.length >= 10) break;
    }
  }

  // ✅ 8) NEW: delivered web sales (paid + delivered)
  const { data: deliveredOrders } = await supabaseAdmin
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
    `,
    )
    .gte("created_at", rangeStart)
    .lt("created_at", rangeEndExclusive)
    .eq("fulfillment_status", "DELIVERED")
    .eq("payments.status", "APPROVED")
    .order("fulfillment_updated_at", { ascending: false })
    .limit(8);

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
