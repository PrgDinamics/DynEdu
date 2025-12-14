"use server";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type {
  AppRole,
  AppUser,
  CreateAppUserInput,
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
  full_name: string;
  email: string;
  role_id: number;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
};

const mapRoleRow = (row: RoleRow): AppRole => ({
  id: row.id,
  key: row.key,
  name: row.name,
  description: row.description,
  isDefault: row.is_default,
});

const mapUserRow = (row: UserRow): AppUser => ({
  id: row.id,
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
      "id, full_name, email, role_id, is_active, last_login_at, created_at",
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
): Promise<AppUser | null> {
  const { data, error } = await supabaseAdmin
    .from("app_users")
    .insert({
      full_name: input.fullName.trim(),
      email: input.email.trim(),
      role_id: input.roleId,
      is_active: input.isActive,
    })
    .select(
      "id, full_name, email, role_id, is_active, last_login_at, created_at",
    )
    .single();

  if (error) {
    console.error("Error creating user:", error);
    throw error;
  }

  return mapUserRow(data as UserRow);
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
      "id, full_name, email, role_id, is_active, last_login_at, created_at",
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
