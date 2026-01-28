import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { renderPdf } from "@/modules/pdf/renderPdf";
import { fetchCompanyBrandingForPdf } from "@/modules/pdf/companyBranding";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type Params = { id: string };

function fmtMoney(n?: number | null) {
  const v = Number(n ?? 0);
  return v.toFixed(2);
}

function fmtDate(value?: string | null) {
  if (!value) return "—";
  try {
    return new Intl.DateTimeFormat("es-PE", {
      dateStyle: "short",
      timeStyle: "short",
      timeZone: "America/Lima",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function deliveryStatusLabel(status?: string | null) {
  const s = String(status ?? "").toUpperCase();
  if (s === "REGISTERED") return "Pedido registrado";
  if (s === "PACKING") return "Empacando";
  if (s === "DELIVERY") return "En reparto";
  if (s === "DELIVERED") return "Entregado";
  return s || "—";
}

export async function GET(_req: Request, ctx: { params: Promise<Params> }) {
  const { id } = await ctx.params;

  if (!id) {
    return NextResponse.json({ error: "Missing order id" }, { status: 400 });
  }

  // IMPORTANTE:
  // Para evitar errores de relaciones (schema cache), NO hacemos join a productos.
  // Usamos snapshots en order_items.
  const { data, error } = await supabaseAdmin
    .from("orders")
    .select(
      `
      id,
      created_at,
      status,
      total,
      currency,
      customer_name,
      customer_email,
      customer_phone,
      shipping_address,
      shipping_district,
      shipping_reference,
      fulfillment_status,
      delivery_date,
      fulfillment_note,
      order_items (
        id,
        quantity,
        line_total,
        title_snapshot,
        codigo_venta_snapshot
      )
    `
    )
    .eq("id", id)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Orden no encontrada" }, { status: 404 });
  }

  const branding = await fetchCompanyBrandingForPdf();

  const items = ((data as any).order_items ?? []) as any[];

  const rows = items.map((it) => {
    const code = String(it.codigo_venta_snapshot ?? "—");
    const desc = String(it.title_snapshot ?? "—");
    const qty = Number(it.quantity ?? 0);
    const totalLine = Number(it.line_total ?? 0);
    const unit = qty > 0 ? totalLine / qty : 0;

    return {
      code,
      desc,
      qty,
      unit: fmtMoney(unit),
      total: fmtMoney(totalLine),
    };
  });

  const meta = [
    { label: "Creado", value: fmtDate((data as any).created_at) },
    { label: "Estado pedido", value: String((data as any).status ?? "—") },
    {
      label: "Estado entrega",
      value: deliveryStatusLabel((data as any).fulfillment_status),
    },
    { label: "Fecha entrega", value: fmtDate((data as any).delivery_date) },

    { label: "Cliente", value: String((data as any).customer_name ?? "—") },
    { label: "Email", value: String((data as any).customer_email ?? "—") },
    { label: "Teléfono", value: String((data as any).customer_phone ?? "—") },

    { label: "Dirección", value: String((data as any).shipping_address ?? "—") },
    { label: "Distrito", value: String((data as any).shipping_district ?? "—") },
    {
      label: "Referencia",
      value: String((data as any).shipping_reference ?? "—"),
    },
  ];

  if ((data as any).fulfillment_note) {
    meta.push({ label: "Nota", value: String((data as any).fulfillment_note) });
  }

  const pdf = await renderPdf({
    branding,
    title: "Entrega",
    subtitle: `ID: ${(data as any).id}`,
    meta,
    tables: [
      {
        title: "Items",
        columns: [
          { key: "code", header: "Código", width: 90 },
          { key: "desc", header: "Descripción", width: 290 },
          { key: "qty", header: "Cant.", width: 60, align: "right" as const },
          { key: "unit", header: "P. unit", width: 70, align: "right" as const },
          { key: "total", header: "Total", width: 70, align: "right" as const },
        ],
        rows,
      },
    ],
  });

  const filename = `entrega-${String((data as any).id)}.pdf`;
  const body = pdf instanceof Buffer ? new Uint8Array(pdf) : (pdf as any);

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      // inline => abre en nueva pestaña (ideal para tu PdfDownloadButton)
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
