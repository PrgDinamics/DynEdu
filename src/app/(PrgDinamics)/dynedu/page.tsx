import DyneduLogin from "./DyneduLogin/DyuneduLogin";
import { redirect } from "next/navigation";
import { getDyneduSessionUser } from "@/lib/dynedu/auth";

export const metadata = {
  title: "Intranet DynEdu",
  description: "Acceso al panel de campaña académica.",
};

export default async function Page() {
  const session = await getDyneduSessionUser();
  if (session) {
    redirect("/dynedu/actividad");
  }

  return <DyneduLogin />;
}
