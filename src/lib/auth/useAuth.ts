"use client";

import { useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "@/lib/supabaseBrowserClient";

export function useAuth() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;

    const load = async () => {
      // getUser() es mejor para “¿estoy logueado?” que getSession() cuando hay refresh/cookies
      const { data } = await supabase.auth.getUser();
      if (!alive) return;
      setUser(data.user ?? null);
      setReady(true);
    };

    load();

    const { data: sub } = supabase.auth.onAuthStateChange(async (_evt) => {
      const { data } = await supabase.auth.getUser();
      if (!alive) return;
      setUser(data.user ?? null);
      setReady(true);
    });

    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, [supabase]);

  return { user, ready };
}
