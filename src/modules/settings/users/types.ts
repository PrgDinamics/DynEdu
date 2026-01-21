// src/modules/settings/users/types.ts

export type AppRoleKey = "superadmin" | "admin" | "operator";

export type PermissionMap = Record<string, boolean>;

export type AppRole = {
  id: number;
  key: AppRoleKey | string;
  name: string;
  description: string | null;
  permissions?: PermissionMap;
  isDefault: boolean;
};

export type AppUser = {
  id: number;
  username: string;
  fullName: string;
  email: string;
  roleId: number;
  isActive: boolean;
  lastLoginAt?: string | null;
  createdAt?: string;
};

export type CreateAppUserInput = {
  username: string;
  fullName: string;
  email: string;
  roleId: number;
  isActive: boolean;
};

export type UpdateAppUserInput = {
  username?: string;
  fullName: string;
  email: string;
  roleId: number;
  isActive: boolean;
};

export type CreateUserResult = {
  user: AppUser;
  generatedPassword: string;
};

export type ResetPasswordResult = {
  userId: number;
  generatedPassword: string;
};
