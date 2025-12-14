// src/modules/dynedu/auth/permissions.ts

/**
 * All known permission keys in the system.
 * Keep this in sync with what you store in app_roles.permissions.
 */
export type PermissionKey =
  | "dashboard.view"
  | "dashboard.view_sensitive"
  | "productos.view"
  | "productos.create"
  | "productos.edit"
  | "productos.delete"
  | "productos.view_price"
  | "productos.edit_price"
  | "packs.view"
  | "packs.create"
  | "packs.edit"
  | "packs.delete"
  | "precios.view"
  | "precios.edit"
  | "precios.export"
  | "proveedores.view"
  | "proveedores.create"
  | "proveedores.edit"
  | "proveedores.delete"
  | "pedidos.view"
  | "pedidos.create"
  | "pedidos.edit"
  | "pedidos.delete"
  | "pedidos.change_status"
  | "pedidos.view_detail"
  | "tracking.view"
  | "tracking.view_history"
  | "tracking.comment"
  | "tracking.mark_real"
  | "tracking.close_order"
  | "consignaciones.view"
  | "consignaciones.create"
  | "consignaciones.edit"
  | "consignaciones.delete"
  | "stock.view"
  | "stock.adjust"
  | "movimientos.view"
  | "movimientos.create_manual"
  | "kardex.view"
  | "kardex.export"
  | "reportes.view"
  | "reportes.finanzas"
  | "reportes.logistica"
  | "settings.campania.view"
  | "settings.campania.edit"
  | "colegios.view"
  | "colegios.create"
  | "colegios.edit"
  | "colegios.delete"
  | "colegios.manage_portal_access"
  | "usuarios.view"
  | "usuarios.create"
  | "usuarios.edit"
  | "usuarios.deactivate"
  | "roles.view"
  | "roles.edit"
  | "roles.assign"
  | "roles.override_user_permissions";

/**
 * Permissions map as stored in app_roles.permissions
 * and as used in the app.
 */
export type PermissionMap = Partial<Record<PermissionKey, boolean>>;

/**
 * Single override row from app_user_permission_overrides.
 */
export interface UserPermissionOverride {
  id: number;
  user_id: number;
  permission_key: string; // raw from DB
  mode: "grant" | "deny";
}

/**
 * Final, merged permissions for a user.
 */
export type EffectivePermissions = PermissionMap;

/**
 * List of all known permission keys.
 * Useful to ensure we always have a boolean for each one if we want.
 */
export const ALL_PERMISSION_KEYS: PermissionKey[] = [
  "dashboard.view",
  "dashboard.view_sensitive",
  "productos.view",
  "productos.create",
  "productos.edit",
  "productos.delete",
  "productos.view_price",
  "productos.edit_price",
  "packs.view",
  "packs.create",
  "packs.edit",
  "packs.delete",
  "precios.view",
  "precios.edit",
  "precios.export",
  "proveedores.view",
  "proveedores.create",
  "proveedores.edit",
  "proveedores.delete",
  "pedidos.view",
  "pedidos.create",
  "pedidos.edit",
  "pedidos.delete",
  "pedidos.change_status",
  "pedidos.view_detail",
  "tracking.view",
  "tracking.view_history",
  "tracking.comment",
  "tracking.mark_real",
  "tracking.close_order",
  "consignaciones.view",
  "consignaciones.create",
  "consignaciones.edit",
  "consignaciones.delete",
  "stock.view",
  "stock.adjust",
  "movimientos.view",
  "movimientos.create_manual",
  "kardex.view",
  "kardex.export",
  "reportes.view",
  "reportes.finanzas",
  "reportes.logistica",
  "settings.campania.view",
  "settings.campania.edit",
  "colegios.view",
  "colegios.create",
  "colegios.edit",
  "colegios.delete",
  "colegios.manage_portal_access",
  "usuarios.view",
  "usuarios.create",
  "usuarios.edit",
  "usuarios.deactivate",
  "roles.view",
  "roles.edit",
  "roles.assign",
  "roles.override_user_permissions",
];

/**
 * Compute the effective permissions for a given user starting from:
 * - rolePermissions: the JSON stored in app_roles.permissions
 * - overrides: rows from app_user_permission_overrides
 *
 * Rules:
 * - Start from rolePermissions (or all false if none).
 * - For each override:
 *   - mode = 'grant' => force true
 *   - mode = 'deny'  => force false
 */
export function computeEffectivePermissions(
  rolePermissions: PermissionMap | null | undefined,
  overrides: UserPermissionOverride[]
): EffectivePermissions {
  // Start from rolePermissions or empty object
  const base: PermissionMap = { ...(rolePermissions ?? {}) };

  // Apply each override
  for (const ov of overrides) {
    const key = ov.permission_key as PermissionKey;

    // Ignore permissions we don't recognize (typos / outdated keys)
    if (!ALL_PERMISSION_KEYS.includes(key)) continue;

    if (ov.mode === "grant") {
      base[key] = true;
    } else if (ov.mode === "deny") {
      base[key] = false;
    }
  }

  return base;
}

/**
 * Helper to check a single permission.
 * Usage:
 *   if (!hasPermission(perms, "tracking.close_order")) { ... }
 */
export function hasPermission(
  permissions: EffectivePermissions | null | undefined,
  key: PermissionKey
): boolean {
  if (!permissions) return false;
  return !!permissions[key];
}
