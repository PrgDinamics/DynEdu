// src/app/api/dynedu/pdf/pedidos/[id]/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { fetchCompanyBrandingForPdf } from "@/modules/pdf/companyBranding";
import { renderPdf } from "@/modules/pdf/renderPdf";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params;

    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    const pedidoId = Number(id);
    if (!Number.isFinite(pedidoId)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    // 1) Header
    const { data: pedido, error: pedidoErr } = await supabaseAdmin
      .from("pedidos")
      .select(
        "id,codigo,proveedor_nombre,fecha_registro,fecha_entrega,estado,unidades_solicitadas,unidades_recibidas"
      )
      .eq("id", pedidoId)
      .maybeSingle();

    if (pedidoErr) {
      return NextResponse.json({ error: pedidoErr.message }, { status: 500 });
    }
    if (!pedido) {
      return NextResponse.json({ error: "Pedido not found" }, { status: 404 });
    }

    // 2) Items
    const { data: items, error: itemsErr } = await supabaseAdmin
      .from("pedido_items")
      .select(
        `
        id,
        producto_id,
        producto_descripcion,
        cantidad_solicitada,
        cantidad_recibida,
        producto:productos(codigo_venta)
      `
      )
      .eq("pedido_id", pedidoId);

    if (itemsErr) {
      return NextResponse.json({ error: itemsErr.message }, { status: 500 });
    }

    const branding = await fetchCompanyBrandingForPdf();

    const fmtDate = (v: any) =>
      v ? new Date(v).toLocaleString("es-PE") : "—";

    const pdf = await renderPdf({
      title: "Pedido",
      subtitle: `Código: ${pedido.codigo}`,
      branding,
      meta: [
        { label: "Proveedor", value: pedido.proveedor_nombre ?? "—" },
        { label: "Estado", value: pedido.estado ?? "—" },
        { label: "Registro", value: fmtDate(pedido.fecha_registro) },
        { label: "Entrega", value: fmtDate(pedido.fecha_entrega) },
        {
          label: "Unid. solicitadas",
          value: String(pedido.unidades_solicitadas ?? 0),
        },
        {
          label: "Unid. recibidas",
          value: String(pedido.unidades_recibidas ?? 0),
        },
      ],
      tables: [
        {
          title: "Líneas del pedido",
          columns: [
            { key: "code", header: "Código", width: 90 },
            { key: "desc", header: "Descripción" },
            { key: "req", header: "Solicitada", width: 90, align: "right" },
            { key: "rec", header: "Recibida", width: 90, align: "right" },
          ],
          rows: (items ?? []).map((it: any) => ({
            code: it.producto?.codigo_venta ?? "—",
            desc: it.producto_descripcion ?? "—",
            req: String(it.cantidad_solicitada ?? 0),
            rec: String(it.cantidad_recibida ?? 0),
          })),
        },
      ],
    });

    return new Response(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="pedido-${pedido.codigo}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e: any) {
    console.error("[pdf pedidos] error:", e);
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
