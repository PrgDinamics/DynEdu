"use server";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  adjustStockForConsignacion,
  type ConsignacionStockItem,
} from "@/app/(PrgDinamics)/dynedu/(panel)/inventario/stock/actions";

import { Resend } from "resend";

export type ConsignacionEstado = "PENDIENTE" | "ABIERTA" | "CERRADA" | "ANULADA";

export type ColegioBasic = {
  id: number;
  ruc: string | null;
  razon_social: string | null;
  nombre_comercial: string | null;
};

export type ProductoBasic = {
  id: number;
  internal_id: string | null;
  descripcion: string | null;
  editorial: string | null;
  isbn: string | null;
};

export type ConsignacionItemRow = {
  id: number;
  consignacion_id: number;
  producto_id: number;
  cantidad: number;
  cantidad_aprobada: number | null;
  cantidad_devuelta: number;
  cantidad_vendida: number;
  product: ProductoBasic | null;
  /** Back-compat alias for older UI code. Prefer `product`. */
  producto?: ProductoBasic | null;
};

export type ConsignacionWithItems = {
  id: number;
  codigo: string;
  colegio_id: number;
  fecha_salida: string;
  fecha_cierre: string | null;
  fecha_entrega: string | null;
  estado: ConsignacionEstado;
  observaciones: string | null;
  admin_comentario: string | null;

  colegio: ColegioBasic | null;
  items: ConsignacionItemRow[];

  totals: {
    totalItems: number;
    totalUnits: number;
    /** Back-compat alias for older UI code. Prefer `totalUnits`. */
    totalUnidades?: number;
  };
};

export type ConsignacionItemInput = {
  /** Portal usually sends `productId`, panel uses `productoId`. We accept both. */
  productId?: number;
  productoId?: number;
  producto_id?: number;
  cantidad: number;
  /** Optional when editing/approving */
  cantidad_aprobada?: number;
};

function resolveProductoId(it: ConsignacionItemInput): number {
  const id = Number(it.productId ?? it.productoId ?? it.producto_id ?? 0);
  return id;
}


export type CreateConsignacionInput = {
  colegioId: number;
  fechaSalida?: string; // YYYY-MM-DD
  observaciones?: string;
  items: ConsignacionItemInput[];
};

export type UpdateSolicitudInput = {
  consignacionId: number;
  fechaEntrega: string | null; // YYYY-MM-DD
  comentarioAdmin: string | null;
  items: { itemId: number; cantidadAprobada: number }[];
};

function padNumber(n: number, len: number) {
  return String(n).padStart(len, "0");
}

async function generateConsignacionCode(): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from("consignaciones")
    .select("codigo")
    .like("codigo", "CON%")
    .order("codigo", { ascending: false })
    .limit(1);

  if (error) {
    console.error("[generateConsignacionCode] error:", error.message);
    return "CON0001";
  }

  const last = data?.[0]?.codigo as string | undefined;
  if (!last) return "CON0001";

  const numericPart = parseInt(last.slice(3), 10);
  const nextNumber = isNaN(numericPart) ? 1 : numericPart + 1;

  return `CON${padNumber(nextNumber, 4)}`;
}

/**
 * Crea consignación desde panel (directo ABIERTA) + aplica salida de stock.
 * (El flujo portal usa PENDIENTE; este queda para uso interno si lo necesitas.)
 */
export async function createConsignacionAction(
  input: CreateConsignacionInput
): Promise<{ success: boolean; error?: string }> {
  try {
    const { colegioId, fechaSalida, observaciones, items } = input;

    if (!colegioId) return { success: false, error: "Colegio requerido" };
    if (!items || items.length === 0)
      return { success: false, error: "Debe registrar al menos un producto" };

    const codigo = await generateConsignacionCode();
    const fechaSalidaValue = fechaSalida
      ? new Date(`${fechaSalida}T00:00:00.000Z`).toISOString()
      : new Date().toISOString();

    // 1) header
    const { data: newConsRows, error: consError } = await supabaseAdmin
      .from("consignaciones")
      .insert([
        {
          codigo,
          colegio_id: colegioId,
          fecha_salida: fechaSalidaValue,
          estado: "PENDIENTE",
          observaciones: observaciones ?? null,
          admin_comentario: null,
          fecha_entrega: null,
        },
      ])
      .select("id")
      .limit(1);

    if (consError) {
      console.error("[createConsignacionAction] insert consignacion error:", consError);
      return { success: false, error: "No se pudo crear la consignación" };
    }

    const consignacionId = (newConsRows?.[0] as any)?.id as number | undefined;
    if (!consignacionId) return { success: false, error: "No se obtuvo ID de consignación" };

    // 2) items
    const itemsToInsert = items.map((item) => ({
      consignacion_id: consignacionId,
      producto_id: item.productoId,
      cantidad: item.cantidad,
      cantidad_aprobada: item.cantidad,
      cantidad_devuelta: 0,
      cantidad_vendida: 0,
    }));

    const { error: itemsError } = await supabaseAdmin
      .from("consignacion_items")
      .insert(itemsToInsert);

    if (itemsError) {
      console.error("[createConsignacionAction] insert items error:", itemsError);
      return { success: false, error: "No se pudieron registrar items" };
    }

    // 3) stock salida
    const stockItems: ConsignacionStockItem[] = items.map((item) => ({
      producto_id: item.productoId,
      cantidad: item.cantidad,
    }));

    await adjustStockForConsignacion(stockItems, "salida", "consignacion-salida");

    return { success: true };
  } catch (err: any) {
    console.error("[createConsignacionAction] unexpected error:", err);
    return { success: false, error: "Error inesperado al crear la consignación" };
  }
}


