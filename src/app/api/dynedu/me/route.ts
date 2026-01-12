import { NextResponse } from "next/server";
import { getDyneduSessionUser } from "@/lib/dynedu/auth";

export async function GET() {
  const user = await getDyneduSessionUser();

  if (!user) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  return NextResponse.json({
    ok: true,
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      username: user.username,
      roleId: user.roleId,
      permissions: user.permissions,
    },
  });
}
