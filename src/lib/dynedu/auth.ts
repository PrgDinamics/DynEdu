import crypto from "crypto";
import { cookies } from "next/headers";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { PermissionMap } from "@/modules/settings/users/types";

const SESSION_COOKIE = "dynedu_session";
const SESSION_TTL_HOURS = 24 * 7; // 7 días

export type DyneduSessionUser = {
  id: number;
  email: string;
  fullName: string;
  username: string;
  roleId: number;
  isActive: boolean;
  permissions: PermissionMap;
};

type AppSessionRow = {
  user_id: number;
  expires_at: string;
  revoked_at: string | null;
};

type AppUserRow = {
  id: number;
  email: string;
  full_name: string | null;
  username: string | null;
  role_id: number;
  is_active: boolean;
};

type AppRoleRow = {
  permissions: unknown;
};

type OverrideRow = {
  permission_key: string;
  mode: "grant" | "deny";
};

function sha256Hex(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function safePerms(value: unknown): PermissionMap {
  if (value && typeof value === "object") return value as PermissionMap;
  return {};
}

/**
 * Crea una sesión DynEdu:
 * - token random
 * - guarda hash en app_sessions
 * - cookie httpOnly dynedu_session
 */
export async function createDyneduSession(userId: number) {
  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = sha256Hex(token);

  const expiresAt = new Date(Date.now() + SESSION_TTL_HOURS * 60 * 60 * 1000).toISOString();

  const { error } = await supabaseAdmin.from("app_sessions").insert({
    user_id: userId,
    token_hash: tokenHash,
    expires_at: expiresAt,
  });

  if (error) throw error;

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(expiresAt),
  });
}

/**
 * Borra sesión:
 * - revoca en app_sessions (si existe token)
 * - borra cookie dynedu_session
 */
export async function clearDyneduSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (token) {
    const tokenHash = sha256Hex(token);

    try {
      await supabaseAdmin
        .from("app_sessions")
        .update({ revoked_at: new Date().toISOString() })
        .eq("token_hash", tokenHash);
    } catch {
      // ignore
    }
  }

  cookieStore.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(0),
  });
}

/**
 * Devuelve user_id si sesión válida.
 */
export async function getDyneduSessionUserId(): Promise<number | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const tokenHash = sha256Hex(token);

  const { data, error } = await supabaseAdmin
    .from("app_sessions")
    .select("user_id, expires_at, revoked_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (error || !data) return null;

  const row = data as unknown as AppSessionRow;

  if (row.revoked_at) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) return null;

  return row.user_id ?? null;
}

/**
 * Devuelve usuario + permisos (rol + overrides si existen).
 */
export async function getDyneduSessionUser(): Promise<DyneduSessionUser | null> {
  const userId = await getDyneduSessionUserId();
  if (!userId) return null;

  // 1) user
  const { data: user, error: userError } = await supabaseAdmin
    .from("app_users")
    .select("id, email, full_name, username, role_id, is_active")
    .eq("id", userId)
    .maybeSingle();

  if (userError || !user) return null;

  const u = user as unknown as AppUserRow;
  if (!u.is_active) return null;

  // 2) role permissions
  let permissions: PermissionMap = {};
  const { data: role, error: roleError } = await supabaseAdmin
    .from("app_roles")
    .select("permissions")
    .eq("id", u.role_id)
    .maybeSingle();

  if (!roleError && role) {
    const r = role as unknown as AppRoleRow;
    permissions = safePerms(r.permissions);
  }

  // 3) overrides (opcional)
  try {
    const { data: ov, error: ovErr } = await supabaseAdmin
      .from("app_user_permission_overrides")
      .select("permission_key, mode")
      .eq("user_id", u.id);

    if (!ovErr && Array.isArray(ov)) {
      const overrides = ov as unknown as OverrideRow[];
      for (const o of overrides) {
        if (!o?.permission_key) continue;
        permissions[o.permission_key] = o.mode === "grant";
      }
    }
  } catch {
    // ignore if table doesn't exist
  }

  return {
    id: u.id,
    email: u.email,
    fullName: u.full_name ?? "",
    username: u.username ?? "",
    roleId: u.role_id,
    isActive: u.is_active,
    permissions,
  };
}
