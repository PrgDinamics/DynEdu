import { redirect } from "next/navigation";
import PerfilClient from "./PerfilClient";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type Props = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function PerfilPage({ searchParams }: Props) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();

  const sp = searchParams ? await searchParams : undefined;

  const nextParamRaw = sp?.next;
  const nextParam =
    typeof nextParamRaw === "string"
      ? nextParamRaw
      : Array.isArray(nextParamRaw)
      ? nextParamRaw[0]
      : undefined;

  if (!data.user) {
    const nextPath = nextParam
      ? `/perfil?next=${encodeURIComponent(nextParam)}`
      : "/perfil";

    redirect(`/auth/login?next=${encodeURIComponent(nextPath)}`);
  }
  return <PerfilClient />;
}
