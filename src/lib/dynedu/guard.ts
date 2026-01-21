// src/lib/dynedu/guard.ts
import { createSupabaseServerClient } from "@/lib/supabaseClient";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type PermissionMap = Record<string, boolean>;

type OverrideRow = {
  permission_key: string;
  mode: "grant" | "deny";
};

export type DyneduMe = {
  authUserId: string;
  userId: number;
  roleId: number;
  roleKey: string;
  isActive: boolean;
  permissions: PermissionMap;
};

export async function getDyneduMeWithPermissions(): Promise<DyneduMe | null> {
  const supabase = await createSupabaseServerClient();
  const { data: authData, error: authErr } = await supabase.auth.getUser();

  if (authErr || !authData?.user) return null;

  // 1) app_users by auth_user_id
  const { data: user, error: userError } = await supabaseAdmin
    .from("app_users")
    .select("id, role_id, is_active")
    .eq("auth_user_id", authData.user.id)
    .maybeSingle();

  if (userError || !user || !user.is_active) return null;

  // 2) base role permissions + role key
  const { data: role, error: roleError } = await supabaseAdmin
    .from("app_roles")
    .select("id, key, permissions")
    .eq("id", user.role_id)
    .maybeSingle();

  if (roleError || !role) return null;

  const base: PermissionMap = (role as any).permissions ?? {};

  // 3) user overrides (optional)
  const { data: overrides, error: ovError } = await supabaseAdmin
    .from("app_user_permission_overrides")
    .select("permission_key, mode")
    .eq("user_id", user.id);

  const finalPerms: PermissionMap = { ...base };

  if (!ovError) {
    for (const ov of (overrides ?? []) as OverrideRow[]) {
      finalPerms[ov.permission_key] = ov.mode === "grant";
    }
  }

  return {
    authUserId: authData.user.id,
    userId: user.id,
    roleId: user.role_id,
    roleKey: (role as any).key,
    isActive: user.is_active,
    permissions: finalPerms,
  };
}

export function hasAnyPermission(me: DyneduMe, keys: string[]) {
  if (me.roleKey === "superadmin") return true;
  return keys.some((k) => me.permissions?.[k] === true);
}
