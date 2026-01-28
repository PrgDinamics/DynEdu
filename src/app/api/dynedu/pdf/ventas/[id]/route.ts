// src/app/api/dynedu/pdf/ventas/[id]/route.ts
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

    // 1) Fetch order header
    const { data: sale, error: saleErr } = await supabaseAdmin
      .from("orders")
      .select(
        "id, created_at, status, subtotal, discount_code, discount_amount, total, currency, customer_name, customer_email, customer_phone, shipping_address, shipping_reference, shipping_district, shipping_notes"
      )
      .eq("id", id)
      .maybeSingle();

    if (saleErr) {
      return NextResponse.json({ error: saleErr.message }, { status: 500 });
    }
    if (!sale) {
      return NextResponse.json({ error: "Sale not found" }, { status: 404 });
    }

    // 2) Fetch items (use real columns from your DB)
    const { data: items, error: itemsErr } = await supabaseAdmin
      .from("order_items")
      .select(
        `
        id,
        title_snapshot,
        codigo_venta_snapshot,
        quantity,
        unit_price,
        line_total,
        producto:productos(internal_id, descripcion)
      `
      )
      .eq("order_id", id);

    if (itemsErr) {
      return NextResponse.json({ error: itemsErr.message }, { status: 500 });
    }

    const branding = await fetchCompanyBrandingForPdf();
    const money = (n: any) => `S/ ${Number(n ?? 0).toFixed(2)}`;

    const pdf = await renderPdf({
      title: "Venta",
      subtitle: `ID: ${sale.id}`,
      branding,
      meta: [
        { label: "Cliente", value: sale.customer_name ?? "—" },
        { label: "Email", value: sale.customer_email ?? "—" },
        { label: "Teléfono", value: sale.customer_phone ?? "—" },
        { label: "Estado", value: sale.status ?? "—" },
        {
          label: "Fecha",
          value: new Date(sale.created_at).toLocaleString("es-PE"),
        },
        { label: "Dirección", value: sale.shipping_address ?? "—" },
        { label: "Distrito", value: sale.shipping_district ?? "—" },
        { label: "Referencia", value: sale.shipping_reference ?? "—" },
      ],
      tables: [
        {
          title: "Items",
          columns: [
            { key: "code", header: "Código", width: 90 },
            { key: "name", header: "Descripción" },
            { key: "qty", header: "Cant.", width: 60, align: "right" },
            { key: "price", header: "P. unit", width: 80, align: "right" },
            { key: "total", header: "Total", width: 80, align: "right" },
          ],
          rows: (items ?? []).map((it: any) => ({
            code: it.producto?.codigo_venta ?? it.codigo_venta_snapshot ?? "—",
            name: it.producto?.descripcion ?? it.title_snapshot ?? "—",
            qty: Number(it.quantity ?? 0),
            price: money(it.unit_price),
            total:
              it.line_total != null
                ? money(it.line_total)
                : money(Number(it.unit_price ?? 0) * Number(it.quantity ?? 0)),
          })),
        },
      ],
    
    });

    return new Response(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="venta-${sale.id}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e: any) {
    console.error("[pdf ventas] error:", e);
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
