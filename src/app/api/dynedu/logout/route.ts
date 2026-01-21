import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseClient";

export const dynamic = "force-dynamic";

export async function POST() {
  const supabase = await createSupabaseServerClient();

  // Cierra sesión Supabase (borra cookies sb-*)
  await supabase.auth.signOut();

  return NextResponse.json({ ok: true });
}
