import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { mapMpPaymentStatus, mapPaymentToOrderStatus } from "@/lib/mercado/status";
import { Resend } from "resend";

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
  if (Number.isNaN(x)) return "0.00";
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

/**
 * PDF súper simple (sin dependencias extra).
 * Es un "comprobante interno" (no boleta/factura SUNAT).
 */
function generateReceiptPdf(lines: string[]) {
  const esc = (s: string) =>
    String(s ?? "")
      .replaceAll("\\", "\\\\")
      .replaceAll("(", "\\(")
      .replaceAll(")", "\\)");

  const contentLines = lines.map((l) => `(${esc(l)}) Tj T*`).join("\n");
  const stream = ["BT", "/F1 12 Tf", "72 740 Td", "14 TL", contentLines, "ET"].join("\n");

  const objects: Buffer[] = [];
  const pushObj = (objNum: number, body: string) => {
    const s = `${objNum} 0 obj\n${body}\nendobj\n`;
    objects.push(Buffer.from(s, "utf8"));
  };

  pushObj(1, "<< /Type /Catalog /Pages 2 0 R >>");
  pushObj(2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  pushObj(
    3,
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>"
  );
  pushObj(4, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  pushObj(5, `<< /Length ${Buffer.byteLength(stream, "utf8")} >>\nstream\n${stream}\nendstream`);

  const header = Buffer.from("%PDF-1.4\n", "utf8");

  const parts = [header, ...objects];
  let offset = 0;
  const offsets: number[] = [];
  for (const part of parts) {
    offsets.push(offset);
    offset += part.length;
  }

  const xrefStart = offset;

  const xrefLines: string[] = [];
  xrefLines.push("xref");
  xrefLines.push("0 6");
  xrefLines.push("0000000000 65535 f ");
  for (let i = 1; i <= 5; i++) {
    const off = offsets[i] ?? 0;
    xrefLines.push(String(off).padStart(10, "0") + " 00000 n ");
  }

  const trailer = [
    ...xrefLines,
    "trailer",
    "<< /Size 6 /Root 1 0 R >>",
    "startxref",
    String(xrefStart),
    "%%EOF\n",
  ].join("\n");

  return Buffer.concat([...parts, Buffer.from(trailer, "utf8")]);
}

async function sendPaidEmailWithPdf(args: {
  buyerEmail: string;
  adminEmails: string[];
  customerName?: string | null;
  orderId: string;
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

  // ✅ Changed: use NEXT_PUBLIC_SITE_URL
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
    ...args.items.map(
      (it) => `- ${it.title}  x${it.qty}  (${money(it.unit)} c/u)  = ${money(it.line)}`
    ),
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
      <p style="margin:0 0 6px 0">Pedido: <b>${orderCode}</b></p>
      <p style="margin:0 0 12px 0">Pago MP: <b>${args.mpPaymentId}</b> (${args.mpStatus ?? "approved"})</p>

      <div style="margin:14px 0 10px 0">
        <b>Resumen:</b>
        <ul style="margin:8px 0 0 18px; padding:0">
          ${args.items
            .map(
              (it) =>
                `<li>${it.title} x${it.qty} — ${money(it.line)} ${args.currency ?? "PEN"}</li>`
            )
            .join("")}
        </ul>
      </div>

      <p style="margin:12px 0 12px 0">
        Total: <b>${money(args.total)} ${args.currency ?? "PEN"}</b>
      </p>

      ${
        siteUrl
          ? `<p style="margin:0 0 14px 0"><a href="${siteUrl}/mis-compras">Ver mis compras</a></p>`
          : ""
      }

      <p style="margin:0; color:#666">Adjuntamos tu comprobante en PDF.</p>
      <p style="margin:10px 0 0 0; color:#666">— DynEdu / PRG Dinamics</p>
    </div>
  `;

  const pdf = generateReceiptPdf([
    "DYNEDU / PRG DINAMICS",
    "COMPROBANTE DE COMPRA",
    "------------------------------",
    `Pedido: ${orderCode}`,
    `Pago MP: ${args.mpPaymentId}`,
    `Estado MP: ${args.mpStatus ?? "approved"}`,
    "------------------------------",
    "ITEMS:",
    ...args.items.map((it) => `- ${it.title} x${it.qty} | ${money(it.line)} ${args.currency ?? "PEN"}`),
    "------------------------------",
    `TOTAL: ${money(args.total)} ${args.currency ?? "PEN"}`,
    "",
    "Gracias por tu compra.",
  ]);

  const attachments = [
    {
      filename: `comprobante-${orderCode}.pdf`,
      content: pdf,
    } as any,
  ];

  // Buyer email (best-effort attachment)
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

  // Admin email(s) (CONTACT_TO_EMAIL)
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

    // 3.1) Read previous payment status (transition detection)
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

    // 6) Inventory: commit/release
    if (becameApproved) {
      const { error: commitErr } = await supabaseAdmin.rpc("commit_stock_for_order", {
        p_order_id: orderId,
      });
      if (commitErr) throw commitErr;

      // Optional movimientos (best-effort)
      try {
        const { data: items } = await supabaseAdmin
          .from("order_items")
          .select("producto_id, quantity")
          .eq("order_id", orderId);

        if (items?.length) {
          await supabaseAdmin.from("movimientos").insert(
            items.map((it: any) => ({
              producto_id: it.producto_id,
              tipo: "VENTA_WEB",
              cantidad: it.quantity,
              ref_id: orderId,
              meta: { provider: "mercadopago", payment_id: String(paymentId) },
            }))
          );
        }
      } catch {
        // ignore schema differences
      }

      // ✅ Email buyer + admin (CONTACT_TO_EMAIL) with PDF (best-effort)
      try {
        const { data: order } = await supabaseAdmin
          .from("orders")
          .select("customer_email, customer_name, total, currency")
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