/**
 * Portal Colegios: crea una SOLICITUD en estado PENDIENTE.
 * Importante: NO aplica stock hasta que el panel la apruebe.
 */
export async function createConsignacionSolicitudAction(
  input: any
): Promise<{ success: boolean; error?: string; consignacionId?: number; codigo?: string }> {
  try {
    // Acepta objeto o FormData
    let colegioId = 0;
    let fechaSalida: string | undefined;
    let observaciones: string | undefined;
    let items: ConsignacionItemInput[] = [];

    if (typeof FormData !== "undefined" && input instanceof FormData) {
      colegioId = Number(input.get("colegioId") ?? input.get("colegio_id") ?? 0);
      fechaSalida = String(input.get("fechaSalida") ?? input.get("fecha_salida") ?? "");
      observaciones = String(input.get("observaciones") ?? "");
      const itemsJson = input.get("items");
      if (itemsJson) items = JSON.parse(String(itemsJson));
    } else {
      colegioId = Number(input?.colegioId ?? input?.colegio_id ?? 0);
      fechaSalida = input?.fechaSalida ?? input?.fecha_salida;
      observaciones = input?.observaciones ?? "";
      items = Array.isArray(input?.items) ? input.items : [];
    }

    if (!colegioId) return { success: false, error: "Colegio requerido" };
    if (!items || items.length === 0)
      return { success: false, error: "Debe registrar al menos un producto" };

    const codigo = await generateConsignacionCode();
    const fechaSalidaValue =
      fechaSalida && String(fechaSalida).trim()
        ? new Date(`${fechaSalida}T00:00:00.000Z`).toISOString()
        : new Date().toISOString();

    // 1) header (PENDIENTE)
    const { data: consRows, error: consErr } = await supabaseAdmin
      .from("consignaciones")
      .insert([
        {
          codigo,
          colegio_id: colegioId,
          fecha_salida: fechaSalidaValue,
          estado: "PENDIENTE",
          observaciones: observaciones?.trim() ? observaciones.trim() : null,
          // estos campos requieren migración DB (ver SQL)
          admin_comentario: null,
          fecha_entrega: null,
        },
      ])
      .select("id,codigo")
      .limit(1);

    if (consErr) {
      console.error("[createConsignacionSolicitudAction] insert consignacion error:", consErr);
      return { success: false, error: "No se pudo crear la solicitud." };
    }

    const consignacionId = (consRows?.[0] as any)?.id as number | undefined;
    if (!consignacionId) return { success: false, error: "No se obtuvo ID de consignación." };

    // 2) items (cantidad_aprobada inicia igual a cantidad)
    const itemsToInsert = items.map((it) => {
      const productoId = resolveProductoId(it);
      const cantidad = Number(it.cantidad ?? 0);
      return {
        consignacion_id: consignacionId,
        producto_id: productoId,
        cantidad,
        cantidad_aprobada: Number(it.cantidad_aprobada ?? cantidad),
        cantidad_devuelta: 0,
        cantidad_vendida: 0,
      };
    });

    const { error: itemsErr } = await supabaseAdmin
      .from("consignacion_items")
      .insert(itemsToInsert);

    if (itemsErr) {
      console.error("[createConsignacionSolicitudAction] insert items error:", itemsErr);
      return { success: false, error: "No se pudieron registrar los items." };
    }

    return { success: true, consignacionId, codigo };
  } catch (err: any) {
    console.error("[createConsignacionSolicitudAction] unexpected:", err);
    return { success: false, error: "Error inesperado al crear solicitud." };
  }
}

