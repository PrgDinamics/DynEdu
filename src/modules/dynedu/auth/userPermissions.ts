// src/modules/dynedu/auth/userPermissions.ts

"use server";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  EffectivePermissions,
  PermissionMap,
  UserPermissionOverride,
  computeEffectivePermissions,
} from "./permissions";

interface AppUserRow {
  id: number;
  full_name: string;
  email: string;
  role_id: number;
  is_active: boolean;
  last_login_at: string | null;
}

interface AppRoleRow {
  id: number;
  key: string;
  name: string;
  description: string | null;
  permissions: PermissionMap | null;
}

export interface CurrentUser {
  id: number;
  fullName: string;
  email: string;
  roleId: number;
  roleKey: string;
  roleName: string;
  isActive: boolean;
  lastLoginAt: string | null;
  permissions: EffectivePermissions;
}

/**
 * Fetch app_users row by email.
 */
async function getAppUserByEmail(
  email: string,
): Promise<AppUserRow | null> {
  const { data, error } = await supabaseAdmin
    .from("app_users")
    .select("id, full_name, email, role_id, is_active, last_login_at")
    .eq("email", email)
    .maybeSingle();

  if (error) {
    console.error("getAppUserByEmail error:", error);
    return null;
  }

  if (!data) return null;
  return data as AppUserRow;
}

/**
 * Fetch role row for a given role_id.
 */
async function getRoleById(roleId: number): Promise<AppRoleRow | null> {
  const { data, error } = await supabaseAdmin
    .from("app_roles")
    .select("id, key, name, description, permissions")
    .eq("id", roleId)
    .maybeSingle();

  if (error) {
    console.error("getRoleById error:", error);
    return null;
  }

  if (!data) return null;
  // Supabase devuelve permissions como any, lo forzamos a PermissionMap
  return {
    ...(data as any),
    permissions: (data as any).permissions as PermissionMap | null,
  };
}

/**
 * Fetch overrides for a given user_id.
 */
async function getOverridesByUserId(
  userId: number,
): Promise<UserPermissionOverride[]> {
  const { data, error } = await supabaseAdmin
    .from("app_user_permission_overrides")
    .select("id, user_id, permission_key, mode")
    .eq("user_id", userId);

  if (error) {
    console.error("getOverridesByUserId error:", error);
    return [];
  }

  return (data ?? []) as UserPermissionOverride[];
}

/**
 * Get a full CurrentUser object (user + role + effective permissions)
 * using the internal app_users.id.
 */
export async function getUserWithPermissionsById(
  userId: number,
): Promise<CurrentUser | null> {
  const { data: userData, error: userError } = await supabaseAdmin
    .from("app_users")
    .select("id, full_name, email, role_id, is_active, last_login_at")
    .eq("id", userId)
    .maybeSingle();

  if (userError) {
    console.error("getUserWithPermissionsById error:", userError);
    return null;
  }
  if (!userData) return null;

  const user = userData as AppUserRow;
  if (!user.is_active) {
    // Usuario inactivo => tratamos como no logueado / sin acceso
    return null;
  }

  const role = await getRoleById(user.role_id);
  if (!role) {
    console.error("Role not found for user:", user.id, user.role_id);
    return null;
  }

  const overrides = await getOverridesByUserId(user.id);
  const effectivePermissions = computeEffectivePermissions(
    role.permissions,
    overrides,
  );

  const currentUser: CurrentUser = {
    id: user.id,
    fullName: user.full_name,
    email: user.email,
    roleId: user.role_id,
    roleKey: role.key,
    roleName: role.name,
    isActive: user.is_active,
    lastLoginAt: user.last_login_at,
    permissions: effectivePermissions,
  };

  return currentUser;
}

/**
 * Get CurrentUser using an email address.
 * Útil mientras conectas con Supabase Auth (session.user.email).
 */
export async function getUserWithPermissionsByEmail(
  email: string,
): Promise<CurrentUser | null> {
  const user = await getAppUserByEmail(email);
  if (!user) return null;
  return getUserWithPermissionsById(user.id);
}
