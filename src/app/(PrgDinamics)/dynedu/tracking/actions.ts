"use server";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { PedidoEstado } from "@/modules/dynedu/types";
import { actualizarStockDesdePedido } from "@/app/(PrgDinamics)/dynedu/inventario/stock/actions";


export type TrackingOrderSummary = {
  id: number;
  codigo: string;
  proveedor_nombre: string;
  doc_ref: string | null;
  estado: PedidoEstado | string;
  ultimo_evento: string | null;
  ultimo_evento_fecha: string | null;
};

export type TrackingEvent = {
  id: number;
  pedido_id: number;
  tipo_evento: string;
  detalle: string | null;
  created_at: string;
};

// ------------------------------------
// Lista de pedidos con último evento
// ------------------------------------
export async function getTrackingOrders(): Promise<TrackingOrderSummary[]> {
  try {
    const { data, error } = await supabaseAdmin
      .from("v_pedidos_tracking_resumen")
      .select(
        `
        id,
        codigo,
        proveedor_nombre,
        doc_ref,
        estado,
        ultimo_evento,
        ultimo_evento_fecha
      `
      )
      .order("ultimo_evento_fecha", { ascending: false });

    if (error) throw error;
    return (data || []) as TrackingOrderSummary[];
  } catch (err) {
    console.error("❌ Error getTrackingOrders:", err);
    return [];
  }
}