/**
 * Guardar ajustes mientras está PENDIENTE:
 * - fecha_entrega
 * - admin_comentario
 * - cantidades aprobadas por item (cantidad_aprobada)
 */
export async function updateConsignacionSolicitudAction(
  input: UpdateSolicitudInput
): Promise<{ success: boolean; error?: string }> {
  try {
    const { consignacionId, fechaEntrega, comentarioAdmin, items } = input;

    if (!consignacionId) return { success: false, error: "ID requerido" };

    const { data: consRow, error: consErr } = await supabaseAdmin
      .from("consignaciones")
      .select("id,estado")
      .eq("id", consignacionId)
      .limit(1)
      .maybeSingle();

    if (consErr) {
      console.error("[updateConsignacionSolicitudAction] read consignacion error:", consErr);
      return { success: false, error: "No se pudo leer la consignación" };
    }

    if (!consRow) return { success: false, error: "Consignación no encontrada" };
    if (consRow.estado !== "PENDIENTE")
      return { success: false, error: "Solo se puede editar si está PENDIENTE" };

    // header update
    const fechaEntregaISO = fechaEntrega
      ? new Date(`${fechaEntrega}T00:00:00.000Z`).toISOString()
      : null;

    const { error: updErr } = await supabaseAdmin
      .from("consignaciones")
      .update({
        fecha_entrega: fechaEntregaISO,
        admin_comentario: comentarioAdmin ? comentarioAdmin : null,
      })
      .eq("id", consignacionId);

    if (updErr) {
      console.error("[updateConsignacionSolicitudAction] update header error:", updErr);
      return { success: false, error: "No se pudo actualizar cabecera" };
    }

    // items update (cantidad_aprobada)
    if (items && items.length) {
      for (const it of items) {
        const { error: itErr } = await supabaseAdmin
          .from("consignacion_items")
          .update({ cantidad_aprobada: it.cantidadAprobada })
          .eq("id", it.itemId)
          .eq("consignacion_id", consignacionId);

        if (itErr) {
          console.error("[updateConsignacionSolicitudAction] update item error:", itErr);
          return { success: false, error: "No se pudo actualizar items" };
        }
      }
    }

    return { success: true };
  } catch (err: any) {
    console.error("[updateConsignacionSolicitudAction] unexpected:", err);
    return { success: false, error: "Error inesperado al guardar cambios" };
  }
}

export type UpdateAbiertaInput = {
  consignacionId: number;
  fechaEntrega: string | null; // YYYY-MM-DD
  comentarioAdmin: string | null;
  items: { itemId: number; cantidadDevuelta: number; cantidadVendida: number }[];
};

