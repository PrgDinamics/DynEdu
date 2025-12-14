"use server";

import { supabaseClient } from "@/lib/supabaseClient";

// 🔹 GENERAR CÓDIGO PACK0001
export async function generarCodigoPack() {
  const { data, error } = await supabaseClient
    .from("packs")
    .select("codigo")
    .order("codigo", { ascending: false })
    .limit(1);

  if (error) throw error;

  if (!data || data.length === 0) return "PAC0001";

  const last = data[0].codigo; // "PAC0007"
  const num = parseInt(last.replace("PAC", "")) + 1;

  return `PAC${String(num).padStart(4, "0")}`;
}

// 🔹 CREAR PACK
export async function crearPack({ nombre, descripcion, items }) {
  const codigo = await generarCodigoPack();

  const { data: newPack, error } = await supabaseClient
    .from("packs")
    .insert({
      codigo,
      nombre,
      descripcion,
      estado: true,
    })
    .select()
    .single();

  if (error) throw error;

  // Insertar items
  for (const item of items) {
    const { error: errItem } = await supabaseClient.from("pack_items").insert({
      pack_id: newPack.id,
      producto_id: item.producto_id,
      cantidad: item.cantidad,
    });

    if (errItem) throw errItem;
  }

  return await obtenerPackPorId(newPack.id);
}

// 🔹 OBTENER UN PACK POR ID (para refrescar luego de crear)
async function obtenerPackPorId(id) {
  const { data: pack, error } = await supabaseClient
    .from("packs")
    .select("*, pack_items ( cantidad, productos ( id, internal_id, descripcion ))")
    .eq("id", id)
    .single();

  if (error) throw error;

  return {
    ...pack,
    items: pack.pack_items.map((it) => ({
      cantidad: it.cantidad,
      productos: it.productos,
    })),
  };
}

// 🔹 OBTENER PRODUCTOS PARA EL SELECTOR
export async function obtenerProductosParaPacks() {
  const { data, error } = await supabaseClient
    .from("productos")
    .select("id, internal_id, descripcion")
    .order("internal_id", { ascending: true });

  if (error) throw error;

  return data;
}

// 🔹 OBTENER PACKS COMPLETOS (CON PRODUCTOS)
export async function obtenerPacks() {
  const { data: packs, error } = await supabaseClient
    .from("packs")
    .select("*, pack_items ( cantidad, productos ( id, internal_id, descripcion ))")
    .order("created_at", { ascending: false });

  if (error) throw error;

  return packs.map((pack) => ({
    ...pack,
    items: pack.pack_items.map((it) => ({
      cantidad: it.cantidad,
      productos: it.productos,
    })),
  }));
}

// 🔹 ELIMINAR PACK (NUEVO)
export async function eliminarPack(id) {
  const { error } = await supabaseClient.from("packs").delete().eq("id", id);

  if (error) throw error;

  return true;
}
