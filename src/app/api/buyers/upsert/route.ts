import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type Body = {
  first_name: string;
  last_name: string;
  document_type: string;
  document_number: string;
  phone: string;
  address_line1: string;
  address_line2?: string | null;
  district: string;
  city?: string | null;
  reference?: string | null;
  student_full_name?: string | null;
  school_name?: string | null;
};

export async function POST(req: Request) {
  try {
    const auth = req.headers.get("authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
    if (!token) {
      return NextResponse.json({ error: "Missing bearer token" }, { status: 401 });
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    if (!url || !anon) {
      return NextResponse.json({ error: "Missing Supabase env vars" }, { status: 500 });
    }

    const supabase = createClient(url, anon, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: userRes, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userRes?.user) {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }

    const body = (await req.json()) as Body;

    const payload = {
      id: userRes.user.id, // buyers.id es uuid en tu DB
      ...body,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from("buyers")
      .upsert(payload, { onConflict: "id" });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Unexpected error" }, { status: 500 });
  }
}
