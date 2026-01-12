export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

import PanelShell from "./PanelShell";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type PermissionMap = Record<string, boolean>;

type OverrideRow = {
  permission_key: string;
  mode: "grant" | "deny";
};

async function getPanelPermissionsFromCookie(): Promise<PermissionMap | null> {
  // Placeholder cookie name (we'll set it when we implement login)
  const cookieStore = await cookies();
  const email = cookieStore.get("dynedu_user_email")?.value;

  if (!email) return null;

  const { data: user, error: userError } = await supabaseAdmin
    .from("app_users")
    .select("id, role_id, is_active")
    .eq("email", email)
    .maybeSingle();

  if (userError || !user || !user.is_active) return null;

  const { data: role, error: roleError } = await supabaseAdmin
    .from("app_roles")
    .select("permissions")
    .eq("id", user.role_id)
    .maybeSingle();

  if (roleError || !role) return null;

  const base: PermissionMap = (role as any).permissions ?? {};

  const { data: overrides, error: ovError } = await supabaseAdmin
    .from("app_user_permission_overrides")
    .select("permission_key, mode")
    .eq("user_id", user.id);

  if (ovError) {
    // If overrides fail, we still allow base role permissions
    return base;
  }

  const finalPerms: PermissionMap = { ...base };
  for (const ov of ((overrides ?? []) as OverrideRow[])) {
    finalPerms[ov.permission_key] = ov.mode === "grant";
  }

  return finalPerms;
}

export default async function Layout({ children }: { children: React.ReactNode }) {
  const permissions = await getPanelPermissionsFromCookie();
  return <PanelShell permissions={permissions}>{children}</PanelShell>;
}
