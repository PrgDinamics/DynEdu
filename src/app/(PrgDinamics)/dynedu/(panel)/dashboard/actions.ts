"use server";

import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type DashboardMode = "closed" | "closed_open";

export type DashboardKpis = {
  monthSales: number;
  monthUnits: number;
  avgTicket: number;
  topClientName: string;
  topClientSales: number;
};

export type DailyPoint = { date: string; amount: number };

export type TopProductRow = {
  label: string;
  units: number;
  amount: number;
};

export type OpsKpis = {
  openOrders: number;
  pendingConsignaciones: number;
  openConsignaciones: number;
  deliveriesWeek: number;
};

export type StatusCount = { status: string; count: number };

export type AlertLowStock = {
  productoId: number;
  internalId: string;
  descripcion: string;
  stockFisico: number;
};

export type AlertNoPrice = {
  productoId: number;
  internalId: string;
  descripcion: string;
};

export type DashboardData = {
  mode: DashboardMode;
  kpis: DashboardKpis;
  dailySales30d: DailyPoint[];
  topProductsMonth: TopProductRow[];
  ops: OpsKpis;
  consignacionesByStatus: StatusCount[];
  alerts: {
    lowStock: AlertLowStock[];
    noPrice: AlertNoPrice[];
  };
  meta: {
    usedPriceListId: number | null;
    usedPriceListName: string | null;
    note: string;
  };
};

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function toISODateOnly(d: Date) {
  return d.toISOString().slice(0, 10);
}