export async function updateConsignacionAbiertaAction(
  input: UpdateAbiertaInput
): Promise<{ success: boolean; error?: string }> {
  try {
    const { consignacionId, fechaEntrega, comentarioAdmin, items } = input;

    if (!consignacionId) return { success: false, error: "ID requerido" };

    const { data: consRow, error: consErr } = await supabaseAdmin
      .from("consignaciones")
      .select("id,estado")
      .eq("id", consignacionId)
      .maybeSingle();

    if (consErr) {
      console.error("[updateConsignacionAbiertaAction] read consignacion error:", consErr);
      return { success: false, error: "No se pudo leer la consignación" };
    }

    if (!consRow) return { success: false, error: "Consignación no encontrada" };
    if (consRow.estado !== "ABIERTA")
      return { success: false, error: "Solo se puede editar si está ABIERTA" };

    // Header update (opcional)
    const fechaEntregaISO = fechaEntrega
      ? new Date(`${fechaEntrega}T00:00:00.000Z`).toISOString()
      : null;

    const { error: headerErr } = await supabaseAdmin
      .from("consignaciones")
      .update({
        fecha_entrega: fechaEntregaISO,
        admin_comentario: comentarioAdmin ? comentarioAdmin : null,
      })
      .eq("id", consignacionId);

    if (headerErr) {
      console.error("[updateConsignacionAbiertaAction] update header error:", headerErr);
      return { success: false, error: "No se pudo actualizar cabecera" };
    }

    if (!items?.length) return { success: true };

    // Leer items actuales para calcular deltas de devolución (stock)
    const itemIds = items.map((x) => x.itemId);

    const { data: currentItems, error: curErr } = await supabaseAdmin
      .from("consignacion_items")
      .select("id,producto_id,cantidad,cantidad_aprobada,cantidad_devuelta,cantidad_vendida")
      .in("id", itemIds)
      .eq("consignacion_id", consignacionId);

    if (curErr) {
      console.error("[updateConsignacionAbiertaAction] read items error:", curErr);
      return { success: false, error: "No se pudieron leer items" };
    }

    const currentMap = new Map<number, any>((currentItems || []).map((it: any) => [it.id, it]));

    // Procesar item por item
    for (const it of items) {
      const cur = currentMap.get(it.itemId);
      if (!cur) continue;

      const shipped = Number(
        (cur.cantidad_aprobada ?? cur.cantidad ?? 0)
      );

      const newDev = Math.max(0, Math.floor(Number(it.cantidadDevuelta || 0)));
      const newVen = Math.max(0, Math.floor(Number(it.cantidadVendida || 0)));

      if (newDev + newVen > shipped) {
        return {
          success: false,
          error: `No puedes registrar Devuelta+Vendida mayor a Enviada (item ${cur.id}).`,
        };
      }

      const oldDev = Number(cur.cantidad_devuelta ?? 0);
      const deltaDev = newDev - oldDev;

      // Si aumenta devolución => entra stock (devolucion)
      // Si disminuye devolución => revertimos (salida) porque estás "quitando" stock que ya regresó
      if (deltaDev !== 0) {
        const qty = Math.abs(deltaDev);
        const stockItems: ConsignacionStockItem[] = [
          { producto_id: Number(cur.producto_id), cantidad: qty },
        ];

        if (deltaDev > 0) {
          await adjustStockForConsignacion(stockItems, "devolucion", "consignacion-devolucion");
        } else {
          await adjustStockForConsignacion(stockItems, "salida", "consignacion-devolucion-revert");
        }
      }

      const { error: updErr } = await supabaseAdmin
        .from("consignacion_items")
        .update({
          cantidad_devuelta: newDev,
          cantidad_vendida: newVen,
        })
        .eq("id", it.itemId)
        .eq("consignacion_id", consignacionId);

      if (updErr) {
        console.error("[updateConsignacionAbiertaAction] update item error:", updErr);
        return { success: false, error: "No se pudo actualizar items" };
      }
    }

    return { success: true };
  } catch (err: any) {
    console.error("[updateConsignacionAbiertaAction] unexpected:", err);
    return { success: false, error: "Error inesperado al guardar cambios" };
  }
}

/**
 * Aprobar: PENDIENTE -> ABIERTA
 * - Aplica stock salida usando cantidad_aprobada (fallback cantidad)
 */
export async function approveConsignacionAction(
  input: UpdateSolicitudInput
): Promise<{ success: boolean; error?: string }> {
  try {
    const { consignacionId, fechaEntrega, comentarioAdmin, items } = input || ({} as any);

    const id = Number(consignacionId);
    if (!Number.isFinite(id) || id <= 0) {
      return { success: false, error: "ID requerido" };
    }

    // 1) Validar estado actual
    const { data: consRow, error: consErr } = await supabaseAdmin
      .from("consignaciones")
      .select("id,estado")
      .eq("id", id)
      .limit(1)
      .maybeSingle();

    if (consErr) {
      console.error("[approveConsignacionAction] read consignacion error:", consErr);
      return { success: false, error: "No se pudo leer la consignación" };
    }

    if (!consRow) return { success: false, error: "Consignación no encontrada" };
    if (consRow.estado !== "PENDIENTE") {
      return { success: false, error: "Solo se puede aprobar si está PENDIENTE" };
    }

    // 2) Guardar header (fecha_entrega / admin_comentario) ANTES de aprobar
    const fechaEntregaISO = fechaEntrega
      ? new Date(`${fechaEntrega}T00:00:00.000Z`).toISOString()
      : null;

    const { error: headerErr } = await supabaseAdmin
      .from("consignaciones")
      .update({
        fecha_entrega: fechaEntregaISO,
        admin_comentario: comentarioAdmin ? comentarioAdmin : null,
      })
      .eq("id", id)
      .eq("estado", "PENDIENTE");

    if (headerErr) {
      console.error("[approveConsignacionAction] update header error:", headerErr);
      return { success: false, error: "No se pudo actualizar cabecera" };
    }

    // 3) Guardar cantidades aprobadas por item (cantidad_aprobada)
    if (items?.length) {
      for (const it of items) {
        const { error: itErr } = await supabaseAdmin
          .from("consignacion_items")
          .update({ cantidad_aprobada: it.cantidadAprobada })
          .eq("id", it.itemId)
          .eq("consignacion_id", id);

        if (itErr) {
          console.error("[approveConsignacionAction] update item error:", itErr);
          return { success: false, error: "No se pudieron actualizar items" };
        }
      }
    }

    // 4) Leer items ya actualizados para aplicar salida de stock (cantidad_aprobada fallback cantidad)
    const { data: dbItems, error: itemsErr } = await supabaseAdmin
      .from("consignacion_items")
      .select("id,producto_id,cantidad,cantidad_aprobada")
      .eq("consignacion_id", id);

    if (itemsErr) {
      console.error("[approveConsignacionAction] read items error:", itemsErr);
      return { success: false, error: "No se pudieron leer items" };
    }

    const list = (dbItems || []) as any[];
    if (!list.length) return { success: false, error: "Sin items" };

    const stockItems: ConsignacionStockItem[] = list.map((it) => {
      const requested = Number(it.cantidad ?? 0);
      const approvedRaw = it.cantidad_aprobada;
      const approved =
        approvedRaw === null || typeof approvedRaw === "undefined"
          ? requested
          : Number(approvedRaw ?? 0);

      const qty = Math.max(0, Math.min(requested, Math.floor(approved)));

      return {
        producto_id: Number(it.producto_id),
        cantidad: qty,
      };
    });

    await adjustStockForConsignacion(stockItems, "salida", "consignacion-salida");

    // 5) Cambiar estado PENDIENTE -> ABIERTA
    const { error: updErr } = await supabaseAdmin
      .from("consignaciones")
      .update({ estado: "ABIERTA" })
      .eq("id", id)
      .eq("estado", "PENDIENTE");

    if (updErr) {
      console.error("[approveConsignacionAction] update estado error:", updErr);
      return { success: false, error: "No se pudo actualizar estado" };
    }

    return { success: true };
  } catch (err: any) {
    console.error("[approveConsignacionAction] unexpected:", err);
    return { success: false, error: "Error inesperado al aprobar" };
  }
}


