// src/app/api/dynedu/pdf/consignaciones/[id]/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { fetchCompanyBrandingForPdf } from "@/modules/pdf/companyBranding";
import { renderPdf } from "@/modules/pdf/renderPdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type Params = { id: string };

function formatDateTimeLima(value?: string | null) {
  if (!value) return "—";
  try {
    return new Intl.DateTimeFormat("es-PE", {
      dateStyle: "short",
      timeStyle: "short",
      timeZone: "America/Lima",
    }).format(new Date(value));
  } catch {
    return String(value);
  }
}

export async function GET(_req: Request, ctx: { params: Promise<Params> }) {
  try {
    const { id } = await ctx.params;

    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    const { data: consign, error: consignErr } = await supabaseAdmin
      .from("consignaciones")
      .select(
        `
        id,
        codigo,
        estado,
        fecha_salida,
        fecha_entrega,
        fecha_cierre,
        observaciones,
        admin_comentario,
        colegio:colegios!consignaciones_colegio_id_fkey (
          id,
          ruc,
          nombre_comercial,
          razon_social
        ),
        items:consignacion_items (
          id,
          cantidad,
          cantidad_aprobada,
          cantidad_devuelta,
          cantidad_vendida,
          producto:producto_id (
            id,
            internal_id,
            codigo_venta,
            descripcion
          )
        )
      `
      )
      .eq("id", id)
      .maybeSingle();

    if (consignErr) {
      return NextResponse.json({ error: consignErr.message }, { status: 500 });
    }
    if (!consign) {
      return NextResponse.json({ error: "Consignación no encontrada" }, { status: 404 });
    }

    const branding = await fetchCompanyBrandingForPdf();

    const colegioName =
      (consign as any).colegio?.nombre_comercial ||
      (consign as any).colegio?.razon_social ||
      "—";
    const colegioRuc = (consign as any).colegio?.ruc || "—";

    const estadoRaw = String((consign as any).estado ?? "").toUpperCase();

    // En tu app: PENDIENTE / ABIERTA / CERRADA / ANULADA (aceptamos ambas)
    const isPending = estadoRaw === "PENDIENTE";
    const isOpen = estadoRaw === "ABIERTA" || estadoRaw === "ABIERTO";

    const rows = (((consign as any).items ?? []) as any[]).map((it) => {
      const prod = it.producto;
      const code = prod?.codigo_venta ?? prod?.internal_id ?? "—";
      const name = prod?.descripcion ?? "—";

      const solicitada = Number(it.cantidad ?? 0);
      const aprobada =
        it.cantidad_aprobada == null ? solicitada : Number(it.cantidad_aprobada ?? 0);
      const devuelta = Number(it.cantidad_devuelta ?? 0);
      const vendida = Number(it.cantidad_vendida ?? 0);

      return { code, name, solicitada, aprobada, devuelta, vendida };
    });

    const columns =
      isPending || isOpen
        ? [
            { key: "code", header: "Código", width: 90 },
            { key: "name", header: "Descripción" },
            { key: "sol", header: "Enviada", width: 70, align: "right" as const },
            { key: "apr", header: "Aprobada", width: 80, align: "right" as const },
          ]
        : [
            { key: "code", header: "Código", width: 90 },
            { key: "name", header: "Descripción" },
            { key: "env", header: "Enviada", width: 70, align: "right" as const },
            { key: "dev", header: "Devuelta", width: 80, align: "right" as const },
            { key: "ven", header: "Vendida", width: 70, align: "right" as const },
          ];

    const tableRows =
      isPending || isOpen
        ? rows.map((r) => ({
            code: r.code,
            name: r.name,
            sol: r.solicitada,
            apr: r.aprobada,
          }))
        : rows.map((r) => ({
            code: r.code,
            name: r.name,
            env: r.aprobada, // lo enviado/aprobado es lo que se considera "enviada" para el cierre
            dev: r.devuelta,
            ven: r.vendida,
          }));

    const totalItems = rows.length;
    const totalUnits =
      isPending || isOpen
        ? rows.reduce((acc, r) => acc + r.aprobada, 0)
        : rows.reduce((acc, r) => acc + r.aprobada, 0);

    const meta = [
      { label: "Código", value: String((consign as any).codigo ?? "—") },
      { label: "Colegio", value: `${colegioName} (RUC: ${colegioRuc})` },
      { label: "Estado", value: String((consign as any).estado ?? "—") },
      { label: "Fecha salida", value: formatDateTimeLima((consign as any).fecha_salida) },
      { label: "Fecha entrega", value: formatDateTimeLima((consign as any).fecha_entrega) },
      { label: "Fecha cierre", value: formatDateTimeLima((consign as any).fecha_cierre) },
    ];

    const comentario =
      (consign as any).admin_comentario || (consign as any).observaciones || null;

    const notesParts: string[] = [];
    notesParts.push(`Totales — Items: ${totalItems} · Unidades: ${totalUnits}`);
    if (comentario) notesParts.push(`Comentario admin: ${comentario}`);
    notesParts.push("Documento generado por DynEdu (PRG Dinamics).");

    const pdf = await renderPdf({
      title: "Consignación",
      subtitle: `ID: ${(consign as any).id}`,
      branding,
      meta,
      tables: [
        {
          title: "Items",
          columns,
          rows: tableRows,
        },
      ],
     
    });

    return new Response(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="consignacion-${(consign as any).codigo ?? id}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e: any) {
    console.error("[pdf consignaciones] error:", e);
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
