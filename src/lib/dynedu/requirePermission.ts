import { getDyneduMeWithPermissions } from "@/lib/dynedu/guard";

export async function requirePermissionOrThrow(anyOf: string[]) {
  const me = await getDyneduMeWithPermissions();
  if (!me) throw new Error("Not authenticated.");

  if ((me.roleKey || "").toLowerCase() === "superadmin") return me;

  const ok = anyOf.some((k) => me.permissions?.[k] === true);
  if (!ok) throw new Error("Not authorized.");

  return me;
}