/**
 * Denegar: PENDIENTE -> ANULADA (y guarda admin_comentario)
 */
export async function denyConsignacionAction(input: {
  consignacionId: number;
  comentarioAdmin: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const { consignacionId, comentarioAdmin } = input;

    if (!consignacionId) return { success: false, error: "ID requerido" };
    if (!comentarioAdmin?.trim())
      return { success: false, error: "Comentario requerido para denegar" };

    const { data: consRow, error: consErr } = await supabaseAdmin
      .from("consignaciones")
      .select("id,estado")
      .eq("id", consignacionId)
      .limit(1)
      .maybeSingle();

    if (consErr) {
      console.error("[denyConsignacionAction] read consignacion error:", consErr);
      return { success: false, error: "No se pudo leer la consignación" };
    }

    if (!consRow) return { success: false, error: "Consignación no encontrada" };
    if (consRow.estado !== "PENDIENTE")
      return { success: false, error: "Solo se puede denegar si está PENDIENTE" };

    const { error: updErr } = await supabaseAdmin
      .from("consignaciones")
      .update({
        estado: "ANULADA",
        admin_comentario: comentarioAdmin.trim(),
      })
      .eq("id", consignacionId)
      .eq("estado", "PENDIENTE");

    if (updErr) {
      console.error("[denyConsignacionAction] update error:", updErr);
      return { success: false, error: "No se pudo denegar" };
    }

    return { success: true };
  } catch (err: any) {
    console.error("[denyConsignacionAction] unexpected:", err);
    return { success: false, error: "Error inesperado al denegar" };
  }
}

function parseEmailList(raw?: string | null) {
  if (!raw) return [];
  return raw
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean)
    .filter((x) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x));
}

function safeEmail(v: unknown) {
  const s = String(v ?? "").trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) ? s : "";
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString("es-PE");
}