function safeNumber(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function sumBy<T>(arr: T[], fn: (x: T) => number) {
  return arr.reduce((acc, x) => acc + fn(x), 0);
}

async function trySelect<T>(fn: () => Promise<{ data: T; error: any }>, fallback: T): Promise<T>;
async function trySelect<T>(fn: () => Promise<T>, fallback: T): Promise<T>;
async function trySelect<T>(fn: () => Promise<any>, fallback: T): Promise<T> {
  try {
    const res = await fn();

    // Supabase/PostgREST style: { data, error }
    if (res && typeof res === "object" && "data" in res && "error" in res) {
      const { data, error } = res as { data: any; error: any };
      if (error) return fallback;
      return (data ?? fallback) as T;
    }

    // Plain return (e.g., number)
    return (res ?? fallback) as T;
  } catch {
    return fallback;
  }
}

export async function getDashboardData(input?: { mode?: DashboardMode }): Promise<DashboardData> {
  const mode: DashboardMode = input?.mode ?? "closed";
  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthStartIso = monthStart.toISOString();

  const last30Start = new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000);
  const last30Iso = last30Start.toISOString();

  const statuses = mode === "closed_open" ? ["CERRADA", "ABIERTA"] : ["CERRADA"];

  // 1) Get default price list (optional)
  const priceList = await trySelect<{ id: number; nombre: string } | null>(
    async () =>
      supabaseAdmin
        .from("price_lists")
        .select("id, nombre")
        .eq("es_predeterminada", true)
        .maybeSingle(),
    null
  );

  const priceListId = priceList?.id ?? null;
  const priceListName = priceList?.nombre ?? null;

  // 2) Price map (producto_id -> precio)
  const priceItems = priceListId
    ? await trySelect<{ producto_id: number; precio: number }[]>(
        async () =>
          supabaseAdmin
            .from("price_list_items")
            .select("producto_id, precio")
            .eq("price_list_id", priceListId)
            .not("producto_id", "is", null),
        []
      )
    : [];

  const priceByProduct = new Map<number, number>();
  for (const row of priceItems) {
    if (row?.producto_id == null) continue;
    priceByProduct.set(Number(row.producto_id), safeNumber((row as any).precio));
  }

  // 3) Consignaciones for month (optional tables: consignaciones/consignacion_items)
  // DB alignment: uses fecha_salida (open/start) and fecha_cierre (closed).
  const consignaciones = await trySelect<any[]>(
    async () => {
      const base = supabaseAdmin
        .from("consignaciones")
        .select("id, colegio_id, estado, fecha_salida, fecha_cierre, created_at, updated_at")
        .in("estado", statuses)
        .order("id", { ascending: false });

      // If we're only CERRADAS, filter by fecha_cierre. If we include ABIERTAS, filter by fecha_salida.
      if (mode === "closed") return base.gte("fecha_cierre", monthStartIso);
      return base.gte("fecha_salida", monthStartIso);
    },
    []
  );

  // Fallback in case some rows have null fecha_cierre/fecha_salida or the filter returns empty.
  const consignacionesFallback = consignaciones.length
    ? consignaciones
    : await trySelect<any[]>(
        async () =>
          supabaseAdmin
            .from("consignaciones")
            .select("id, colegio_id, estado, fecha_salida, fecha_cierre, created_at, updated_at")
            .in("estado", statuses)
            .gte("created_at", monthStartIso)
            .order("id", { ascending: false }),
        []
      );

  const consignacionIds = consignacionesFallback.map((c) => Number(c.id)).filter(Boolean);

  const consignacionItems = consignacionIds.length
    ? await trySelect<any[]>(
        async () =>
          supabaseAdmin
            .from("consignacion_items")
            .select("consignacion_id, producto_id, cantidad_vendida")
            .in("consignacion_id", consignacionIds),
        []
      )
    : [];

  // Group items by consignacion
  const itemsByConsignacion = new Map<number, any[]>();
  for (const it of consignacionItems) {
    const cid = Number(it.consignacion_id);
    if (!cid) continue;
    const arr = itemsByConsignacion.get(cid) ?? [];
    arr.push(it);
    itemsByConsignacion.set(cid, arr);
  }

  // Fetch colegios names for month-top client
  const colegioIds = Array.from(new Set(consignacionesFallback.map((c) => Number(c.colegio_id)).filter(Boolean)));
  const colegios = colegioIds.length
    ? await trySelect<{ id: number; razon_social: string }[]>(
        async () =>
          supabaseAdmin
            .from("colegios")
            .select("id, razon_social")
            .in("id", colegioIds),
        []
      )
    : [];
  const colegioNameById = new Map<number, string>();
  for (const co of colegios) {
    colegioNameById.set(Number(co.id), (co as any).razon_social ?? "Colegio");
  }

  // Fetch productos for top products / alerts
  const productIdsInItems = Array.from(
    new Set(consignacionItems.map((i) => Number(i.producto_id)).filter(Boolean))
  );

  const productos = productIdsInItems.length
    ? await trySelect<{ id: number; internal_id: string; descripcion: string }[]>(
        async () =>
          supabaseAdmin
            .from("productos")
            .select("id, internal_id, descripcion")
            .in("id", productIdsInItems),
        []
      )
    : [];

  const productLabelById = new Map<number, string>();
  const productInternalIdById = new Map<number, string>();
  const productDescById = new Map<number, string>();
  for (const p of productos) {
    const pid = Number((p as any).id);
    const internalId = (p as any).internal_id ?? "";
    const desc = (p as any).descripcion ?? "";
    productLabelById.set(pid, desc || internalId || `Producto ${pid}`);
    productInternalIdById.set(pid, internalId);
    productDescById.set(pid, desc);
  }

  // Compute aggregates
  const salesByColegio = new Map<number, number>();
  const unitsByProduct = new Map<number, number>();
  const amountByProduct = new Map<number, number>();

  const dailySales = new Map<string, number>();

  const statusCounts = new Map<string, number>();

  let monthSales = 0;
  let monthUnits = 0;
  let tickets = 0;

  for (const c of consignacionesFallback) {
    const cid = Number(c.id);
    const colegioId = Number(c.colegio_id) || 0;
    const estado = String(c.estado ?? "");

    statusCounts.set(estado, (statusCounts.get(estado) ?? 0) + 1);

    const items = itemsByConsignacion.get(cid) ?? [];
    let consignacionAmount = 0;
    let consignacionUnits = 0;

    for (const it of items) {
      const pid = Number(it.producto_id);
      const soldUnits = safeNumber((it as any).cantidad_vendida);
      if (!pid || soldUnits <= 0) continue;

      const price = priceByProduct.get(pid) ?? 0;
      const lineAmount = soldUnits * price;

      consignacionUnits += soldUnits;
      consignacionAmount += lineAmount;

      unitsByProduct.set(pid, (unitsByProduct.get(pid) ?? 0) + soldUnits);
      amountByProduct.set(pid, (amountByProduct.get(pid) ?? 0) + lineAmount);
    }

    if (consignacionUnits > 0) {
      monthUnits += consignacionUnits;
      monthSales += consignacionAmount;
      tickets += 1;

      if (colegioId) {
        salesByColegio.set(colegioId, (salesByColegio.get(colegioId) ?? 0) + consignacionAmount);
      }

      // Daily series uses close date if available, else updated/created/fecha_salida.
      const rawDate =
        (c as any).fecha_cierre || (c as any).fecha_salida || (c as any).updated_at || (c as any).created_at;
      const dateKey = rawDate ? String(rawDate).slice(0, 10) : toISODateOnly(now);

      // Only keep last 30 days points (client draws 30d chart)
      if (rawDate && String(rawDate) >= last30Iso.slice(0, 10)) {
        dailySales.set(dateKey, (dailySales.get(dateKey) ?? 0) + consignacionAmount);
      }
    }
  }

  // Build daily series for last 30 days with zero fill
  const dailySales30d: DailyPoint[] = [];
  for (let i = 0; i < 30; i++) {
    const d = new Date(last30Start.getTime() + i * 24 * 60 * 60 * 1000);
    const key = toISODateOnly(d);
    dailySales30d.push({ date: key, amount: dailySales.get(key) ?? 0 });
  }

  // Top products
  const topProductsMonth: TopProductRow[] = Array.from(unitsByProduct.entries())
    .map(([pid, units]) => ({
      label: productLabelById.get(pid) ?? `Producto ${pid}`,
      units,
      amount: amountByProduct.get(pid) ?? 0,
    }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);

  // Top client
  let topClientId = 0;
  let topClientSales = 0;
  for (const [cid, amt] of salesByColegio.entries()) {
    if (amt > topClientSales) {
      topClientSales = amt;
      topClientId = cid;
    }
  }
  const topClientName = topClientId ? colegioNameById.get(topClientId) ?? "—" : "—";

  // Ops KPIs (best-effort; tables may not exist in this dump)
  const openOrders = await trySelect<number>(
    async () => {
      const { count } = await supabaseAdmin
        .from("pedidos")
        .select("id", { count: "exact", head: true })
        .in("estado", ["BORRADOR", "PENDIENTE", "PARCIAL"]);
      return count ?? 0;
    },
    0
  );

  const pendingConsignaciones = await trySelect<number>(
    async () => {
      const { count } = await supabaseAdmin
        .from("consignaciones")
        .select("id", { count: "exact", head: true })
        .eq("estado", "PENDIENTE");
      return count ?? 0;
    },
    0
  );

  const openConsignaciones = await trySelect<number>(
    async () => {
      const { count } = await supabaseAdmin
        .from("consignaciones")
        .select("id", { count: "exact", head: true })
        .eq("estado", "ABIERTA");
      return count ?? 0;
    },
    0
  );

  const weekEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const deliveriesWeek = await trySelect<number>(
    async () => {
      const { count } = await supabaseAdmin
        .from("pedidos")
        .select("id", { count: "exact", head: true })
        .gte("fecha_entrega", now.toISOString())
        .lte("fecha_entrega", weekEnd.toISOString());
      return count ?? 0;
    },
    0
  );

  // Alerts
  const lowStock = await trySelect<any[]>(
    async () =>
      supabaseAdmin
        .from("stock_actual")
        .select("producto_id, stock_fisico, productos:productos(id, internal_id, descripcion)")
        .lte("stock_fisico", 5)
        .order("stock_fisico", { ascending: true })
        .limit(10),
    []
  );

  const normalizedLowStock: AlertLowStock[] = lowStock
    .map((r: any) => {
      const prod = Array.isArray(r.productos) ? r.productos[0] : r.productos;
      return {
        productoId: Number(r.producto_id),
        internalId: prod?.internal_id ?? "",
        descripcion: prod?.descripcion ?? "",
        stockFisico: safeNumber(r.stock_fisico),
      };
    })
    .filter((x: AlertLowStock) => x.productoId);

  // No price list? then noPrice is unknown.
  const noPrice: AlertNoPrice[] = [];
  if (priceListId) {
    const allProducts = await trySelect<{ id: number; internal_id: string; descripcion: string }[]>(
      async () => supabaseAdmin.from("productos").select("id, internal_id, descripcion").limit(500),
      []
    );

    for (const p of allProducts) {
      const pid = Number((p as any).id);
      if (!pid) continue;
      if (priceByProduct.has(pid)) continue;
      noPrice.push({
        productoId: pid,
        internalId: (p as any).internal_id ?? "",
        descripcion: (p as any).descripcion ?? "",
      });
      if (noPrice.length >= 10) break;
    }
  }

  const avgTicket = tickets > 0 ? monthSales / tickets : 0;

  const consignacionesByStatus: StatusCount[] = Array.from(statusCounts.entries())
    .map(([status, count]) => ({ status, count }))
    .sort((a, b) => b.count - a.count);

  const usedPriceListNote = priceListId
    ? `Usando lista de precios predeterminada: ${priceListName ?? `#${priceListId}`}.`
    : "No se encontró lista de precios predeterminada; montos estimados pueden salir en 0.";

  const data: DashboardData = {
    mode,
    kpis: {
      monthSales,
      monthUnits,
      avgTicket,
      topClientName,
      topClientSales,
    },
    dailySales30d,
    topProductsMonth,
    ops: {
      openOrders,
      pendingConsignaciones,
      openConsignaciones,
      deliveriesWeek,
    },
    consignacionesByStatus,
    alerts: {
      lowStock: normalizedLowStock,
      noPrice,
    },
    meta: {
      usedPriceListId: priceListId,
      usedPriceListName: priceListName,
      note:
        "Estimado basado en consignaciones de libros (no incluye packs). " +
        `Modo: ${mode === "closed" ? "Solo CERRADAS" : "CERRADAS + ABIERTAS"}. ` +
        usedPriceListNote,
    },
  };

  return data;
}
