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

function parseEmailList(raw: string | undefined) {
  if (!raw) return [];
  return raw
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean)
    .filter((x) => isEmail(x));
}

// ✅ reCAPTCHA verify (server-side)
async function verifyRecaptcha(token: string, ip?: string | null) {
  const secret = String(process.env.RECAPTCHA_SECRET_KEY ?? "").trim();
  if (!secret) return { ok: false, error: "RECAPTCHA_SECRET_KEY is missing" };

  const t = String(token ?? "").trim();
  if (!t) return { ok: false, error: "Missing captcha token" };

  const form = new URLSearchParams();
  form.set("secret", secret);
  form.set("response", t);
  if (ip) form.set("remoteip", ip);

  const res = await fetch("https://www.google.com/recaptcha/api/siteverify", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: form.toString(),
    cache: "no-store",
  });

  const json: any = await res.json().catch(() => null);

  if (!res.ok) return { ok: false, error: "Captcha verify request failed" };
  if (!json?.success) return { ok: false, error: "Captcha failed" };

  return { ok: true as const };
}

export async function POST(req: Request) {
  try {
    const toList = parseEmailList(process.env.CONTACT_TO_EMAIL);
    const from = process.env.CONTACT_FROM_EMAIL?.trim();

    if (!toList.length || !from) {
      return NextResponse.json(
        { error: "Missing CONTACT_TO_EMAIL or CONTACT_FROM_EMAIL" },
        { status: 500 }
      );
    }

    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    // ✅ Captcha token required
    const captchaToken = safeString(body.captchaToken, 4096);

    const ip =
      req.headers.get("cf-connecting-ip") ||
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      null;

    // ✅ reCAPTCHA validate
    const captcha = await verifyRecaptcha(captchaToken, ip);
    if (!captcha.ok) {
      return NextResponse.json({ error: "SECURITY_CHECK_FAILED" }, { status: 400 });
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

    // 1) Email interno (a tu bandeja / equipo)
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
      to: toList,
      replyTo: email,
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
      replyTo: toList[0],
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