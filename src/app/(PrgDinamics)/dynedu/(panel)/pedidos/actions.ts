"use server";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type {
  Pedido,
  PedidoItem,
  Producto,
  Proveedor,
  PedidoEstado,
} from "@/modules/dynedu/types";

// ------------------------------------
// 📦 Obtener proveedores
// ------------------------------------
export async function fetchProveedores(): Promise<Proveedor[]> {
  try {
    const { data, error } = await supabaseAdmin
      .from("proveedores")
      .select("*")
      .order("id", { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error("❌ Error fetchProveedores:", err);
    return [];
  }
}

// ------------------------------------
// 📚 Obtener productos
// ------------------------------------
export async function fetchProductos(): Promise<Producto[]> {
  try {
    const { data, error } = await supabaseAdmin
      .from("productos")
      .select("*")
      .order("id", { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error("❌ Error fetchProductos:", err);
    return [];
  }
}

// ------------------------------------
// 📋 Obtener pedidos
// ------------------------------------
export async function fetchPedidos(): Promise<Pedido[]> {
  try {
    const { data, error } = await supabaseAdmin
      .from("pedidos")
      .select("*")
      .order("id", { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error("❌ Error fetchPedidos:", err);
    return [];
  }
}

// ------------------------------------
// 🧾 Crear cabecera del pedido
// ------------------------------------
export type CreatePedidoCabeceraInput = {
  proveedor_id: number;
  proveedor_nombre: string;
  fecha_registro_iso: string;
  fecha_entrega_iso?: string | null;
  estado: PedidoEstado;
  doc_ref: string | null;
};

export async function createPedidoCabecera(
  input: CreatePedidoCabeceraInput
): Promise<Pedido | null> {
  try {
    const { data: lastRow } = await supabaseAdmin
      .from("pedidos")
      .select("id")
      .order("id", { ascending: false })
      .limit(1)
      .single();

    const nextNumber = lastRow ? lastRow.id + 1 : 1;
    const codigo = `PED${String(nextNumber).padStart(4, "0")}`;

    const { data, error } = await supabaseAdmin
      .from("pedidos")
      .insert([
        {
          codigo,
          proveedor_id: input.proveedor_id,
          proveedor_nombre: input.proveedor_nombre,
          fecha_registro: input.fecha_registro_iso,
          fecha_entrega: input.fecha_entrega_iso ?? null,
          estado: input.estado,
          doc_ref: input.doc_ref,
          unidades_solicitadas: 0,
          unidades_recibidas: 0,
        },
      ])
      .select("*")
      .single();

    if (error) throw error;
    return data as Pedido;
  } catch (err) {
    console.error("❌ Error createPedidoCabecera:", err);
    return null;
  }
}

// ------------------------------------
// ✏️ Actualizar cabecera del pedido
// ------------------------------------
export type UpdatePedidoCabeceraInput = {
  proveedor_id: number;
  proveedor_nombre: string;
  doc_ref: string | null;
  estado: PedidoEstado;
  /**
   * Fecha de entrega en ISO string (o null si quieres borrarla).
   * Si no se pasa, se mantiene la actual.
   */
  fecha_entrega_iso?: string | null;
};

export async function updatePedidoCabecera(
  pedidoId: number,
  input: UpdatePedidoCabeceraInput
): Promise<Pedido | null> {
  try {
    // 1) Traemos el estado actual para saber qué cambió
    const { data: pedidoActual, error: fetchErr } = await supabaseAdmin
      .from("pedidos")
      .select("estado, doc_ref, fecha_entrega")
      .eq("id", pedidoId)
      .single();

    if (fetchErr) throw fetchErr;

    // Si el pedido ya está cerrado (COMPLETO o PARCIAL), no permitimos editar
    const estadoActual = pedidoActual?.estado as PedidoEstado | undefined;
    const yaCerrado =
      estadoActual === "COMPLETO" || estadoActual === "PARCIAL";

    if (yaCerrado) {
      console.warn(
        `⚠️ Pedido ${pedidoId} ya cerrado (estado=${estadoActual}), no se permite editar desde Pedidos`
      );
      return null;
    }

    const updatePayload: Record<string, any> = {
      proveedor_id: input.proveedor_id,
      proveedor_nombre: input.proveedor_nombre,
      doc_ref: input.doc_ref,
      estado: input.estado,
    };

    if (input.fecha_entrega_iso !== undefined) {
      updatePayload.fecha_entrega = input.fecha_entrega_iso;
    }

    // 2) Actualizamos el pedido
    const { data, error } = await supabaseAdmin
      .from("pedidos")
      .update(updatePayload)
      .eq("id", pedidoId)
      .select("*")
      .single();

    if (error) throw error;

    // 3) Armamos un mensaje legible de qué cambió
    const cambios: string[] = [];

    if (pedidoActual?.estado !== input.estado) {
      cambios.push(
        `Cambio de estado: ${pedidoActual?.estado ?? "—"} → ${input.estado}`
      );
    }

    if ((pedidoActual?.doc_ref ?? "") !== (input.doc_ref ?? "")) {
      cambios.push(
        `Cambio de Doc Ref: ${pedidoActual?.doc_ref ?? "—"} → ${
          input.doc_ref ?? "—"
        }`
      );
    }

    const fechaAntes = pedidoActual?.fecha_entrega
      ? new Date(pedidoActual.fecha_entrega).toLocaleString("es-PE", {
          dateStyle: "short",
        })
      : "—";

    const fechaDespues =
      input.fecha_entrega_iso !== undefined
        ? input.fecha_entrega_iso
          ? new Date(input.fecha_entrega_iso).toLocaleString("es-PE", {
              dateStyle: "short",
            })
          : "—"
        : fechaAntes;

    if (fechaAntes !== fechaDespues) {
      cambios.push(`Cambio de fecha de entrega: ${fechaAntes} → ${fechaDespues}`);
    }

    // Si no cambió nada relevante, no escribimos evento
    if (cambios.length > 0) {
      const detalleTexto = cambios.join(" | ");

      await supabaseAdmin.from("pedido_tracking").insert({
        pedido_id: pedidoId,
        tipo_evento: "ACTUALIZAR_PEDIDO",
        detalle: detalleTexto,
      });
    }

    return data as Pedido;
  } catch (err) {
    console.error("❌ Error updatePedidoCabecera:", err);
    return null;
  }
}



// ------------------------------------
// ➕ Guardar líneas (detalle del pedido)
// ------------------------------------
export type LineaPedidoInput = {
  producto_id: number;
  cantidad: number;
};

export async function guardarLineasPedido(
  pedidoId: number,
  lineas: LineaPedidoInput[]
): Promise<boolean> {
  try {
    // Traemos info de los productos que se están usando en este pedido
    const { data: productosData, error: productosError } = await supabaseAdmin
      .from("productos")
      .select("id, descripcion")
      .in(
        "id",
        lineas.map((l) => l.producto_id)
      );

    if (productosError) throw productosError;

    // Mapa rápido id -> producto
    const productosMap = new Map<number, { descripcion: string }>();

    (productosData || []).forEach((p: any) => {
      productosMap.set(p.id, {
        descripcion: p.descripcion ?? "",
      });
    });

    const items = lineas.map((l) => {
      const prod = productosMap.get(l.producto_id);
      if (!prod) {
        throw new Error(
          `Producto ${l.producto_id} no encontrado al guardar líneas de pedido`
        );
      }

      return {
        pedido_id: pedidoId,
        producto_id: l.producto_id,
        cantidad_solicitada: l.cantidad,
        cantidad_recibida: 0,
        // Campo NOT NULL en tu tabla pedido_items
        producto_descripcion: prod.descripcion,
      };
    });

    const { error } = await supabaseAdmin.from("pedido_items").insert(items);
    if (error) throw error;

    // Actualizar unidades_solicitadas en pedido
    const totalSolicitado = lineas.reduce((sum, l) => sum + l.cantidad, 0);

    const { error: updateError } = await supabaseAdmin
      .from("pedidos")
      .update({ unidades_solicitadas: totalSolicitado })
      .eq("id", pedidoId);

    if (updateError) throw updateError;

    return true;
  } catch (err) {
    console.error("❌ Error guardarLineasPedido:", err);
    return false;
  }
}

// ------------------------------------
// 🔍 Obtener detalle de pedido (cabecera + líneas)
// ------------------------------------
export async function fetchPedidoDetalle(
  pedidoId: number
): Promise<{ pedido: Pedido; items: PedidoItem[] } | null> {
  try {
    // Cabecera del pedido
    const { data: pedido, error: pedidoErr } = await supabaseAdmin
      .from("pedidos")
      .select("*")
      .eq("id", pedidoId)
      .single();

    if (pedidoErr) throw pedidoErr;

    // Líneas del pedido con join a productos
    const { data: items, error: itemsErr } = await supabaseAdmin
      .from("pedido_items")
      .select(
        `
        id,
        pedido_id,
        producto_id,
        cantidad_solicitada,
        cantidad_recibida,
        productos (
          internal_id,
          descripcion,
          editorial
        )
      `
      )
      .eq("pedido_id", pedidoId);

    if (itemsErr) throw itemsErr;

    return {
      pedido: pedido as Pedido,
      items: (items as unknown) as PedidoItem[],
    };
  } catch (err) {
    console.error("❌ Error fetchPedidoDetalle:", err);
    return null;
  }
}
export async function deletePedido(pedidoId: number): Promise<boolean> {
  try {
    // 0) Validar que el pedido no esté cerrado ni tenga registro final en tracking
    const { data: pedidoRow, error: pedidoErr } = await supabaseAdmin
      .from("pedidos")
      .select("estado")
      .eq("id", pedidoId)
      .single();

    if (pedidoErr) throw pedidoErr;

    const estadoActual = pedidoRow?.estado as PedidoEstado | undefined;
    const yaCerrado =
      estadoActual === "COMPLETO" || estadoActual === "PARCIAL";

    if (yaCerrado) {
      console.warn(
        `⚠️ Pedido ${pedidoId} ya cerrado (estado=${estadoActual}), no se puede eliminar`
      );
      return false;
    }

    // Revisamos si existe un evento FINALIZADO / FINALIZADO_CON_FALTANTES en tracking
    const { data: trackingFinal, error: trackingErr } = await supabaseAdmin
      .from("pedido_tracking")
      .select("id")
      .eq("pedido_id", pedidoId)
      .in("tipo_evento", ["FINALIZADO", "FINALIZADO_CON_FALTANTES"])
      .limit(1);

    if (trackingErr) throw trackingErr;

    if (trackingFinal && trackingFinal.length > 0) {
      console.warn(
        `⚠️ Pedido ${pedidoId} tiene registro final en tracking, no se puede eliminar`
      );
      return false;
    }

    // 1) Primero borra el detalle
    const { error: itemsError } = await supabaseAdmin
      .from("pedido_items")
      .delete()
      .eq("pedido_id", pedidoId);

    if (itemsError) throw itemsError;

    // 2) Luego borra la cabecera
    const { error } = await supabaseAdmin
      .from("pedidos")
      .delete()
      .eq("id", pedidoId);

    if (error) throw error;
    return true;
  } catch (err) {
    console.error("❌ Error deletePedido:", err);
    return false;
  }
}
