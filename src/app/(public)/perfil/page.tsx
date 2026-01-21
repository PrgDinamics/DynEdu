import { redirect } from "next/navigation";
import PerfilClient from "./PerfilClient";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function PerfilPage() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user) {
    redirect(`/auth/login?next=${encodeURIComponent("/perfil")}`);
  }
  console.log("SSR user:", data.user?.email);


  return <PerfilClient />;
}
