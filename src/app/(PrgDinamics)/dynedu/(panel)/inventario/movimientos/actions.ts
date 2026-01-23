"use server";

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export type InventoryMovementType = "WEB_RESERVE" | "WEB_SALE" | "CONSIGNACION_SALIDA";

export type InventoryMovementRow = {
  movement_id: string;
  happened_at: string | null;
  movement_type: InventoryMovementType;
  source_id: string;
  producto_id: number | null;
  product_code: string | null;
  product_name: string | null;
  qty: number;
  counterparty: string | null;
  district: string | null;
};

async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        },
      },
    }
  );
}

export async function fetchInventoryMovements(): Promise<InventoryMovementRow[]> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("inventory_movements_view")
    .select(
      "movement_id,happened_at,movement_type,source_id,producto_id,product_code,product_name,qty,counterparty,district"
    )
    .order("happened_at", { ascending: false })
    .limit(1000);

  if (error) {
    console.error("[fetchInventoryMovements] error:", error.message);
    return [];
  }

  return (data ?? []) as InventoryMovementRow[];
}
