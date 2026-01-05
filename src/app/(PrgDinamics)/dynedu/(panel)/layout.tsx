export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

import PanelShell from "./PanelShell";

export default function Layout({ children }: { children: React.ReactNode }) {
  return <PanelShell>{children}</PanelShell>;
}
