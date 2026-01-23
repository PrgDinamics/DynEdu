import DyneduLogin from "./DyneduLogin/DyuneduLogin";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabaseClient";

export const metadata = {
  title: "Intranet DynEdu",
  description: "Acceso al panel corporativo.",
};

export default async function Page() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();

  if (data.user) {
    redirect("/dynedu/actividad");
  }

  return <DyneduLogin />;
}
