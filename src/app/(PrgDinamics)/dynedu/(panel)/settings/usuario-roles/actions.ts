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

// ✅ Password generator (Pr08*T style)
function generatePassword(_length = 6) {
  // Format: Uppercase + lowercase + 2 digits + 1 symbol + Uppercase
  // Example: Pr08*T
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnopqrstuvwxyz";
  const digits = "0123456789";
  const symbols = "*!@#";

  const pick = (s: string) => s[Math.floor(Math.random() * s.length)];

  const a = pick(upper);
  const b = pick(lower);
  const d1 = pick(digits);
  const d2 = pick(digits);
  const sym = pick(symbols);
  const last = pick(upper);

  return `${a}${b}${d1}${d2}${sym}${last}`;
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
// -------------------------------
async function requireManageUsersOrThrow(): Promise<{ userId: number; roleKey: string }> {
  const res = await getManageUsersAuthz();

  if (!res.ok) {
    const reason = (res as any).reason as string | undefined;

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
// Queries
// -------------------------------
export async function fetchRolesAndUsers(): Promise<{ roles: AppRole[]; users: AppUser[] }> {
  const supabase = await createSupabaseServerClient();

  const { data: rolesData, error: rolesErr } = await supabase
    .from("app_roles")
    .select("id, key, name, description, permissions, is_default, created_at")
    .order("id", { ascending: true });

  if (rolesErr) throw rolesErr;

  const { data: usersData, error: usersErr } = await supabase
    .from("app_users")
    .select("id, auth_user_id, username, full_name, email, role_id, is_active, last_login_at, created_at")
    .order("id", { ascending: true });

  if (usersErr) throw usersErr;

  return {
    roles: (rolesData ?? []).map(mapRoleRow),
    users: (usersData ?? []).map(mapUserRow),
  };
}

// -------------------------------
// Actions
// -------------------------------
export async function createUser(input: CreateAppUserInput): Promise<CreateUserResult> {
  await requireManageUsersOrThrow();

  if (!input.username?.trim()) throw new Error("username is required.");
  if (!input.fullName?.trim()) throw new Error("fullName is required.");
  if (!input.email?.trim()) throw new Error("email is required.");
  if (!input.roleId) throw new Error("roleId is required.");

  const generatedPassword = generatePassword();

  const { data: authRes, error: authErr } = await supabaseAdmin.auth.admin.createUser({
    email: input.email.trim(),
    password: generatedPassword,
    email_confirm: true,
  });

  if (authErr) throw authErr;

  const authUserId = authRes?.user?.id;
  if (!authUserId) throw new Error("Auth user not created (auth_user_id missing).");

  const { data: createdRow, error: insErr } = await supabaseAdmin
    .from("app_users")
    .insert({
      auth_user_id: authUserId,
      username: input.username.trim(),
      full_name: input.fullName.trim(),
      email: input.email.trim(),
      role_id: input.roleId,
      is_active: input.isActive ?? true,
    })
    .select("id, auth_user_id, username, full_name, email, role_id, is_active, last_login_at, created_at")
    .single();

  if (insErr) throw insErr;

  return {
    user: mapUserRow(createdRow as UserRow),
    generatedPassword,
  };
}

export async function updateUser(userId: number, input: UpdateAppUserInput): Promise<AppUser | null> {
  await requireManageUsersOrThrow();

  const patch: Record<string, any> = {};

  if (typeof input.fullName === "string") patch.full_name = input.fullName.trim();
  if (typeof input.email === "string") patch.email = input.email.trim();
  if (typeof input.roleId === "number") patch.role_id = input.roleId;
  if (typeof input.isActive === "boolean") patch.is_active = input.isActive;

  const { data, error } = await supabaseAdmin
    .from("app_users")
    .update(patch)
    .eq("id", userId)
    .select("id, auth_user_id, username, full_name, email, role_id, is_active, last_login_at, created_at")
    .single();

  if (error) throw error;
  return data ? mapUserRow(data as UserRow) : null;
}

export async function deactivateUser(userId: number): Promise<void> {
  await requireManageUsersOrThrow();

  const { error } = await supabaseAdmin.from("app_users").update({ is_active: false }).eq("id", userId);
  if (error) throw error;
}

export async function resetUserPassword(userId: number): Promise<ResetPasswordResult> {
  await requireManageUsersOrThrow();

  const { data: row, error: rowErr } = await supabaseAdmin
    .from("app_users")
    .select("id, auth_user_id")
    .eq("id", userId)
    .single();

  if (rowErr) throw rowErr;
  if (!row?.auth_user_id) throw new Error("User is not linked to Supabase Auth (auth_user_id missing).");

  const generatedPassword = generatePassword();

  const { error: updErr } = await supabaseAdmin.auth.admin.updateUserById(row.auth_user_id, {
    password: generatedPassword,
  });

  if (updErr) throw new Error(updErr.message);

  // ✅ Fix: ResetPasswordResult requires userId
  return { userId, generatedPassword };
}

export async function updateRolePermissions(roleId: number, perms: PermissionMap): Promise<AppRole | null> {
  await requireManageUsersOrThrow();

  const { data, error } = await supabaseAdmin
    .from("app_roles")
    .update({ permissions: perms })
    .eq("id", roleId)
    .select("id, key, name, description, permissions, is_default, created_at")
    .single();

  if (error) throw error;
  return data ? mapRoleRow(data as RoleRow) : null;
}
