import { NextResponse } from "next/server";
import { Resend } from "resend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const resend = new Resend(process.env.RESEND_API_KEY!);

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function safeString(value: unknown, max = 5000) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, max);
}

export async function POST(req: Request) {
  try {
    const to = process.env.CONTACT_TO_EMAIL;
    const from = process.env.CONTACT_FROM_EMAIL;

    if (!to || !from) {
      return NextResponse.json(
        { error: "Missing CONTACT_TO_EMAIL or CONTACT_FROM_EMAIL" },
        { status: 500 }
      );
    }

    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const name = safeString(body.name, 120);
    const email = safeString(body.email, 180);
    const phone = safeString(body.phone, 60);
    const school = safeString(body.school, 180);
    const topic = safeString(body.topic, 120);
    const product = safeString(body.product, 180);
    const message = safeString(body.message, 6000);

    if (!name || !email || !message) {
      return NextResponse.json(
        { error: "Name, email and message are required" },
        { status: 400 }
      );
    }
    if (!isEmail(email)) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    }

    // 1) Email interno (a tu bandeja)
    const subjectAdmin = topic
      ? `DynEdu - New contact: ${topic}`
      : "DynEdu - New contact message";

    const adminText = [
      "New contact message",
      "------------------------------",
      `Name: ${name}`,
      `Email: ${email}`,
      phone ? `Phone: ${phone}` : null,
      school ? `School: ${school}` : null,
      topic ? `Topic: ${topic}` : null,
      product ? `Product: ${product}` : null,
      "",
      "Message:",
      message,
    ]
      .filter(Boolean)
      .join("\n");

    await resend.emails.send({
      from,
      to,
      replyTo: email, // para que respondas directo al cliente
      subject: subjectAdmin,
      text: adminText,
    });

    // 2) Confirmación al usuario
    const subjectUser = "DynEdu - Hemos recibido tu solicitud ✅";

    const userText = [
      `Hola ${name},`,
      "",
      "¡Gracias por escribirnos! Hemos recibido tu solicitud y te responderemos a la brevedad.",
      "",
      topic ? `Motivo: ${topic}` : null,
      product ? `Producto: ${product}` : null,
      school ? `Colegio/Institución: ${school}` : null,
      phone ? `Teléfono: ${phone}` : null,
      "",
      "Tu mensaje:",
      message,
      "",
      "— DynEdu / PRG Dinamics",
    ]
      .filter(Boolean)
      .join("\n");

    await resend.emails.send({
      from,
      to: email,
      replyTo: to, // si responde, te llega a ti
      subject: subjectUser,
      text: userText,
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Unexpected error" },
      { status: 500 }
    );
  }
}
