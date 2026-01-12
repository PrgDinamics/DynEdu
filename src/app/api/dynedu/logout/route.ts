import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const COOKIE_NAMES = ["dynedu_session", "dynedu_user_email", "dynedu_user_id"];

export async function POST() {
  const store = await cookies();

  // revoke DB session (optional)
  const sessionToken = store.get("dynedu_session")?.value ?? null;

  if (sessionToken) {
    try {
      const tokenHash = crypto.createHash("sha256").update(sessionToken).digest("hex");
      await supabaseAdmin
        .from("app_sessions")
        .update({ revoked_at: new Date().toISOString() })
        .eq("token_hash", tokenHash);
    } catch {
      // ignore if table doesn't exist or any error
    }
  }

  // Clear cookies
  for (const name of COOKIE_NAMES) {
    store.delete(name);
  }

  return NextResponse.json({ ok: true });
}
