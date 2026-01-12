"use server";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import bcrypt from "bcryptjs";
import type {
  AppRole,
  AppUser,
  CreateAppUserInput,
  CreateUserResult,
  PermissionMap,
  ResetPasswordResult,
  UpdateAppUserInput,
} from "@/modules/settings/users/types";

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
  username: string | null;
  full_name: string;
  email: string;
  password_hash?: string | null;
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
  for (let i = 0; i < length; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

const mapRoleRow = (row: RoleRow): AppRole => ({
  id: row.id,
  key: row.key,
  name: row.name,
  description: row.description,
  permissions: safePermissions(row.permissions),
  isDefault: row.is_default,
});

const mapUserRow = (row: UserRow): AppUser => ({
  id: row.id,
  username: row.username ?? "",
  fullName: row.full_name,
  email: row.email,
  roleId: row.role_id,
  isActive: row.is_active,
  lastLoginAt: row.last_login_at,
  createdAt: row.created_at,
});

// Traer roles (SuperAdmin, Admin, Operador)
export async function fetchRoles(): Promise<AppRole[]> {
  const { data, error } = await supabaseAdmin
    .from("app_roles")
    .select(
      "id, key, name, description, permissions, is_default, created_at",
    )
    .order("id", { ascending: true });

  if (error) {
    console.error("Error fetching roles:", error);
    throw error;
  }

  const rows = ((data ?? []) as unknown) as RoleRow[];
  return rows.map(mapRoleRow);
}

// Traer usuarios internos
export async function fetchUsers(): Promise<AppUser[]> {
  const { data, error } = await supabaseAdmin
    .from("app_users")
    .select(
      "id, username, full_name, email, role_id, is_active, last_login_at, created_at",
    )
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Error fetching users:", error);
    throw error;
  }

  const rows = ((data ?? []) as unknown) as UserRow[];
  return rows.map(mapUserRow);
}

// Crear usuario interno
export async function createUser(
  input: CreateAppUserInput,
): Promise<CreateUserResult> {
  const generatedPassword = generatePassword(10);
  const passwordHash = await bcrypt.hash(generatedPassword, 10);

  const { data, error } = await supabaseAdmin
    .from("app_users")
    .insert({
      username: input.username.trim(),
      full_name: input.fullName.trim(),
      email: input.email.trim(),
      password_hash: passwordHash,
      role_id: input.roleId,
      is_active: input.isActive,
    })
    .select(
      "id, username, full_name, email, role_id, is_active, last_login_at, created_at",
    )
    .single();

  if (error) {
    console.error("Error creating user:", error);
    throw error;
  }

  return {
    user: mapUserRow(data as UserRow),
    generatedPassword,
  };
}

// Resetear contraseña (genera una nueva y la devuelve para compartirla)
export async function resetUserPassword(userId: number): Promise<ResetPasswordResult> {
  const generatedPassword = generatePassword(10);
  const passwordHash = await bcrypt.hash(generatedPassword, 10);

  const { error } = await supabaseAdmin
    .from("app_users")
    .update({ password_hash: passwordHash })
    .eq("id", userId);

  if (error) {
    console.error("Error resetting password:", error);
    throw error;
  }

  return { userId, generatedPassword };
}

// Actualizar usuario interno
export async function updateUser(
  id: number,
  input: UpdateAppUserInput,
): Promise<AppUser | null> {
  const { data, error } = await supabaseAdmin
    .from("app_users")
    .update({
      full_name: input.fullName.trim(),
      email: input.email.trim(),
      role_id: input.roleId,
      is_active: input.isActive,
    })
    .eq("id", id)
    .select(
      "id, username, full_name, email, role_id, is_active, last_login_at, created_at",
    )
    .single();

  if (error) {
    console.error("Error updating user:", error);
    throw error;
  }

  return mapUserRow(data as UserRow);
}

// "Eliminar" = desactivar usuario (no borrar físico)
export async function deactivateUser(id: number): Promise<boolean> {
  const { error } = await supabaseAdmin
    .from("app_users")
    .update({ is_active: false })
    .eq("id", id);

  if (error) {
    console.error("Error deactivating user:", error);
    throw error;
  }

  return true;
}

export async function updateRolePermissions(
  roleId: number,
  permissions: Record<string, boolean>,
) {
  const { data, error } = await supabaseAdmin
    .from("app_roles")
    .update({ permissions })
    .eq("id", roleId)
    .select("id, key, name, description, permissions, is_default, created_at")
    .single();

  if (error) throw error;

  return {
    id: data.id,
    key: data.key,
    name: data.name,
    description: data.description,
    isDefault: data.is_default,
    permissions: (data.permissions ?? {}) as Record<string, boolean>,
  };
}