async function sendConsignacionClosedEmails(args: {
  cons: { id: number; codigo: string; colegio_id: number; fecha_salida: string | null; fecha_cierre: string | null };
  items: Array<{
    producto_id: number;
    cantidad: number;
    cantidad_aprobada: number | null;
    cantidad_vendida: number;
    cantidad_devuelta: number;
    product?: { internal_id: string | null; descripcion: string | null } | null;
  }>;
}) {
  const resendKey = String(process.env.RESEND_API_KEY ?? "").trim();
  if (!resendKey) return;

  const from =
    String(process.env.CONSIGNACION_CLOSE_FROM_EMAIL ?? "").trim() ||
    String(process.env.CONTACT_FROM_EMAIL ?? "").trim();

  const toTeam =
    parseEmailList(process.env.CONSIGNACION_CLOSE_TO_EMAIL) ||
    parseEmailList(process.env.CONTACT_TO_EMAIL);

  const finalToTeam = toTeam.length ? toTeam : parseEmailList(process.env.CONTACT_TO_EMAIL);

  if (!from || !finalToTeam.length) return;

  // colegio from DB
  const { data: colegio } = await supabaseAdmin
    .from("colegios")
    .select("nombre_comercial, razon_social, contacto_email, contacto_nombre")
    .eq("id", args.cons.colegio_id)
    .maybeSingle();

  const colegioName =
    colegio?.nombre_comercial || colegio?.razon_social || "Colegio";

  const colegioEmail = safeEmail(colegio?.contacto_email);

  const lines = args.items.map((it) => {
    const code = it.product?.internal_id ? String(it.product.internal_id) : `ID:${it.producto_id}`;
    const name = it.product?.descripcion ? String(it.product.descripcion) : "Producto";
    const approved = Number(it.cantidad_aprobada ?? it.cantidad ?? 0);
    const sold = Number(it.cantidad_vendida ?? 0);
    const returned = Number(it.cantidad_devuelta ?? 0);
    return `- ${code} — ${name} | Approved: ${approved} | Sold: ${sold} | Returned: ${returned}`;
  });

  const totalApproved = args.items.reduce(
    (acc, it) => acc + Number(it.cantidad_aprobada ?? it.cantidad ?? 0),
    0
  );
  const totalSold = args.items.reduce((acc, it) => acc + Number(it.cantidad_vendida ?? 0), 0);
  const totalReturned = args.items.reduce((acc, it) => acc + Number(it.cantidad_devuelta ?? 0), 0);

  const subjectTeam = `[DynEdu] Consignación cerrada ${args.cons.codigo} - ${colegioName}`;
  const textTeam = [
    `Consignación cerrada`,
    `--------------------------------`,
    `Código: ${args.cons.codigo}`,
    `Colegio: ${colegioName}`,
    `Salida: ${formatDate(args.cons.fecha_salida)}`,
    `Cierre: ${formatDate(args.cons.fecha_cierre)}`,
    `Totales -> Approved: ${totalApproved} | Sold: ${totalSold} | Returned: ${totalReturned}`,
    `--------------------------------`,
    `Items:`,
    ...lines,
  ].join("\n");

  const resend = new Resend(resendKey);

  // 1) Team email
  await resend.emails.send({
    from,
    to: finalToTeam,
    replyTo: colegioEmail || undefined,
    subject: subjectTeam,
    text: textTeam,
  });

  // 2) Colegio confirmation
  if (colegioEmail) {
    const subjectSchool = `Consignación cerrada ✅ (${args.cons.codigo})`;
    const textSchool = [
      `Hola ${colegioName},`,
      ``,
      `Tu consignación ha sido cerrada.`,
      `Código: ${args.cons.codigo}`,
      `Fecha salida: ${formatDate(args.cons.fecha_salida)}`,
      `Fecha cierre: ${formatDate(args.cons.fecha_cierre)}`,
      `Totales -> Approved: ${totalApproved} | Sold: ${totalSold} | Returned: ${totalReturned}`,
      ``,
      `Detalle:`,
      ...lines,
      ``,
      `DynEdu / PRG Dinamics`,
    ].join("\n");

    await resend.emails.send({
      from,
      to: colegioEmail,
      replyTo: finalToTeam[0],
      subject: subjectSchool,
      text: textSchool,
    });
  }
}


/**
 * Cerrar: ABIERTA -> CERRADA (setea fecha_cierre)
 */
/**
 * Cerrar: ABIERTA -> CERRADA (setea fecha_cierre)
 */
