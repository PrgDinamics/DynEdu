"use server";

import { createSupabaseServerClient } from "@/lib/supabaseClient";

// Generate code PAC0001
export async function generarCodigoPack() {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("packs")
    .select("codigo")
    .order("codigo", { ascending: false })
    .limit(1);

  if (error) throw error;

  if (!data || data.length === 0) return "PAC0001";

  const last = data[0].codigo; // "PAC0007"
  const num = parseInt(String(last).replace("PAC", ""), 10) + 1;

  return `PAC${String(num).padStart(4, "0")}`;
}

// Get one pack by id (refresh after create)
async function obtenerPackPorId(id: string) {
  const supabase = await createSupabaseServerClient();

  const { data: pack, error } = await supabase
    .from("packs")
    .select("*, pack_items ( cantidad, productos ( id, internal_id, descripcion ) )")
    .eq("id", id)
    .single();

  if (error) throw error;

  return {
    ...pack,
    items: (pack?.pack_items ?? []).map((it: any) => ({
      cantidad: it.cantidad,
      productos: it.productos,
    })),
  };
}

// Create pack
export async function crearPack({
  nombre,
  descripcion,
  items,
}: {
  nombre: string;
  descripcion?: string | null;
  items: Array<{ producto_id: string; cantidad: number }>;
}) {
  const supabase = await createSupabaseServerClient();

  const codigo = await generarCodigoPack();

  const { data: newPack, error } = await supabase
    .from("packs")
    .insert({
      codigo,
      nombre,
      descripcion: descripcion ?? null,
      estado: true,
    })
    .select()
    .single();

  if (error) throw error;

  for (const item of items) {
    const { error: errItem } = await supabase.from("pack_items").insert({
      pack_id: newPack.id,
      producto_id: item.producto_id,
      cantidad: item.cantidad,
    });

    if (errItem) throw errItem;
  }

  return await obtenerPackPorId(newPack.id);
}

// ✅ Products for selector
export async function obtenerProductosParaPacks() {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("productos")
    .select("id, internal_id, descripcion")
    .order("internal_id", { ascending: true });

  if (error) throw error;

  return data ?? [];
}

// ✅ Packs with items + product info
export async function obtenerPacks() {
  const supabase = await createSupabaseServerClient();

  const { data: packs, error } = await supabase
    .from("packs")
    .select("*, pack_items ( cantidad, productos ( id, internal_id, descripcion ) )")
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (packs ?? []).map((pack: any) => ({
    ...pack,
    items: (pack.pack_items ?? []).map((it: any) => ({
      cantidad: it.cantidad,
      productos: it.productos,
    })),
  }));
}

// Delete pack
export async function eliminarPack(id: string) {
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.from("packs").delete().eq("id", id);

  if (error) throw error;

  return true;
}
