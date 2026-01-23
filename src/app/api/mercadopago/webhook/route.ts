import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { mapMpPaymentStatus, mapPaymentToOrderStatus } from "@/lib/mercado/status";
import { Resend } from "resend";

import fs from "node:fs";
import path from "node:path";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function fetchMpPayment(paymentId: string) {
  const token = process.env.MP_ACCESS_TOKEN;
  if (!token) throw new Error("Missing MP_ACCESS_TOKEN");

  const res = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`MP fetch failed: ${res.status} ${txt}`);
  }

  return res.json();
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

function uniq(arr: string[]) {
  return Array.from(new Set(arr.map((x) => x.trim().toLowerCase()))).filter(Boolean);
}

function shortId(id: string) {
  return String(id ?? "").replaceAll("-", "").slice(0, 8).toUpperCase();
}

function money(n: any) {
  const x = Number(n ?? 0);
  if (!Number.isFinite(x)) return "0.00";
  return x.toFixed(2);
}

function orderStatusEsFromEn(en: string) {
  switch (en) {
    case "PAID":
      return "PAGADO";
    case "PREPARING":
      return "PREPARANDO";
    case "SHIPPED":
      return "ENVIADO";
    case "DELIVERED":
      return "ENTREGADO";
    case "CANCELLED":
      return "CANCELADO";
    case "FAILED":
      return "FALLIDO";
    case "REFUND":
      return "REEMBOLSO";
    case "PAYMENT_PENDING":
    default:
      return "PENDIENTE_PAGO";
  }
}

async function updateOrderStatusWithFallback(orderId: string, statusEn: string) {
  const now = new Date().toISOString();

  const { error: errEn } = await supabaseAdmin
    .from("orders")
    .update({ status: statusEn, updated_at: now })
    .eq("id", orderId);

  if (!errEn) return;

  const statusEs = orderStatusEsFromEn(statusEn);
  const { error: errEs } = await supabaseAdmin
    .from("orders")
    .update({ status: statusEs, updated_at: now })
    .eq("id", orderId);

  if (errEs) throw errEs;
}

function shouldReleaseReservation(paymentStatus: string) {
  return paymentStatus === "REJECTED" || paymentStatus === "CANCELLED" || paymentStatus === "REFUNDED";
}

