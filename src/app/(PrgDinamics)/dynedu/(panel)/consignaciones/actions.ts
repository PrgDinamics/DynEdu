"use server";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { adjustStockForConsignacion, ConsignacionStockItem } from "@/app/(PrgDinamics)/dynedu/(panel)/inventario/stock/actions";

export type ConsignacionEstado = "ABIERTA" | "CERRADA" | "ANULADA";

export type ConsignacionItemInput = {
  productoId: number;
  cantidad: number;
};

export type CreateConsignacionInput = {
  colegioId: number;
  fechaSalida?: string; // ISO date string (YYYY-MM-DD)
  observaciones?: string;
  items: ConsignacionItemInput[];
};

export type DevolucionConsignacionInput = {
  consignacionId: number;
  items: ConsignacionItemInput[];
};

function padNumber(num: number, size: number): string {
  let s = String(num);
  while (s.length < size) s = "0" + s;
  return s;
}

/**
 * Generate next consignation code: CON0001, CON0002, ...
 */
async function generateConsignacionCode(): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from("consignaciones")
    .select("codigo")
    .like("codigo", "CON%")
    .order("codigo", { ascending: false })
    .limit(1);

  if (error) {
    console.error("[generateConsignacionCode] error:", error.message);
    // fallback simple
    return "CON0001";
  }

  const last = data?.[0]?.codigo as string | undefined;
  if (!last) return "CON0001";

  const numericPart = parseInt(last.slice(3), 10);
  const nextNumber = isNaN(numericPart) ? 1 : numericPart + 1;

  return `CON${padNumber(nextNumber, 4)}`;
}

/**
 * Create a new consignation and adjust stock (salida).
 */
export async function createConsignacionAction(
  input: CreateConsignacionInput
): Promise<{ success: boolean; error?: string }> {
  try {
    const { colegioId, fechaSalida, observaciones, items } = input;

    if (!colegioId) {
      return { success: false, error: "Colegio requerido" };
    }

    if (!items || items.length === 0) {
      return { success: false, error: "Debe registrar al menos un producto" };
    }

    const codigo = await generateConsignacionCode();

    const fechaSalidaValue =
      fechaSalida && fechaSalida.trim().length > 0
        ? fechaSalida
        : new Date().toISOString().slice(0, 10); // YYYY-MM-DD

    // 1) Insert consignacion header
    const { data: newConsRows, error: consError } = await supabaseAdmin
      .from("consignaciones")
      .insert([
        {
          codigo,
          colegio_id: colegioId,
          fecha_salida: fechaSalidaValue,
          estado: "ABIERTA",
          observaciones: observaciones ?? null,
        },
      ])
      .select("id")
      .limit(1);

    if (consError) {
      console.error("[createConsignacionAction] insert header error:", consError);
      return { success: false, error: "No se pudo crear la consignación" };
    }

    const consignacionId = newConsRows?.[0]?.id as number | undefined;
    if (!consignacionId) {
      return { success: false, error: "No se obtuvo ID de consignación" };
    }

    // 2) Insert items
    const itemsToInsert = items.map((item) => ({
      consignacion_id: consignacionId,
      producto_id: item.productoId,
      cantidad: item.cantidad,
      cantidad_devuelta: 0,
      cantidad_vendida: 0,
    }));

    const { error: itemsError } = await supabaseAdmin
      .from("consignacion_items")
      .insert(itemsToInsert);

    if (itemsError) {
      console.error("[createConsignacionAction] insert items error:", itemsError);
      return { success: false, error: "No se pudieron registrar los ítems" };
    }

    // 3) Adjust stock (salida from central warehouse)
    const stockItems: ConsignacionStockItem[] = items.map((item) => ({
      producto_id: item.productoId,
      cantidad: item.cantidad,
    }));

    await adjustStockForConsignacion(stockItems, "salida", "consignacion-salida");

    return { success: true };
  } catch (err: any) {
    console.error("[createConsignacionAction] unexpected error:", err);
    return {
      success: false,
      error: "Error inesperado al crear la consignación",
    };
  }
}

/**
 * Register returned quantities for a consignation and adjust stock.
 */
export async function registrarDevolucionConsignacionAction(
  input: DevolucionConsignacionInput
): Promise<{ success: boolean; error?: string }> {
  try {
    const { consignacionId, items } = input;

    if (!consignacionId) {
      return { success: false, error: "ID de consignación requerido" };
    }

    if (!items || items.length === 0) {
      return { success: false, error: "Debe indicar productos devueltos" };
    }

    // 1) Update consignacion_items: increase cantidad_devuelta
    for (const item of items) {
      const { productoId, cantidad } = item;
      if (!productoId || !cantidad) continue;

      const { data: existingRows, error: fetchError } = await supabaseAdmin
        .from("consignacion_items")
        .select("id, cantidad_devuelta")
        .eq("consignacion_id", consignacionId)
        .eq("producto_id", productoId)
        .limit(1);

      if (fetchError) {
        console.error("[registrarDevolucionConsignacionAction] fetch item error:", fetchError);
        continue;
      }

      const existing = existingRows?.[0];
      if (!existing) {
        console.warn(
          "[registrarDevolucionConsignacionAction] item not found for product:",
          productoId
        );
        continue;
      }

      const nuevaDevuelta =
        ((existing as any).cantidad_devuelta as number | null ?? 0) + cantidad;

      const { error: updateError } = await supabaseAdmin
        .from("consignacion_items")
        .update({ cantidad_devuelta: nuevaDevuelta })
        .eq("id", (existing as any).id);

      if (updateError) {
        console.error(
          "[registrarDevolucionConsignacionAction] update item error:",
          updateError
        );
      }
    }

    // 2) Adjust stock (devolución to central warehouse)
    const stockItems: ConsignacionStockItem[] = items.map((item) => ({
      producto_id: item.productoId,
      cantidad: item.cantidad,
    }));

    await adjustStockForConsignacion(
      stockItems,
      "devolucion",
      "consignacion-devolucion"
    );

    return { success: true };
  } catch (err: any) {
    console.error("[registrarDevolucionConsignacionAction] unexpected error:", err);
    return {
      success: false,
      error: "Error inesperado al registrar la devolución",
    };
  }
}

/**
 * Basic list for a future table of consignaciones.
 */
export async function getConsignacionesResumen() {
  const { data, error } = await supabaseAdmin
    .from("consignaciones")
    .select(
      `
      id,
      codigo,
      fecha_salida,
      fecha_cierre,
      estado,
      observaciones,
      colegios (
        id,
        nombre,
        razon_social
      )
    `
    )
    .order("fecha_salida", { ascending: false });

  if (error) {
    console.error("[getConsignacionesResumen] error:", error.message);
    return [];
  }

  return data ?? [];
}
