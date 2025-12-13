// src/modules/settings/users/types.ts

export type AppRoleKey = "superadmin" | "admin" | "operator";

export type AppRole = {
  id: number;
  key: AppRoleKey | string;
  name: string;
  description: string | null;
  isDefault: boolean;
};

export type AppUser = {
  id: number;
  fullName: string;
  email: string;
  roleId: number;
  isActive: boolean;
  lastLoginAt?: string | null;
  createdAt?: string;
};

export type CreateAppUserInput = {
  fullName: string;
  email: string;
  roleId: number;
  isActive: boolean;
};

export type UpdateAppUserInput = {
  fullName: string;
  email: string;
  roleId: number;
  isActive: boolean;
};
