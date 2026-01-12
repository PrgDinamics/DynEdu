"use server";

import bcrypt from "bcryptjs";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { createDyneduSession, clearDyneduSession } from "@/lib/dynedu/auth";

export async function loginWithUsername(input: {
  username: string;
  password: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const username = input.username.trim();
  const password = input.password;

  if (!username) return { ok: false, error: "Ingresa tu username." };
  if (!password) return { ok: false, error: "Ingresa tu contraseña." };

  const { data: user, error } = await supabaseAdmin
    .from("app_users")
    .select("id, username, email, password_hash, is_active")
    .eq("username", username)
    .maybeSingle();

  if (error || !user) return { ok: false, error: "Credenciales inválidas." };
  if (!user.is_active) return { ok: false, error: "Usuario inactivo." };
  if (!user.password_hash) return { ok: false, error: "Usuario sin contraseña." };

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return { ok: false, error: "Credenciales inválidas." };

  await createDyneduSession(user.id);
  await supabaseAdmin
    .from("app_users")
    .update({ last_login_at: new Date().toISOString() })
    .eq("id", user.id);

  return { ok: true };
}

export async function logoutDynedu() {
  await clearDyneduSession();
}
