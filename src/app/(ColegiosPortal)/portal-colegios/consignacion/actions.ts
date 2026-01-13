"use server";

import { getPortalColegio } from "../actions";

// Reuse the panel action but enforce session -> colegioId match
import { createConsignacionSolicitudAction } from "@/app/(PrgDinamics)/dynedu/(panel)/consignaciones/actions";

import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";

export type PortalSolicitudItem = {
  productoId: number;
  cantidad: number;
};

export type PortalSolicitudInput = {
  colegioId: number;
  fechaSalida: string;
  observaciones?: string;
  items: PortalSolicitudItem[];
};

export type PortalSolicitudResult = {
  success: boolean;
  error?: string;
  consignacionId?: number;
  codigo?: string;
};

type ProductMini = {
  id: number;
  internal_id: string;
  descripcion: string;
};

function formatDate(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("es-PE");
}

function safeEmail(value?: string | null) {
  const v = String(value ?? "").trim();
  if (!v) return "";
  const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  return ok ? v : "";
}

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

function parseEmailList(raw?: string | null) {
  if (!raw) return [];
  return raw
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean)
    .filter((x) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x));
}

async function sendConsignacionEmails(params: {
  colegio: any;
  codigo?: string;
  consignacionId?: number;
  fechaSalida: string;
  observaciones?: string;
  items: PortalSolicitudItem[];
}) {
  const resendKey = String(process.env.RESEND_API_KEY ?? "").trim();
  if (!resendKey) {
    console.warn("[sendConsignacionEmails] RESEND_API_KEY missing");
    return;
  }

  const resend = new Resend(resendKey);

  const from =
    String(process.env.CONSIGNACION_FROM_EMAIL ?? "").trim() ||
    String(process.env.CONTACT_FROM_EMAIL ?? "").trim() ||
    "onboarding@resend.dev";

  const toTeamList =
    parseEmailList(process.env.CONSIGNACION_TO_EMAIL) ||
    parseEmailList(process.env.CONTACT_TO_EMAIL);

  const finalToTeam = toTeamList.length
    ? toTeamList
    : parseEmailList(process.env.CONTACT_TO_EMAIL);

  if (!finalToTeam.length) {
    console.warn("[sendConsignacionEmails] No team recipient configured");
    return;
  }

  // ✅ Always fetch colegio email from DB (source of truth)
  const colegioId = Number(params.colegio?.id);
  const { data: colegioDb, error: colegioErr } = await supabaseAdmin
    .from("colegios")
    .select(
      "id, contacto_email, contacto_nombre, contacto_celular, nombre_comercial, razon_social"
    )
    .eq("id", colegioId)
    .maybeSingle();

  if (colegioErr) {
    console.warn("[sendConsignacionEmails] colegio read error:", colegioErr.message);
  }

  const colegioName =
    colegioDb?.nombre_comercial ||
    colegioDb?.razon_social ||
    params.colegio?.nombre_comercial ||
    params.colegio?.razon_social ||
    "Colegio";

  const colegioEmail =
    safeEmail(colegioDb?.contacto_email) ||
    safeEmail(params.colegio?.contacto_email) ||
    safeEmail(params.colegio?.email);

  const contactoNombre =
    colegioDb?.contacto_nombre || params.colegio?.contacto_nombre || "";

  const contactoCelular =
    colegioDb?.contacto_celular || params.colegio?.contacto_celular || "";

  console.log("[sendConsignacionEmails] colegioEmail:", colegioEmail || "(empty)");

  // Pull product labels for email
  const ids = params.items.map((i) => i.productoId);
  const { data: products } = await supabaseAdmin
    .from("productos")
    .select("id, internal_id, descripcion")
    .in("id", ids);

  const map = new Map<number, ProductMini>();
  (products ?? []).forEach((p: any) => map.set(Number(p.id), p as ProductMini));

  const lines = params.items.map((it) => {
    const p = map.get(Number(it.productoId));
    const label = p
      ? `${p.internal_id} — ${p.descripcion}`
      : `Producto #${it.productoId}`;
    return `- ${label} | Cantidad: ${it.cantidad}`;
  });

  const meta = [
    `Código: ${params.codigo ?? "—"}`,
    `Consignación ID: ${params.consignacionId ?? "—"}`,
    `Estado: PENDIENTE`,
    `Fecha salida (solicitada): ${formatDate(params.fechaSalida)}`,
    params.observaciones ? `Observaciones: ${params.observaciones}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  // 1) Email to team (multi-recipient)
  await resend.emails.send({
    from,
    to: finalToTeam,
    replyTo: colegioEmail || undefined,
    subject: `[Portal Colegios] Nueva solicitud de consignación (${colegioName})`,
    text: [
      `Nueva solicitud de consignación`,
      `--------------------------------`,
      `Colegio: ${colegioName}`,
      colegioEmail ? `Email: ${colegioEmail}` : "",
      contactoNombre ? `Contacto: ${contactoNombre}` : "",
      contactoCelular ? `Celular: ${contactoCelular}` : "",
      `--------------------------------`,
      `Items:`,
      ...lines,
      `--------------------------------`,
      meta,
    ]
      .filter(Boolean)
      .join("\n"),
  });

  // 2) Confirmation to colegio
  if (colegioEmail) {
    await resend.emails.send({
      from,
      to: colegioEmail,
      replyTo: finalToTeam[0],
      subject: `Solicitud recibida ✅ (${params.codigo ?? "Consignación"})`,
      text: [
        `Hola ${colegioName},`,
        ``,
        `Recibimos tu solicitud de consignación.`,
        `Estado: PENDIENTE DE APROBACIÓN`,
        params.codigo ? `Código: ${params.codigo}` : "",
        params.consignacionId ? `ID: ${params.consignacionId}` : "",
        `Fecha solicitada: ${formatDate(params.fechaSalida)}`,
        params.observaciones ? `Observaciones: ${params.observaciones}` : "",
        ``,
        `Detalle:`,
        ...lines,
        ``,
        `DynEdu / PRG Dinamics`,
      ]
        .filter(Boolean)
        .join("\n"),
    });
  }
}


export async function createPortalConsignacionSolicitudAction(
  input: PortalSolicitudInput
): Promise<PortalSolicitudResult> {
  const colegio = await getPortalColegio();
  if (!colegio) {
    return { success: false, error: "Sesión expirada. Vuelve a ingresar." };
  }

  if (Number(input.colegioId) !== Number(colegio.id)) {
    return { success: false, error: "Sesión inválida para este colegio." };
  }

  const res = await createConsignacionSolicitudAction({
    colegioId: input.colegioId,
    fechaSalida: input.fechaSalida,
    observaciones: input.observaciones,
    items: input.items,
  });

  // Fire-and-forget (no rompemos la creación si el correo falla)
  if ((res as any)?.success) {
    try {
      await sendConsignacionEmails({
        colegio,
        codigo: (res as any)?.codigo,
        consignacionId: (res as any)?.consignacionId,
        fechaSalida: input.fechaSalida,
        observaciones: input.observaciones,
        items: input.items,
      });
    } catch (e) {
      console.error("[PortalConsignacion] email error:", e);
    }
  }

  return res as PortalSolicitudResult;
}
