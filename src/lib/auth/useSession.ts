"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export function useSession() {
  const [session, setSession] = useState<any>(null);

  useEffect(() => {
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    supabase.auth.getSession().then(({ data }) => setSession(data.session ?? null));

    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s ?? null);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  return session;
}
