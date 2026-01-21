"use server";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { createSupabaseServerClient } from "@/lib/supabaseClient";

import type {
  AppRole,
  AppUser,
  CreateAppUserInput,
  CreateUserResult,
  PermissionMap,
  ResetPasswordResult,
  UpdateAppUserInput,
} from "@/modules/settings/users/types";

type AuthzResult =
  | { ok: true; userId: number; roleKey: string }
  | {
      ok: false;
      reason:
        | "NOT_AUTHENTICATED"
        | "NO_PROFILE"
        | "INACTIVE"
        | "ROLE_NOT_FOUND"
        | "NOT_AUTHORIZED";
    };

type RoleRow = {
  id: number;
  key: string;
  name: string;
  description: string | null;
  permissions: unknown;
  is_default: boolean;
  created_at: string;
};

type UserRow = {
  id: number;
  auth_user_id: string | null;
  username: string | null;
  full_name: string;
  email: string;
  role_id: number;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
};

function safePermissions(value: unknown): PermissionMap {
  if (!value || typeof value !== "object") return {};
  return value as PermissionMap;
}

function generatePassword(length = 10) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < length; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

const mapRoleRow = (row: RoleRow): AppRole =>
  ({
    id: row.id,
    key: row.key,
    name: row.name,
    description: row.description,
    permissions: safePermissions(row.permissions),
    isDefault: row.is_default,
  }) as AppRole;

const mapUserRow = (row: UserRow): AppUser =>
  ({
    id: row.id,
    username: row.username ?? "",
    fullName: row.full_name,
    email: row.email,
    roleId: row.role_id,
    isActive: row.is_active,
    lastLoginAt: row.last_login_at,
    createdAt: row.created_at,
  }) as AppUser;

// -------------------------------
// AuthZ (NO throw - safe for pages)
// -------------------------------
async function getManageUsersAuthz(): Promise<AuthzResult> {
  const supabase = await createSupabaseServerClient();
  const { data: authData, error: authErr } = await supabase.auth.getUser();

  if (authErr || !authData?.user) return { ok: false, reason: "NOT_AUTHENTICATED" };

  const { data: me, error: meErr } = await supabase
    .from("app_users")
    .select("id, role_id, is_active")
    .eq("auth_user_id", authData.user.id)
    .single();

  if (meErr || !me) return { ok: false, reason: "NO_PROFILE" };
  if (!me.is_active) return { ok: false, reason: "INACTIVE" };

  const { data: role, error: roleErr } = await supabase
    .from("app_roles")
    .select("id, key, permissions")
    .eq("id", me.role_id)
    .single();

  if (roleErr || !role) return { ok: false, reason: "ROLE_NOT_FOUND" };

  const perms = (role.permissions ?? {}) as Record<string, boolean>;
  const canManage =
    role.key === "superadmin" || perms.canManageUsers === true || perms.canManageRoles === true;

  if (!canManage) return { ok: false, reason: "NOT_AUTHORIZED" };

  return { ok: true, userId: me.id, roleKey: role.key };
}

// -------------------------------
// AuthZ (throw - for server actions)
// ✅ FIX TS: no depende del narrowing de `reason`
// -------------------------------
async function requireManageUsersOrThrow(): Promise<{ userId: number; roleKey: string }> {
  const res = await getManageUsersAuthz();

  if (!res.ok) {
    const reason = (res as { reason?: AuthzResult extends { ok: false; reason: infer R } ? R : string })
      .reason as AuthzResult extends { ok: false; reason: infer R } ? R : string | undefined;

    const msg =
      reason === "NOT_AUTHENTICATED"
        ? "Not authenticated."
        : reason === "NO_PROFILE"
          ? "No profile linked (app_users)."
          : reason === "INACTIVE"
            ? "User is inactive."
            : reason === "ROLE_NOT_FOUND"
              ? "Role not found."
              : "Not authorized.";

    throw new Error(msg);
  }

  return { userId: res.userId, roleKey: res.roleKey };
}

// -------------------------------
// Fetch roles/users (NO THROW)
// -------------------------------
export async function fetchRoles(): Promise<AppRole[]> {
  const authz = await getManageUsersAuthz();
  if (!authz.ok) return [];

  const { data, error } = await supabaseAdmin
    .from("app_roles")
    .select("id, key, name, description, permissions, is_default, created_at")
    .order("id", { ascending: true });

  if (error) {
    console.error("[fetchRoles]", error);
    return [];
  }

  return ((data ?? []) as unknown as RoleRow[]).map(mapRoleRow);
}

