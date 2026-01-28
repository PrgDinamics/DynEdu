"use server";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { Resend } from "resend";
import type { FulfillmentStatus } from "../actions";

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    v
  );
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value ?? "").trim());
}

function parseEmailList(raw?: string | null) {
  if (!raw) return [];
  return String(raw)
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean)
    .filter((x) => isEmail(x));
}

function shortId(id: string) {
  return String(id ?? "").replaceAll("-", "").slice(0, 8).toUpperCase();
}

function statusLabel(status: FulfillmentStatus) {
  switch (status) {
    case "REGISTERED":
      return "Pedido registrado";
    case "PACKING":
      return "Empacando";
    case "DELIVERY":
      return "En reparto";
    case "DELIVERED":
      return "Entregado";
    default:
      return String(status);
  }
}

function formatDateOnly(value?: string | null) {
  if (!value) return "—";
  const s = String(value);
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleDateString("es-PE");
}

async function sendOrderUpdateEmail(args: {
  to: string;
  customerName?: string | null;
  orderId: string;
  status: FulfillmentStatus;
  deliveryDate?: string | null;
  prevStatus?: FulfillmentStatus | null;
  prevDeliveryDate?: string | null;
  statusChanged: boolean;
  dateChanged: boolean;
  note?: string | null;
}) {
  const resendKey = String(process.env.RESEND_API_KEY ?? "").trim();
  if (!resendKey) return;

  const from =
    String(process.env.ORDER_STATUS_FROM_EMAIL ?? "").trim() ||
    String(process.env.CONTACT_FROM_EMAIL ?? "").trim();
  if (!from) return;

  const replyToList =
    parseEmailList(process.env.ORDER_STATUS_REPLY_TO_EMAIL) ||
    parseEmailList(process.env.CONTACT_TO_EMAIL);

  const to = String(args.to ?? "").trim();
  if (!isEmail(to)) return;

  const name = String(args.customerName ?? "").trim();
  const greet = name ? `Hola ${name},` : "Hola,";

  const orderCode = shortId(args.orderId);

  const lines: Array<string | null> = [
    greet,
    "",
    `Actualización de tu pedido (${orderCode}):`,
    args.statusChanged
      ? `• Estado: ${statusLabel(args.prevStatus ?? args.status)} → ${statusLabel(args.status)}`
      : `• Estado actual: ${statusLabel(args.status)}`,
    args.dateChanged
      ? `• Fecha de entrega: ${formatDateOnly(args.prevDeliveryDate ?? null)} → ${formatDateOnly(
          args.deliveryDate ?? null
        )}`
      : args.deliveryDate
      ? `• Fecha de entrega: ${formatDateOnly(args.deliveryDate)}`
      : null,
    args.note ? `• Nota: ${String(args.note).trim()}` : null,
    "",
    args.status === "DELIVERED" ? "¡Gracias por tu compra! ✅" : "Te avisaremos si hay nuevas actualizaciones.",
    "— DynEdu / PRG Dinamics",
  ];

  const subject = `DynEdu - Actualización de tu pedido (${orderCode})`;

  const resend = new Resend(resendKey);
  await resend.emails.send({
    from,
    to,
    replyTo: replyToList[0] || undefined,
    subject,
    text: lines.filter(Boolean).join("\n"),
  });
}

export type DeliveryOrderItem = {
  id: number;
  producto_id: number | null;
  title_snapshot: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  productos?: { internal_id: string | null; descripcion: string | null } | null;
};

export type FulfillmentEvent = {
  id: number;
  status: FulfillmentStatus;
  note: string | null;
  created_at: string;
  created_by: string | null;
};

export type DeliveryOrderDetail = {
  id: string;
  status: string;

  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;

  shipping_address: string | null;
  shipping_reference: string | null;
  shipping_district: string | null;
  shipping_notes: string | null;

  total: number | null;
  currency: string | null;

  fulfillment_status: FulfillmentStatus;
  delivery_date: string | null;
  fulfillment_note: string | null;
  fulfillment_updated_at: string | null;

  // ✅ Paso 5
  boleta_number?: string | null;
  is_closed?: boolean | null;
  closed_at?: string | null;

  created_at: string;

  items: DeliveryOrderItem[];
  events: FulfillmentEvent[];
};

export async function fetchDeliveryOrderDetail(orderId: string) {
  if (!orderId || orderId === "undefined" || orderId === "null" || !isUuid(orderId)) return null;

  const { data: order, error } = await supabaseAdmin
    .from("orders")
    .select(
      [
        "id",
        "status",
        "customer_name",
        "customer_email",
        "customer_phone",
        "shipping_address",
        "shipping_reference",
        "shipping_district",
        "shipping_notes",
        "total",
        "currency",
        "fulfillment_status",
        "delivery_date",
        "fulfillment_note",
        "fulfillment_updated_at",
        "boleta_number",
        "is_closed",
        "closed_at",
        "created_at",
      ].join(",")
    )
    .eq("id", orderId)
    .maybeSingle();

  if (error) {
    console.error("[fetchDeliveryOrderDetail] order error:", error.message);
    return null;
  }
  if (!order) return null;

  const { data: items } = await supabaseAdmin
    .from("order_items")
    .select(
      "id, producto_id, title_snapshot, quantity, unit_price, line_total, productos:producto_id(internal_id, descripcion)"
    )
    .eq("order_id", orderId)
    .order("id", { ascending: true });

  const { data: events } = await supabaseAdmin
    .from("order_fulfillment_events")
    .select("id, status, note, created_at, created_by")
    .eq("order_id", orderId)
    .order("created_at", { ascending: true });

  return {
    ...(order as any),
    items: (items ?? []) as any,
    events: (events ?? []) as any,
  } as DeliveryOrderDetail;
}

