import { SupabaseClient } from "@supabase/supabase-js";

export async function getDefaultPriceListId(supabase: SupabaseClient) {
  // Prefer: es_predeterminada = true AND estado = true
  const { data: preferred, error: e1 } = await supabase
    .from("price_lists")
    .select("id")
    .eq("estado", true)
    .eq("es_predeterminada", true)
    .limit(1)
    .maybeSingle();

  if (!e1 && preferred?.id) return preferred.id as number;

  // Fallback: any active list
  const { data: fallback } = await supabase
    .from("price_lists")
    .select("id")
    .eq("estado", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  return (fallback?.id as number) ?? null;
}

export async function getPricesForProducts(
  supabase: SupabaseClient,
  priceListId: number,
  productIds: number[]
) {
  if (!priceListId || productIds.length === 0) return new Map<number, number>();

  const { data, error } = await supabase
    .from("price_list_items")
    .select("producto_id,precio")
    .eq("price_list_id", priceListId)
    .in("producto_id", productIds);

  if (error) {
    console.error("[pricing] price_list_items error:", error);
    return new Map<number, number>();
  }

  const map = new Map<number, number>();
  (data ?? []).forEach((row: any) => {
    map.set(Number(row.producto_id), Number(row.precio ?? 0));
  });

  return map;
}
