export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

import PanelShell from "./PanelShell";
import NoAccess from "./components/error/NoAccess";
import { getDyneduMeWithPermissions } from "@/lib/dynedu/guard";

export default async function Layout({ children }: { children: React.ReactNode }) {
  const me = await getDyneduMeWithPermissions();

  // ✅ Si no hay sesión o no tiene perfil/activo => NoAccess
  if (!me) return <NoAccess />;

  // ✅ PanelShell recibe permisos reales (ya no cookie fake)
  return <PanelShell permissions={me.permissions}>{children}</PanelShell>;
}
