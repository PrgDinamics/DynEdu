import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseClient";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createSupabaseServerClient();

  // 1) Supabase Auth session
  const { data: authData, error: authErr } = await supabase.auth.getUser();
  const authUser = authData?.user;

  if (authErr || !authUser) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  // 2) DynEdu profile linked by auth_user_id
  const { data: profile, error: profErr } = await supabase
    .from("app_users")
    .select("id, email, username, full_name, role_id, is_active")
    .eq("auth_user_id", authUser.id)
    .single();

  // Si no existe perfil, igual devolvemos auth user (para no romper UI)
  if (profErr || !profile) {
    return NextResponse.json({
      ok: true,
      user: {
        id: authUser.id,
        email: authUser.email ?? null,
        fullName: authUser.user_metadata?.fullName ?? null,
        username: authUser.user_metadata?.username ?? null,
        roleId: null,
        permissions: {},
      },
    });
  }

  // 3) Permissions from role
  const { data: role } = await supabase
    .from("app_roles")
    .select("id, key, permissions")
    .eq("id", profile.role_id)
    .single();

  return NextResponse.json({
    ok: true,
    user: {
      id: profile.id, // id interno de app_users (si tu UI usa esto)
      email: profile.email,
      fullName: profile.full_name,
      username: profile.username,
      roleId: profile.role_id,
      permissions: (role?.permissions ?? {}) as Record<string, boolean>,
    },
  });
}
