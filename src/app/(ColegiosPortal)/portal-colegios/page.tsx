import { redirect } from "next/navigation";

import PortalColegiosLogin from "./PortalColegiosLogin/PortalColegiosLogin";
import { getPortalColegio } from "./actions";
export const metadata = {
  title: "Portal de Colegios | DynEdu",
  description: "Acceso para registrar consignaciones por campaña.",
};

export default async function Page() {
  // If already logged in, skip login screen
  const colegio = await getPortalColegio();
  if (colegio) redirect("/portal-colegios/consignacion");

  return <PortalColegiosLogin />;
}