// ✅ PDF BONITO (A4) tipo comprobante interno con logo + tabla + total
async function generateNiceReceiptPdf(args: {
  orderCode: string;
  createdAtIso?: string | null;
  buyerName?: string | null;
  buyerEmail?: string | null;
  currency?: string | null;
  total?: number | null;
  items: Array<{ title: string; qty: number; unit: number; line: number }>;
  mpPaymentId: string;
  mpStatus?: string | null;
}) {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]); // A4
  const { width, height } = page.getSize();

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const margin = 44;

  const currency = args.currency ?? "PEN";
  const dateStr = args.createdAtIso
    ? new Date(args.createdAtIso).toLocaleString("es-PE", { timeZone: "America/Lima" })
    : new Date().toLocaleString("es-PE", { timeZone: "America/Lima" });

  // Helpers
  const drawText = (
    text: string,
    x: number,
    y: number,
    size = 10,
    bold = false,
    color = rgb(0.08, 0.08, 0.1)
  ) => {
    page.drawText(text, {
      x,
      y,
      size,
      font: bold ? fontBold : font,
      color,
    });
  };

  const drawLine = (
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    thickness = 1,
    color = rgb(0.86, 0.86, 0.9)
  ) => {
    page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness, color });
  };

  // Header band
  page.drawRectangle({
    x: 0,
    y: height - 120,
    width,
    height: 120,
    color: rgb(0.97, 0.97, 0.99),
  });

  // Logo (desde public/images/de-logo-color.png)
  const logoPath = path.join(process.cwd(), "public", "images", "logos", "de-logo-color.png");
  try {
    const logoBytes = fs.readFileSync(logoPath);
    const logo = await pdfDoc.embedPng(logoBytes);
    const scaled = logo.scale(0.28);
    page.drawImage(logo, {
      x: margin,
      y: height - 98,
      width: scaled.width,
      height: scaled.height,
    });
  } catch {
    drawText("DYNEDU / PRG DINAMICS", margin, height - 62, 12, true);
  }

  // Title (right)
  drawText("COMPROBANTE DE PAGO", width - margin - 230, height - 52, 14, true);
  drawText(`Orden: ${args.orderCode}`, width - margin - 230, height - 74, 10, false, rgb(0.25, 0.25, 0.35));
  drawText(`${dateStr}`, width - margin - 230, height - 90, 9, false, rgb(0.45, 0.45, 0.55));

  drawLine(margin, height - 130, width - margin, height - 130, 1.2);

  // Customer box
  const boxY = height - 200;
  page.drawRectangle({
    x: margin,
    y: boxY,
    width: width - margin * 2,
    height: 56,
    borderColor: rgb(0.86, 0.86, 0.9),
    borderWidth: 1,
    color: rgb(1, 1, 1),
  });

  drawText("Cliente", margin + 12, boxY + 38, 9, true, rgb(0.35, 0.35, 0.45));
  drawText(args.buyerName ? args.buyerName : "—", margin + 12, boxY + 18, 10, false);
  drawText(
    args.buyerEmail ? args.buyerEmail : "—",
    margin + 270,
    boxY + 18,
    10,
    false,
    rgb(0.25, 0.25, 0.35)
  );

  // Payment info
  const payY = boxY - 42;
  drawText("Detalle de pago", margin, payY + 18, 10, true);
  drawText(`Operación MP: ${args.mpPaymentId}`, margin, payY, 10, false, rgb(0.25, 0.25, 0.35));
  drawText(`Estado MP: ${args.mpStatus ?? "approved"}`, margin + 270, payY, 10, false, rgb(0.25, 0.25, 0.35));

  // Table header
  let y = payY - 34;

  page.drawRectangle({
    x: margin,
    y,
    width: width - margin * 2,
    height: 24,
    color: rgb(0.95, 0.95, 0.98),
    borderColor: rgb(0.86, 0.86, 0.9),
    borderWidth: 1,
  });

  drawText("Descripción", margin + 10, y + 8, 10, true);
  drawText("Cant.", width - margin - 175, y + 8, 10, true);
  drawText("P. Unit.", width - margin - 120, y + 8, 10, true);
  drawText("Importe", width - margin - 55, y + 8, 10, true);

  y -= 24;

  // Rows
  const maxRows = 18;
  const rows = args.items.slice(0, maxRows);

  for (const it of rows) {
    page.drawRectangle({
      x: margin,
      y,
      width: width - margin * 2,
      height: 24,
      color: rgb(1, 1, 1),
      borderColor: rgb(0.90, 0.90, 0.94),
      borderWidth: 1,
    });

    const title = String(it.title ?? "Item");
    const trimmed = title.length > 56 ? title.slice(0, 53) + "…" : title;

    drawText(trimmed, margin + 10, y + 8, 10, false);
    drawText(String(it.qty ?? 0), width - margin - 170, y + 8, 10, false, rgb(0.25, 0.25, 0.35));
    drawText(money(it.unit), width - margin - 120, y + 8, 10, false, rgb(0.25, 0.25, 0.35));
    drawText(money(it.line), width - margin - 55, y + 8, 10, false, rgb(0.25, 0.25, 0.35));

    y -= 24;
  }

  // Total box
  y -= 18;
  const totalBoxW = 260;
  const totalBoxH = 70;

  page.drawRectangle({
    x: width - margin - totalBoxW,
    y,
    width: totalBoxW,
    height: totalBoxH,
    color: rgb(0.97, 0.97, 0.99),
    borderColor: rgb(0.86, 0.86, 0.9),
    borderWidth: 1,
  });

  drawText("TOTAL", width - margin - totalBoxW + 12, y + 46, 10, true, rgb(0.35, 0.35, 0.45));
  drawText(`${money(args.total)} ${currency}`, width - margin - totalBoxW + 12, y + 18, 18, true);

  // Footer
  drawLine(margin, 92, width - margin, 92, 1);
  drawText("Este documento es un comprobante interno de pago.", margin, 72, 9, false, rgb(0.45, 0.45, 0.55));
  drawText(`Código de orden: ${args.orderCode}`, margin, 54, 9, true, rgb(0.35, 0.35, 0.45));
  drawText("DynEdu / PRG Dinamics", width - margin - 150, 54, 9, false, rgb(0.45, 0.45, 0.55));

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}