export type UpdateDeliveryInput = {
  orderId: string;
  fulfillmentStatus: FulfillmentStatus;
  deliveryDate: string | null; // YYYY-MM-DD
  note: string | null;

  // UI decides (modal)
  sendEmail?: boolean;
};

export async function updateDeliveryForOrderAction(
  input: UpdateDeliveryInput
): Promise<{ success: boolean; error?: string }> {
  try {
    const { orderId, fulfillmentStatus, deliveryDate, note } = input;

    if (!isUuid(String(orderId ?? ""))) {
      return { success: false, error: "Orden inválida" };
    }

    const now = new Date().toISOString();

    const { data: prev, error: prevErr } = await supabaseAdmin
      .from("orders")
      .select("customer_email, customer_name, fulfillment_status, delivery_date, fulfillment_note")
      .eq("id", orderId)
      .maybeSingle();

    if (prevErr) return { success: false, error: "No se pudo leer la orden" };
    if (!prev) return { success: false, error: "Orden no encontrada" };

    const prevStatus = (prev as any)?.fulfillment_status as FulfillmentStatus;
    const prevDate = String((prev as any)?.delivery_date ?? "");
    const newDate = String(deliveryDate ?? "");

    const statusChanged = prevStatus !== fulfillmentStatus;
    const dateChanged = prevDate !== newDate;
    const noteChanged =
      String((prev as any)?.fulfillment_note ?? "") !== String(note ?? "");

    const { error: updErr } = await supabaseAdmin
      .from("orders")
      .update({
        fulfillment_status: fulfillmentStatus,
        delivery_date: deliveryDate,
        fulfillment_note: note,
        fulfillment_updated_at: now,
        updated_at: now,
      })
      .eq("id", orderId);

    if (updErr) {
      console.error("[updateDeliveryForOrderAction] update error:", updErr.message);
      return { success: false, error: "No se pudo actualizar la entrega" };
    }

    // ✅ Evento SIEMPRE que cambie algo (y si falla, devolvemos error)
    if (statusChanged || dateChanged || noteChanged) {
      const { error: evInsErr } = await supabaseAdmin
        .from("order_fulfillment_events")
        .insert([
          {
            order_id: orderId,
            status: fulfillmentStatus,
            note: note ?? null,
            created_at: now,
            created_by: null,
          },
        ]);

      if (evInsErr) {
        console.error("[updateDeliveryForOrderAction] event insert error:", evInsErr.message);
        return { success: false, error: "No se pudo registrar el evento de seguimiento" };
      }
    }

    // Email (si se aceptó) solo cuando cambie estado/fecha
    const allowEmail = input.sendEmail !== false;
    const shouldEmail = allowEmail && (statusChanged || dateChanged);

    if (shouldEmail) {
      const email = String((prev as any)?.customer_email ?? "").trim();
      if (isEmail(email)) {
        try {
          await sendOrderUpdateEmail({
            to: email,
            customerName: (prev as any)?.customer_name ?? null,
            orderId,
            status: fulfillmentStatus,
            deliveryDate,
            prevStatus,
            prevDeliveryDate: (prev as any)?.delivery_date ?? null,
            statusChanged,
            dateChanged,
            note,
          });
        } catch (err: any) {
          console.error("[updateDeliveryForOrderAction] email send failed:", err?.message || err);
        }
      }
    }

    return { success: true };
  } catch (e: any) {
    console.error("[updateDeliveryForOrderAction] unexpected:", e?.message || e);
    return { success: false, error: "Error inesperado" };
  }
}

export type UpdateBoletaInput = {
  orderId: string;
  boletaNumber: string | null;
};

export async function updateBoletaNumberForOrderAction(
  input: UpdateBoletaInput
): Promise<{ success: boolean; error?: string }> {
  try {
    const { orderId, boletaNumber } = input;
    if (!isUuid(String(orderId ?? ""))) return { success: false, error: "Orden inválida" };

    const now = new Date().toISOString();
    const value = String(boletaNumber ?? "").trim();

    const { error } = await supabaseAdmin
      .from("orders")
      .update({
        boleta_number: value ? value : null,
        updated_at: now,
      })
      .eq("id", orderId);

    if (error) {
      console.error("[updateBoletaNumberForOrderAction] error:", error.message);
      return { success: false, error: "No se pudo guardar la boleta" };
    }
    return { success: true };
  } catch (e: any) {
    console.error("[updateBoletaNumberForOrderAction] unexpected:", e?.message || e);
    return { success: false, error: "Error inesperado" };
  }
}

export type CloseSaleInput = {
  orderId: string;
  boletaNumber: string;
};

export async function closeSaleForOrderAction(
  input: CloseSaleInput
): Promise<{ success: boolean; error?: string }> {
  try {
    const { orderId, boletaNumber } = input;
    if (!isUuid(String(orderId ?? ""))) return { success: false, error: "Orden inválida" };

    const now = new Date().toISOString();
    const bn = String(boletaNumber ?? "").trim();

    if (!bn) {
      return { success: false, error: "Ingresa el número de boleta para cerrar la venta." };
    }

    const { error } = await supabaseAdmin
      .from("orders")
      .update({
        boleta_number: bn,
        is_closed: true,
        closed_at: now,
        updated_at: now,
      })
      .eq("id", orderId);

    if (error) {
      console.error("[closeSaleForOrderAction] error:", error.message);
      return { success: false, error: "No se pudo cerrar la venta" };
    }

    return { success: true };
  } catch (e: any) {
    console.error("[closeSaleForOrderAction] unexpected:", e?.message || e);
    return { success: false, error: "Error inesperado" };
  }
}