export async function closeConsignacionAction(
  consignacionId: number
): Promise<{ success: boolean; error?: string }> {
  try {
    const id = Number(consignacionId);
    if (!Number.isFinite(id) || id <= 0) return { success: false, error: "ID requerido" };

    const { data: consRow, error: consErr } = await supabaseAdmin
      .from("consignaciones")
      .select("id,codigo,estado,colegio_id,fecha_salida,fecha_cierre")
      .eq("id", id)
      .limit(1)
      .maybeSingle();

    if (consErr) {
      console.error("[closeConsignacionAction] read consignacion error:", consErr);
      return { success: false, error: "No se pudo leer la consignación" };
    }
    if (!consRow) return { success: false, error: "Consignación no encontrada" };
    if (consRow.estado !== "ABIERTA") {
      return { success: false, error: "Solo se puede cerrar si está ABIERTA" };
    }

    // Read items + product labels
    const { data: items, error: itemsErr } = await supabaseAdmin
      .from("consignacion_items")
      .select("producto_id,cantidad,cantidad_aprobada,cantidad_vendida,cantidad_devuelta, product:productos(internal_id,descripcion)")
      .eq("consignacion_id", id);

    if (itemsErr) {
      console.error("[closeConsignacionAction] read items error:", itemsErr);
      return { success: false, error: "No se pudieron leer items" };
    }

    // Validate: sold + returned must equal approved (or cantidad if approved is null)
    const notBalanced = (items || []).filter((it: any) => {
      const approved = Number(it.cantidad_aprobada ?? it.cantidad ?? 0);
      const sold = Number(it.cantidad_vendida ?? 0);
      const returned = Number(it.cantidad_devuelta ?? 0);
      return sold + returned !== approved;
    });

    if (notBalanced.length) {
      return {
        success: false,
        error:
          "No se puede cerrar: hay items donde VENDIDA + DEVUELTA no cuadra con lo ENVIADO/APROBADO.",
      };
    }

    const now = new Date().toISOString();

    const { error: updErr } = await supabaseAdmin
      .from("consignaciones")
      .update({ estado: "CERRADA", fecha_cierre: now })
      .eq("id", id)
      .eq("estado", "ABIERTA");

    if (updErr) {
      console.error("[closeConsignacionAction] update error:", updErr);
      return { success: false, error: "No se pudo cerrar la consignación" };
    }

    // Fire-and-forget emails (do not fail closing if email fails)
    try {
      await sendConsignacionClosedEmails({
        cons: {
          id: consRow.id,
          codigo: consRow.codigo,
          colegio_id: consRow.colegio_id,
          fecha_salida: consRow.fecha_salida,
          fecha_cierre: now,
        },
        items: (items || []) as any,
      });
    } catch (e) {
      console.error("[closeConsignacionAction] email error:", e);
    }

    return { success: true };
  } catch (err: any) {
    console.error("[closeConsignacionAction] unexpected:", err);
    return { success: false, error: "Error inesperado al cerrar" };
  }
}


/**
 * Devuelve cantidades (si ya lo usas) — lo dejo como está pero sin romper columnas nuevas
 */
export async function registrarDevolucionConsignacionAction(input: {
  consignacionId: number;
  devoluciones: { itemId: number; cantidadDevuelta: number }[];
}): Promise<{ success: boolean; error?: string }> {
  try {
    const { consignacionId, devoluciones } = input;

    if (!consignacionId) return { success: false, error: "ID requerido" };
    if (!devoluciones?.length)
      return { success: false, error: "No hay devoluciones para registrar" };

    // update items
    for (const d of devoluciones) {
      const { error } = await supabaseAdmin
        .from("consignacion_items")
        .update({ cantidad_devuelta: d.cantidadDevuelta })
        .eq("id", d.itemId)
        .eq("consignacion_id", consignacionId);

      if (error) {
        console.error("[registrarDevolucionConsignacionAction] item update error:", error);
        return { success: false, error: "No se pudo actualizar devolución" };
      }
    }

    // ajusta stock (entrada) por devoluciones
    const { data: items, error: itemsErr } = await supabaseAdmin
      .from("consignacion_items")
      .select("producto_id,cantidad_devuelta")
      .eq("consignacion_id", consignacionId);

    if (itemsErr) {
      console.error("[registrarDevolucionConsignacionAction] read items error:", itemsErr);
      return { success: false, error: "No se pudieron leer items para stock" };
    }

    const stockItems: ConsignacionStockItem[] = (items || []).map((it: any) => ({
      producto_id: Number(it.producto_id),
      cantidad: Number(it.cantidad_devuelta ?? 0),
    }));

    await adjustStockForConsignacion(stockItems, "devolucion", "consignacion-devolucion");

    return { success: true };
  } catch (err: any) {
    console.error("[registrarDevolucionConsignacionAction] unexpected:", err);
    return { success: false, error: "Error inesperado al registrar devolución" };
  }
}

/**
 * Fetch completo para panel
 */