export async function fetchUsers(): Promise<AppUser[]> {
  const authz = await getManageUsersAuthz();
  if (!authz.ok) return [];

  const { data, error } = await supabaseAdmin
    .from("app_users")
    .select(
      "id, auth_user_id, username, full_name, email, role_id, is_active, last_login_at, created_at"
    )
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[fetchUsers]", error);
    return [];
  }

  return ((data ?? []) as unknown as UserRow[]).map(mapUserRow);
}

// -------------------------------
// Create user (Auth + app_users)
// -------------------------------
export async function createUser(input: CreateAppUserInput): Promise<CreateUserResult> {
  await requireManageUsersOrThrow();

  const email = input.email.trim().toLowerCase();
  const username = input.username.trim();
  const fullName = input.fullName.trim();

  const generatedPassword = generatePassword(10);

  const { data: authRes, error: authErr } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: generatedPassword,
    email_confirm: true,
    user_metadata: { fullName, username },
  });

  if (authErr) throw new Error(authErr.message);

  const authUserId = authRes.user?.id;
  if (!authUserId) throw new Error("Auth user not created.");

  const { data, error } = await supabaseAdmin
    .from("app_users")
    .insert({
      auth_user_id: authUserId,
      username,
      full_name: fullName,
      email,
      role_id: input.roleId,
      is_active: input.isActive,
    })
    .select(
      "id, auth_user_id, username, full_name, email, role_id, is_active, last_login_at, created_at"
    )
    .single();

  if (error) {
    await supabaseAdmin.auth.admin.deleteUser(authUserId);
    throw error;
  }

  return { user: mapUserRow(data as unknown as UserRow), generatedPassword };
}

// -------------------------------
// Reset password
// -------------------------------
export async function resetUserPassword(userId: number): Promise<ResetPasswordResult> {
  await requireManageUsersOrThrow();

  const { data: row, error: rowErr } = await supabaseAdmin
    .from("app_users")
    .select("id, auth_user_id")
    .eq("id", userId)
    .single();

  if (rowErr) throw rowErr;
  if (!row?.auth_user_id) throw new Error("User is not linked to Supabase Auth (auth_user_id missing).");

  const generatedPassword = generatePassword(10);

  const { error: updErr } = await supabaseAdmin.auth.admin.updateUserById(row.auth_user_id, {
    password: generatedPassword,
  });

  if (updErr) throw new Error(updErr.message);

  return { userId, generatedPassword };
}

// -------------------------------
// Update user
// -------------------------------
export async function updateUser(id: number, input: UpdateAppUserInput): Promise<AppUser | null> {
  await requireManageUsersOrThrow();

  const email = input.email.trim().toLowerCase();

  const { data, error } = await supabaseAdmin
    .from("app_users")
    .update({
      full_name: input.fullName.trim(),
      email,
      role_id: input.roleId,
      is_active: input.isActive,
    })
    .eq("id", id)
    .select(
      "id, auth_user_id, username, full_name, email, role_id, is_active, last_login_at, created_at"
    )
    .single();

  if (error) throw error;

  const authUserId = (data as any)?.auth_user_id as string | null;
  if (authUserId) {
    const { error: authErr } = await supabaseAdmin.auth.admin.updateUserById(authUserId, { email });
    if (authErr) console.warn("Auth email update failed:", authErr.message);
  }

  return mapUserRow(data as unknown as UserRow);
}

// -------------------------------
// Deactivate user
// -------------------------------
export async function deactivateUser(id: number): Promise<boolean> {
  await requireManageUsersOrThrow();

  const { error } = await supabaseAdmin.from("app_users").update({ is_active: false }).eq("id", id);
  if (error) throw error;

  return true;
}

// -------------------------------
// Update role permissions
// -------------------------------
export async function updateRolePermissions(roleId: number, permissions: PermissionMap) {
  await requireManageUsersOrThrow();

  const { data, error } = await supabaseAdmin
    .from("app_roles")
    .update({ permissions })
    .eq("id", roleId)
    .select("id, key, name, description, permissions, is_default, created_at")
    .single();

  if (error) throw error;

  return mapRoleRow(data as unknown as RoleRow);
}