async function sendPaidEmailWithPdf(args: {
  buyerEmail: string;
  adminEmails: string[];
  customerName?: string | null;
  orderId: string;
  orderCreatedAtIso?: string | null;
  currency?: string | null;
  total?: number | null;
  items: Array<{ title: string; qty: number; unit: number; line: number }>;
  mpPaymentId: string;
  mpStatus?: string | null;
}) {
  const resendKey = String(process.env.RESEND_API_KEY ?? "").trim();
  const from =
    String(process.env.ORDER_STATUS_FROM_EMAIL ?? "").trim() ||
    String(process.env.CONTACT_FROM_EMAIL ?? "").trim();

  if (!resendKey || !from) return;

  const buyerEmail = String(args.buyerEmail ?? "").trim();
  if (!isEmail(buyerEmail)) return;

  const resend = new Resend(resendKey);

  const orderCode = shortId(args.orderId);

  const siteUrl = String(process.env.NEXT_PUBLIC_SITE_URL ?? "").trim().replace(/\/$/, "");
  const logoUrl = siteUrl ? `${siteUrl}/images/logos/de-logo-color.png` : "";

  const greet = args.customerName ? `Hola ${args.customerName},` : "Hola,";

  const subjectBuyer = `DynEdu - Compra confirmada (${orderCode}) ✅`;
  const subjectAdmin = `DynEdu ADMIN - Nueva compra (${orderCode}) ✅`;

  const textLines: string[] = [
    greet,
    "",
    `¡Tu compra fue confirmada ✅ (Pedido ${orderCode})`,
    `Pago: ${args.mpStatus ?? "approved"} | MP Payment ID: ${args.mpPaymentId}`,
    "",
    "Resumen:",
    ...args.items.map((it) => `- ${it.title}  x${it.qty}  (${money(it.unit)} c/u)  = ${money(it.line)}`),
    "",
    `Total: ${money(args.total)} ${args.currency ?? "PEN"}`,
    siteUrl ? `Ver mis compras: ${siteUrl}/mis-compras` : "",
    "",
    "— DynEdu / PRG Dinamics",
  ].filter(Boolean);

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.5; color:#111">
      ${logoUrl ? `<img src="${logoUrl}" alt="DynEdu" style="height:52px; margin-bottom:12px" />` : ""}
      <h2 style="margin:0 0 8px 0">Compra confirmada ✅</h2>
      <p style="margin:0 0 8px 0">${greet}</p>
      <p style="margin:0 0 6px 0">Orden: <b>${orderCode}</b></p>
      <p style="margin:0 0 12px 0">Operación MP: <b>${args.mpPaymentId}</b> (${args.mpStatus ?? "approved"})</p>

      <div style="margin:14px 0 10px 0">
        <b>Resumen:</b>
        <ul style="margin:8px 0 0 18px; padding:0">
          ${args.items
            .map((it) => `<li>${it.title} x${it.qty} — ${money(it.line)} ${args.currency ?? "PEN"}</li>`)
            .join("")}
        </ul>
      </div>

      <p style="margin:12px 0 12px 0">
        Total: <b>${money(args.total)} ${args.currency ?? "PEN"}</b>
      </p>

      ${siteUrl ? `<p style="margin:0 0 14px 0"><a href="${siteUrl}/mis-compras">Ver mis compras</a></p>` : ""}

      <p style="margin:0; color:#666">Adjuntamos tu comprobante de pago en PDF.</p>
      <p style="margin:10px 0 0 0; color:#666">— DynEdu / PRG Dinamics</p>
    </div>
  `;

  const pdf = await generateNiceReceiptPdf({
    orderCode,
    createdAtIso: args.orderCreatedAtIso ?? new Date().toISOString(),
    buyerName: args.customerName ?? null,
    buyerEmail,
    currency: args.currency ?? "PEN",
    total: args.total ?? 0,
    items: args.items,
    mpPaymentId: args.mpPaymentId,
    mpStatus: args.mpStatus ?? null,
  });

  const attachments = [
    {
      filename: `comprobante-${orderCode}.pdf`,
      content: pdf,
    } as any,
  ];

  // Buyer
  try {
    await resend.emails.send({
      from,
      to: buyerEmail,
      subject: subjectBuyer,
      text: textLines.join("\n"),
      html,
      attachments,
    });
  } catch (e: any) {
    console.error("[webhook] buyer email with pdf failed:", e?.message || e);
    await resend.emails.send({
      from,
      to: buyerEmail,
      subject: subjectBuyer,
      text: textLines.join("\n"),
      html,
    });
  }

  // Admin(s)
  const adminList = uniq(args.adminEmails);
  if (adminList.length) {
    try {
      await resend.emails.send({
        from,
        to: adminList,
        subject: subjectAdmin,
        text: textLines.join("\n"),
        html,
        attachments,
      });
    } catch (e: any) {
      console.error("[webhook] admin email with pdf failed:", e?.message || e);
      await resend.emails.send({
        from,
        to: adminList,
        subject: subjectAdmin,
        text: textLines.join("\n"),
        html,
      });
    }
  }
}

export async function POST(req: Request) {
  try {
    // 1) Validate webhook secret (if set)
    const url = new URL(req.url);
    const secret = url.searchParams.get("secret") || "";
    const expected = process.env.MP_WEBHOOK_SECRET || "";

    if (expected && secret !== expected) {
      return NextResponse.json({ error: "INVALID_WEBHOOK_SECRET" }, { status: 401 });
    }

    // 2) Parse webhook body
    const body = await req.json().catch(() => ({} as any));
    const paymentId: string | undefined = body?.data?.id || body?.id;

    if (!paymentId) return NextResponse.json({ ok: true });

    // 3) Fetch canonical payment from Mercado Pago
    const mpPayment = await fetchMpPayment(String(paymentId));

    const mpStatus = mpPayment?.status as string | undefined;
    const dbPaymentStatus = mapMpPaymentStatus(mpStatus);

    const orderId = String(mpPayment?.external_reference || "");
    const merchantOrderId = mpPayment?.order?.id ? String(mpPayment.order.id) : null;

    if (!orderId) return NextResponse.json({ ok: true });

    // 3.1) Read previous payment status (idempotency / transition detection)
    const { data: existingPayment, error: readPayErr } = await supabaseAdmin
      .from("payments")
      .select("status")
      .eq("order_id", orderId)
      .eq("provider", "mercadopago")
      .maybeSingle();

    if (readPayErr) throw readPayErr;

    const prevStatus = String(existingPayment?.status || "");
    const becameApproved = dbPaymentStatus === "APPROVED" && prevStatus !== "APPROVED";

    // 4) Update payments row
    const { error: payErr } = await supabaseAdmin
      .from("payments")
      .update({
        status: dbPaymentStatus,
        payment_id: String(paymentId),
        merchant_order_id: merchantOrderId,
        raw: mpPayment,
        updated_at: new Date().toISOString(),
      })
      .eq("order_id", orderId)
      .eq("provider", "mercadopago");

    if (payErr) throw payErr;

    // 5) Update order status (with EN->ES fallback)
    const orderStatusEn = mapPaymentToOrderStatus(dbPaymentStatus);
    await updateOrderStatusWithFallback(orderId, orderStatusEn);

    // 6) Inventory + movimientos + email
    if (becameApproved) {
      const { error: commitErr } = await supabaseAdmin.rpc("commit_stock_for_order", {
        p_order_id: orderId,
      });
      if (commitErr) throw commitErr;

      // Best-effort movimientos
      try {
        const { data: itemsMov } = await supabaseAdmin
          .from("order_items")
          .select("producto_id, quantity")
          .eq("order_id", orderId);

        if (itemsMov?.length) {
          await supabaseAdmin.from("movimientos").insert(
            itemsMov.map((it: any) => ({
              producto_id: it.producto_id,
              tipo: "VENTA_WEB",
              cantidad: it.quantity,
              ref_id: orderId,
              meta: { provider: "mercadopago", payment_id: String(paymentId) },
            }))
          );
        }
      } catch {
        // ignore
      }

      // ✅ Email buyer + admin with new PDF (best-effort)
      try {
        const { data: order } = await supabaseAdmin
          .from("orders")
          .select("customer_email, customer_name, total, currency, created_at")
          .eq("id", orderId)
          .maybeSingle();

        const customerEmail = String(order?.customer_email ?? "").trim();
        if (isEmail(customerEmail)) {
          const { data: orderItems } = await supabaseAdmin
            .from("order_items")
            .select("title_snapshot, quantity, unit_price, line_total")
            .eq("order_id", orderId)
            .order("id", { ascending: true });

          const adminEmails = parseEmailList(process.env.CONTACT_TO_EMAIL);

          await sendPaidEmailWithPdf({
            buyerEmail: customerEmail,
            adminEmails,
            customerName: order?.customer_name ?? null,
            orderId,
            orderCreatedAtIso: order?.created_at ?? null,
            currency: order?.currency ?? "PEN",
            total: order?.total ?? 0,
            items: (orderItems ?? []).map((it: any) => ({
              title: String(it.title_snapshot ?? "Item"),
              qty: Number(it.quantity ?? 0),
              unit: Number(it.unit_price ?? 0),
              line: Number(it.line_total ?? 0),
            })),
            mpPaymentId: String(paymentId),
            mpStatus: mpStatus ?? null,
          });
        }
      } catch (e: any) {
        console.error("[webhook] paid email best-effort failed:", e?.message || e);
      }
    } else if (shouldReleaseReservation(dbPaymentStatus)) {
      const { error: relErr } = await supabaseAdmin.rpc("release_stock_for_order", {
        p_order_id: orderId,
        p_reason: `mp:${dbPaymentStatus}`,
      });
      if (relErr) throw relErr;
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Unexpected error" }, { status: 500 });
  }
}