// ------------------------------------
// Historial completo de un pedido
// ------------------------------------
export async function getOrderTimeline(
  pedidoId: number
): Promise<TrackingEvent[]> {
  try {
    const { data, error } = await supabaseAdmin
      .from("pedido_tracking")
      .select("id, pedido_id, tipo_evento, detalle, created_at")
      .eq("pedido_id", pedidoId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return (data || []) as TrackingEvent[];
  } catch (err) {
    console.error("❌ Error getOrderTimeline:", err);
    return [];
  }
}

// ------------------------------------
// Agregar comentario (NOTA)
// ------------------------------------
export async function addOrderCommentAction(formData: FormData) {
  const pedidoIdRaw = formData.get("pedidoId");
  const detalleRaw = formData.get("detalle");

  const pedidoId = Number(pedidoIdRaw);
  const detalle = String(detalleRaw ?? "").trim();

  if (!pedidoId || !detalle) {
    return;
  }

  const { error } = await supabaseAdmin.from("pedido_tracking").insert({
    pedido_id: pedidoId,
    tipo_evento: "NOTA",
    detalle,
  });

  if (error) {
    console.error("❌ Error addOrderCommentAction (insert):", error);
    throw error;
  }

  revalidatePath("/colegio/tracking");
  redirect(`/colegio/tracking?pedidoId=${pedidoId}#historial`);
}

// ------------------------------------
// Pedido real / Finalizar
// ------------------------------------
export type PedidoRealPayload = {
  pedidoId: number;
  finalizar: boolean;
  items: {
    itemId: number;
    productId: number;
    codigo: string;
    descripcion: string;
    solicitada: number;
    recibida: number;
  }[];
};

export async function registrarPedidoRealAction(formData: FormData) {
  const raw = formData.get("payload");
  if (!raw) return;

  let payload: PedidoRealPayload;
  try {
    payload = JSON.parse(String(raw)) as PedidoRealPayload;
  } catch (e) {
    console.error("❌ Error parseando payload de Pedido Real:", e);
    return;
  }

  const { pedidoId, finalizar, items } = payload;

  if (!pedidoId || !items?.length) return;

  // 0) Verificar que el pedido no esté ya cerrado
  const { data: pedidoRow, error: pedidoErr } = await supabaseAdmin
    .from("pedidos")
    .select("fecha_entrega, estado")
    .eq("id", pedidoId)
    .single();

  if (pedidoErr) {
    console.error(
      "❌ Error registrarPedidoRealAction (fetch pedido):",
      pedidoErr
    );
    throw pedidoErr;
  }

  const estadoActual = pedidoRow?.estado as PedidoEstado | undefined;
  const yaCerrado =
    estadoActual === "COMPLETO" || estadoActual === "PARCIAL";

  if (yaCerrado) {
    // Ya está finalizado, no permitimos más cambios
    console.warn(
      "⚠️ Pedido ya cerrado, ignorando cambios de Pedido Real"
    );
    redirect(`/colegio/tracking?pedidoId=${pedidoId}#historial`);
  }

  // 1) Actualizar cantidades recibidas en pedido_items (solo UPDATE)
  for (const item of items) {
    const { error } = await supabaseAdmin
      .from("pedido_items")
      .update({ cantidad_recibida: item.recibida })
      .eq("id", item.itemId);

    if (error) {
      console.error(
        `❌ Error actualizando pedido_items (id=${item.itemId}):`,
        error
      );
      throw error;
    }
  }

  // 2) Totales
  const totalSolicitada = items.reduce((s, i) => s + i.solicitada, 0);
  const totalRecibida = items.reduce((s, i) => s + i.recibida, 0);
  const totalFaltante = items.reduce(
    (s, i) => s + Math.max(i.solicitada - i.recibida, 0),
    0
  );
  const totalExcedente = items.reduce(
    (s, i) => s + Math.max(i.recibida - i.solicitada, 0),
    0
  );

  const nowIso = new Date().toISOString();

  const updatePedidoPayload: Partial<{
    unidades_recibidas: number;
    estado: PedidoEstado;
    fecha_entrega: string;
  }> = {
    unidades_recibidas: totalRecibida,
  };

  if (finalizar) {
    const estadoFinal: PedidoEstado =
      totalFaltante === 0 && totalExcedente === 0
        ? "COMPLETO"
        : "PARCIAL";

    updatePedidoPayload.estado = estadoFinal;

    if (!pedidoRow?.fecha_entrega) {
      updatePedidoPayload.fecha_entrega = nowIso;
    }

    // Registrar evento final en tracking
    const detalle = {
      totalFaltante,
      totalExcedente,
      detalle: items.map((i) => ({
        product_id: i.productId,
        codigo: i.codigo,
        solicitada: i.solicitada,
        recibida: i.recibida,
        faltante: Math.max(i.solicitada - i.recibida, 0),
        excedente: Math.max(i.recibida - i.solicitada, 0),
      })),
    };

    const tipo_evento =
      totalFaltante > 0 || totalExcedente > 0
        ? "FINALIZADO_CON_FALTANTES"
        : "FINALIZADO";

    const { error: trackErr } = await supabaseAdmin
      .from("pedido_tracking")
      .insert({
        pedido_id: pedidoId,
        tipo_evento,
        detalle: JSON.stringify(detalle),
      });

    if (trackErr) {
      console.error(
        "❌ Error registrarPedidoRealAction (insert tracking):",
        trackErr
      );
      throw trackErr;
    }
  } else {
    const provisional: PedidoEstado =
      totalRecibida === 0
        ? "PENDIENTE"
        : totalRecibida === totalSolicitada
        ? "COMPLETO"
        : "PARCIAL";
    updatePedidoPayload.estado = provisional;
  }

  // 3) Actualizar cabecera de pedido
  const { error: updatePedidoErr } = await supabaseAdmin
    .from("pedidos")
    .update(updatePedidoPayload)
    .eq("id", pedidoId);

  if (updatePedidoErr) {
    console.error(
      "❌ Error registrarPedidoRealAction (update pedido):",
      updatePedidoErr
    );
    throw updatePedidoErr;
  }

  // 4) ACTUALIZAR STOCK SOLO CUANDO SE FINALIZA EL PEDIDO
  if (finalizar) {
    try {
      await actualizarStockDesdePedido(pedidoId, "pedido-real");
    } catch (stockErr) {
      console.error(
        "❌ Error actualizando stock desde Pedido Real:",
        stockErr
      );
      throw stockErr;
    }
  }

  revalidatePath("/colegio/pedidos");
  revalidatePath("/colegio/tracking");
  redirect(`/colegio/tracking?pedidoId=${pedidoId}#historial`);
}

