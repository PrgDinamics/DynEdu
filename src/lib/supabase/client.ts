// src/lib/supabase/client.ts
export { createSupabaseBrowserClient } from "@/lib/supabaseBrowserClient";

// compat por si en algún módulo usan createClient
export { createSupabaseBrowserClient as createClient } from "@/lib/supabaseBrowserClient";
