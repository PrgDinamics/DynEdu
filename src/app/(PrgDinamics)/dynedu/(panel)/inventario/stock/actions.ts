"use server";

import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type StockRow = {
  id: number;
  producto_id: number;
  stock_fisico: number;
  stock_reservado: number;
  stock_consignado: number; // ✅ NEW
  updated_at: string | null;
  updated_by: string | null;
  productos?: {
    internal_id: string;
    descripcion: string;
    editorial: string | null;
  } | null;
};

/**
 * Fetch current stock including basic product info.
 */
export async function fetchStockActual(): Promise<StockRow[]> {
  try {
    const { data, error } = await supabaseAdmin
      .from("stock_actual")
      .select(
        `
        id,
        producto_id,
        stock_fisico,
        stock_reservado,
        stock_consignado,
        updated_at,
        updated_by,
        productos (
          internal_id,
          descripcion,
          editorial
        )
      `
      )
      .order("producto_id", { ascending: true });

    if (error) throw error;

    return (data ?? []) as unknown as StockRow[];
  } catch (err) {
    console.error("❌ Error fetchStockActual:", err);
    return [];
  }
}

/**
 * Internal helper to apply deltas to stock for a single product.
 * Positive delta => increases stock; negative delta => decreases stock.
 *
 * - deltaFisico affects stock_fisico
 * - deltaConsignado affects stock_consignado
 */
async function applyStockDeltasForProduct(
  productoId: number,
  deltaFisico: number,
  deltaConsignado: number,
  updatedBy: string
): Promise<void> {
  if (!productoId) return;
  if (!deltaFisico && !deltaConsignado) return;

  const { data: existingRows, error: existingError } = await supabaseAdmin
    .from("stock_actual")
    .select("id, stock_fisico, stock_reservado, stock_consignado")
    .eq("producto_id", productoId);

  if (existingError) {
    console.error("[applyStockDeltasForProduct] read error:", existingError);
    throw existingError;
  }

  const existing = existingRows?.[0] as
    | {
        id: number;
        stock_fisico: number;
        stock_reservado: number;
        stock_consignado: number;
      }
    | undefined;

  const nowIso = new Date().toISOString();

  if (existing) {
    const nuevoFisico = (existing.stock_fisico ?? 0) + (deltaFisico ?? 0);
    const nuevoConsignado =
      (existing.stock_consignado ?? 0) + (deltaConsignado ?? 0);

    const { error: updateError } = await supabaseAdmin
      .from("stock_actual")
      .update({
        stock_fisico: nuevoFisico,
        stock_consignado: nuevoConsignado,
        updated_at: nowIso,
        updated_by: updatedBy,
      })
      .eq("id", existing.id);

    if (updateError) {
      console.error("[applyStockDeltasForProduct] update error:", updateError);
      throw updateError;
    }
  } else {
    const { error: insertError } = await supabaseAdmin.from("stock_actual").insert([
      {
        producto_id: productoId,
        stock_fisico: deltaFisico ?? 0,
        stock_reservado: 0,
        stock_consignado: deltaConsignado ?? 0,
        updated_at: nowIso,
        updated_by: updatedBy,
      },
    ]);

    if (insertError) {
      console.error("[applyStockDeltasForProduct] insert error:", insertError);
      throw insertError;
    }
  }
}

/**
 * Internal helper to apply a delta to stock_fisico for a single product.
 * Positive delta => increases stock; negative delta => decreases stock.
 */
async function applyStockDeltaForProduct(
  productoId: number,
  delta: number,
  updatedBy: string
): Promise<void> {
  // ✅ keep existing behavior for other flows
  return applyStockDeltasForProduct(productoId, delta, 0, updatedBy);
}

/**
 * Increase stock based on received quantities from a supplier order.
 * This is called from tracking when a "pedido real" is finalized.
 */
export async function actualizarStockDesdePedido(
  pedidoId: number,
  updatedBy: string = "pedido-real"
): Promise<void> {
  const { data: items, error: itemsError } = await supabaseAdmin
    .from("pedido_items")
    .select("producto_id, cantidad_recibida")
    .eq("pedido_id", pedidoId);

  if (itemsError) {
    console.error("❌ Error leyendo pedido_items para stock:", itemsError);
    throw itemsError;
  }

  if (!items || items.length === 0) return;

  for (const item of items) {
    const productoId = (item as any).producto_id as number | null;
    const recibida = ((item as any).cantidad_recibida as number | null) ?? 0;

    if (!productoId || recibida <= 0) continue;

    await applyStockDeltaForProduct(productoId, recibida, updatedBy);
  }
}

/**
 * Adjust stock based on pack usage.
 *
 * When packs are used (e.g. delivered to a school), we need to consume
 * stock from the underlying products:
 *
 *   delta per product = cantidad_en_pack * cantidadPacks * factor
 *
 * Where factor is:
 *   -1 => consume stock (default)
 *   +1 => revert a previous consumption
 */
export async function adjustStockByPack(
  packId: number,
  cantidadPacks: number,
  mode: "consume" | "revert" = "consume",
  updatedBy: string = "pack"
): Promise<void> {
  if (!packId || !cantidadPacks) return;

  const factor = mode === "consume" ? -1 : 1;

  const { data: items, error } = await supabaseAdmin
    .from("pack_items")
    .select("producto_id, cantidad")
    .eq("pack_id", packId);

  if (error) {
    console.error("❌ [adjustStockByPack] error reading pack_items:", error);
    throw error;
  }

  if (!items || items.length === 0) return;

  for (const item of items) {
    const productoId = (item as any).producto_id as number | null;
    const cantidadPorPack = ((item as any).cantidad as number | null) ?? 0;

    if (!productoId || !cantidadPorPack) continue;

    const delta = cantidadPorPack * cantidadPacks * factor;
    if (!delta) continue;

    await applyStockDeltaForProduct(productoId, delta, updatedBy);
  }
}

/**
 * Types for consignation stock adjustments.
 */
export type ConsignacionStockItem = {
  producto_id: number;
  cantidad: number;
};

/**
 * Adjust stock based on consignation flows.
 *
 * mode:
 *  - "salida": books leave warehouse as consignation
 *              => stock_fisico -= cantidad
 *              => stock_consignado += cantidad
 *  - "devolucion": books returned from consignation
 *              => stock_fisico += cantidad
 *              => stock_consignado -= cantidad
 *  - "venta": sold at school (stock already left on "salida")
 *              => stock_consignado -= cantidad
 */
export async function adjustStockForConsignacion(
  items: ConsignacionStockItem[],
  mode: "salida" | "devolucion" | "venta",
  updatedBy: string = "consignacion"
): Promise<void> {
  if (!items || items.length === 0) return;

  for (const item of items) {
    const productoId = item.producto_id;
    const cantidad = item.cantidad;

    if (!productoId || !cantidad) continue;

    if (mode === "salida") {
      await applyStockDeltasForProduct(productoId, -cantidad, +cantidad, updatedBy);
      continue;
    }

    if (mode === "devolucion") {
      await applyStockDeltasForProduct(productoId, +cantidad, -cantidad, updatedBy);
      continue;
    }

    // mode === "venta"
    await applyStockDeltasForProduct(productoId, 0, -cantidad, updatedBy);
  }
}
