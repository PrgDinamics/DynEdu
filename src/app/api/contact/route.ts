import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

export const runtime = "nodejs"; // importante en Vercel para librerías server
export const dynamic = "force-dynamic"; // evita cache raro en route handlers

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

const resend = new Resend(process.env.RESEND_API_KEY!);

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);

    if (!body) {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const {
      name = "",
      email = "",
      phone = "",
      school = "",
      topic = "",
      product = "",
      message = "",
      source = "public_site",
      // anti-spam (si algún día lo agregas en frontend)
      website = "",
    } = body;

    // Honeypot (si viene lleno, bot)
    if (website && String(website).trim().length > 0) {
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    if (!String(name).trim()) {
      return NextResponse.json({ error: "Name required" }, { status: 400 });
    }
    if (!isEmail(String(email))) {
      return NextResponse.json({ error: "Valid email required" }, { status: 400 });
    }
    if (!String(message).trim()) {
      return NextResponse.json({ error: "Message required" }, { status: 400 });
    }

    const userAgent = req.headers.get("user-agent") || "";
    // IP: Vercel suele mandar x-forwarded-for
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "";

    // 1) Guardar en Supabase
    const { data: row, error: dbErr } = await supabase
      .from("contact_messages")
      .insert({
        name,
        email,
        phone,
        school,
        topic,
        product,
        message,
        source,
        user_agent: userAgent,
        ip,
      })
      .select("id, created_at")
      .single();

    if (dbErr) {
      return NextResponse.json({ error: dbErr.message }, { status: 500 });
    }

    // 2) Enviar correo con Resend
    const to = process.env.CONTACT_TO_EMAIL!;
    const from = process.env.CONTACT_FROM_EMAIL || "onboarding@resend.dev";

    const subject = `[PRG Dinamics] Nuevo contacto: ${name}${topic ? ` (${topic})` : ""}`;

    const text = [
      `Nuevo mensaje de contacto`,
      `--------------------------------`,
      `Nombre: ${name}`,
      `Email: ${email}`,
      phone ? `Teléfono: ${phone}` : "",
      school ? `Colegio/Institución: ${school}` : "",
      topic ? `Motivo: ${topic}` : "",
      product ? `Producto: ${product}` : "",
      `--------------------------------`,
      `Mensaje:`,
      `${message}`,
      `--------------------------------`,
      `Meta:`,
      `ID: ${row.id}`,
      `Fecha: ${row.created_at}`,
      ip ? `IP: ${ip}` : "",
      userAgent ? `User-Agent: ${userAgent}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    await resend.emails.send({
      from,
      to,
      replyTo: email,
      subject,
      text,
    });

    return NextResponse.json({ ok: true, id: row.id }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Unexpected error" },
      { status: 500 }
    );
  }
}
