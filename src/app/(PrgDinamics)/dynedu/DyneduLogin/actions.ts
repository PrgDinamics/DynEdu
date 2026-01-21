"use server";

import { createSupabaseServerClient } from "@/lib/supabaseClient";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function loginWithUsername(input: {
  username: string; // puede ser username o email
  password: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const identifier = input.username.trim();
  const password = input.password;

  if (!identifier) return { ok: false, error: "Ingresa tu usuario o email." };
  if (!password) return { ok: false, error: "Ingresa tu contraseña." };

  // 1) Resolver a email si no tiene "@"
  let email = identifier.toLowerCase();

  if (!identifier.includes("@")) {
    // Busca email por username en app_users (SERVER ONLY, sin filtrar info al cliente)
    const { data: row, error: uErr } = await supabaseAdmin
      .from("app_users")
      .select("email, is_active")
      .eq("username", identifier)
      .single();

    if (uErr || !row?.email) {
      return { ok: false, error: "Credenciales inválidas." };
    }
    if (row.is_active === false) {
      return { ok: false, error: "Usuario inactivo." };
    }

    email = String(row.email).toLowerCase();
  }

  // 2) Login real con Supabase Auth
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { ok: false, error: "Credenciales inválidas." };
  }

  return { ok: true };
}