export async function fetchConsignacionesWithItems(): Promise<ConsignacionWithItems[]> {
  // Consignaciones (tolerante a DBs antiguas sin columnas nuevas)
  let consignaciones: any[] | null = null;
  let consError: any | null = null;

  const baseSelect = "id,codigo,colegio_id,fecha_salida,estado,observaciones";
  const fullSelect =
    "id,codigo,colegio_id,fecha_salida,fecha_cierre,fecha_entrega,estado,observaciones,admin_comentario";

  ({ data: consignaciones, error: consError } = await supabaseAdmin
    .from("consignaciones")
    .select(fullSelect)
    .order("id", { ascending: false })
    .limit(300));

  if (consError?.message?.includes("does not exist")) {
    // fallback: columnas nuevas aún no migradas
    ({ data: consignaciones, error: consError } = await supabaseAdmin
      .from("consignaciones")
      .select(baseSelect)
      .order("id", { ascending: false })
      .limit(300));
  }

  if (consError) {
    console.error("[fetchConsignacionesWithItems] consignaciones error:", consError);
    return [];
  }

  const list = (consignaciones || []) as any[];
  if (!list.length) return [];

  // colegios
  const colegioIds = Array.from(new Set(list.map((c) => c.colegio_id).filter(Boolean)));
  const { data: colegiosData, error: colError } = await supabaseAdmin
    .from("colegios")
    .select("id,ruc,razon_social,nombre_comercial")
    .in("id", colegioIds);

  if (colError) console.error("[fetchConsignacionesWithItems] colegios error:", colError);
  const colegiosMap = new Map<number, ColegioBasic>(
    (colegiosData || []).map((c: any) => [c.id, c])
  );

  // items
  const consIds = list.map((c) => c.id);
  // items (tolerante a DBs antiguas sin columnas nuevas)
  let itemsData: any[] | null = null;
  let itemsError: any | null = null;

  const itemsBaseSelect = "id,consignacion_id,producto_id,cantidad";
  const itemsFullSelect =
    "id,consignacion_id,producto_id,cantidad,cantidad_aprobada,cantidad_devuelta,cantidad_vendida";

  ({ data: itemsData, error: itemsError } = await supabaseAdmin
    .from("consignacion_items")
    .select(itemsFullSelect)
    .in("consignacion_id", consIds));

  if (itemsError?.message?.includes("does not exist")) {
    ({ data: itemsData, error: itemsError } = await supabaseAdmin
      .from("consignacion_items")
      .select(itemsBaseSelect)
      .in("consignacion_id", consIds));
  }

  if (itemsError) {
    console.error("[fetchConsignacionesWithItems] items error:", itemsError);
    return list.map((c) => ({
      ...c,
      colegio: colegiosMap.get(c.colegio_id) ?? null,
      items: [],
      totals: { totalItems: 0, totalUnits: 0, totalUnidades: 0 },
    })) as any;
  }

  const items = (itemsData || []) as any[];
  const productIds = Array.from(new Set(items.map((i) => i.producto_id).filter(Boolean)));

  // products
  const { data: productosData, error: prodError } = await supabaseAdmin
    .from("productos")
    .select("id,internal_id,descripcion,editorial,isbn")
    .in("id", productIds);

  if (prodError) console.error("[fetchConsignacionesWithItems] productos error:", prodError);

  const productsMap = new Map<number, ProductoBasic>(
    (productosData || []).map((p: any) => [p.id, p])
  );

  const itemsByCons = new Map<number, ConsignacionItemRow[]>();
  for (const it of items) {
    const row: ConsignacionItemRow = {
      id: it.id,
      consignacion_id: it.consignacion_id,
      producto_id: it.producto_id,
      cantidad: Number(it.cantidad ?? 0),
      cantidad_aprobada:
        it.cantidad_aprobada === null || typeof it.cantidad_aprobada === "undefined"
          ? null
          : Number(it.cantidad_aprobada ?? 0),
      cantidad_devuelta: Number(it.cantidad_devuelta ?? 0),
      cantidad_vendida: Number(it.cantidad_vendida ?? 0),
      product: productsMap.get(it.producto_id) ?? null,
      producto: productsMap.get(it.producto_id) ?? null,
    };

    const arr = itemsByCons.get(it.consignacion_id) ?? [];
    arr.push(row);
    itemsByCons.set(it.consignacion_id, arr);
  }

  return list.map((c) => {
    const consItems = itemsByCons.get(c.id) ?? [];
    const totals = {
      totalItems: consItems.length,
      totalUnits: consItems.reduce((s, it) => s + Number(it.cantidad ?? 0), 0),
      totalUnidades: consItems.reduce((s, it) => s + Number(it.cantidad ?? 0), 0),
    };

    return {
      id: c.id,
      codigo: c.codigo,
      colegio_id: c.colegio_id,
      fecha_salida: c.fecha_salida,
      fecha_cierre: c.fecha_cierre ?? null,
      fecha_entrega: c.fecha_entrega ?? null,
      estado: c.estado as ConsignacionEstado,
      observaciones: c.observaciones ?? null,
      admin_comentario: c.admin_comentario ?? null,
      colegio: colegiosMap.get(c.colegio_id) ?? null,
      items: consItems,
      totals,
    } as ConsignacionWithItems;
  });
}
