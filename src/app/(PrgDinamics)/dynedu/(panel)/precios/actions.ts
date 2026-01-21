"use server";

import { createSupabaseServerClient } from "@/lib/supabaseClient";
// 🧮 Generar código tipo LPR0001
async function generarCodigoListaPrecio() {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("price_lists")
    .select("internal_id")
    .order("internal_id", { ascending: false })
    .limit(1);

  if (error) throw error;

  if (!data || data.length === 0) return "LPR0001";

  const last = data[0].internal_id ?? "LPR0000";
  const num = parseInt(last.replace("LPR", "")) + 1;

  return `LPR${String(num).padStart(4, "0")}`;
}

// ✅ Asegura que exista una lista de precios por defecto
export async function ensureDefaultPriceList() {
    const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("price_lists")
    .select("*")
    .eq("es_predeterminada", true)
    .maybeSingle();

  if (error && error.code !== "PGRST116") {
    throw error;
  }

  if (data) return data;

  const codigo = await generarCodigoListaPrecio();

  const { data: created, error: insertError } = await supabase
    .from("price_lists")
    .insert({
      internal_id: codigo,
      nombre: "Lista de precios principal",
      descripcion: "Lista predeterminada para la campaña actual",
      moneda: "PEN",
      es_predeterminada: true,
      estado: true,
    })
    .select()
    .single();

  if (insertError) throw insertError;

  return created;
}

// 🔹 Productos + precio para una lista
export async function fetchProductosConPrecios(priceListId: number) {
    const supabase = await createSupabaseServerClient();
  const { data: productos, error: prodError } = await supabase
    .from("productos")
    .select("id, internal_id, descripcion")
    .order("internal_id", { ascending: true });

  if (prodError) throw prodError;

  const { data: items, error: itemsError } = await supabase
    .from("price_list_items")
    .select("producto_id, precio")
    .eq("price_list_id", priceListId)
    .not("producto_id", "is", null);

  if (itemsError) throw itemsError;

  const precioMap = new Map<number, number>();
  for (const item of items ?? []) {
    if (item.producto_id != null && item.precio != null) {
      precioMap.set(item.producto_id, Number(item.precio));
    }
  }

  return (productos ?? []).map((p) => ({
    producto_id: p.id as number,
    internal_id: p.internal_id as string,
    descripcion: p.descripcion as string,
    precio: precioMap.get(p.id as number) ?? null,
  }));
}

// 🔹 Packs + precio + productos contenidos
export async function fetchPacksConPrecios(priceListId: number) {
  // Traemos packs activos
    const supabase = await createSupabaseServerClient();

  const { data: packs, error: packsError } = await supabase
    .from("packs")
    .select("id, internal_id, nombre, descripcion, estado")
    .order("internal_id", { ascending: true });

  if (packsError) throw packsError;

  const activos = (packs ?? []).filter((p) => p.estado !== false);

  // Traemos precios existentes
  const { data: itemsPrecio, error: itemsPrecioError } = await supabase
    .from("price_list_items")
    .select("pack_id, precio")
    .eq("price_list_id", priceListId)
    .not("pack_id", "is", null);

  if (itemsPrecioError) throw itemsPrecioError;

  const precioMap = new Map<number, number>();
  for (const item of itemsPrecio ?? []) {
    if (item.pack_id != null && item.precio != null) {
      precioMap.set(item.pack_id, Number(item.precio));
    }
  }

  // Si no hay packs, devolvemos vacío
  if (activos.length === 0) {
    return [];
  }

  // Traemos los productos que componen cada pack
  const packIds = activos.map((p) => p.id as number);

  const { data: itemsPack, error: itemsPackError } = await supabase
    .from("pack_items")
    .select("pack_id, cantidad, productos (internal_id, descripcion)")
    .in("pack_id", packIds);

  if (itemsPackError) throw itemsPackError;

  // Los agrupamos por pack_id
  const itemsPorPack: Record<
    number,
    { internal_id: string; descripcion: string; cantidad: number }[]
  > = {};

  for (const it of itemsPack ?? []) {
    const packId = it.pack_id as number;
    const prod = (it as any).productos || {};
    const internalId = (prod.internal_id as string) ?? "";
    const descripcion = (prod.descripcion as string) ?? "";
    const cantidad = (it.cantidad as number) ?? 1;

    if (!itemsPorPack[packId]) {
      itemsPorPack[packId] = [];
    }

    itemsPorPack[packId].push({
      internal_id: internalId,
      descripcion,
      cantidad,
    });
  }

  // Armamos el resultado final
  return activos.map((p) => ({
    pack_id: p.id as number,
    internal_id: (p.internal_id as string) ?? "", // código (PAC0001, etc.)
    nombre: p.nombre as string,
    descripcion: (p.descripcion as string) ?? null,
    precio: precioMap.get(p.id as number) ?? null,
    items: itemsPorPack[p.id as number] ?? [],
  }));
}

// 🔹 Crear / actualizar precio de PRODUCTO
export async function upsertPrecioProducto(
  
  priceListId: number,
  productoId: number,
  precio: number
) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("price_list_items")
    .upsert(
      {
        price_list_id: priceListId,
        producto_id: productoId,
        pack_id: null,
        precio,
      },
      {
        onConflict: "price_list_id,producto_id",
      }
    );

  if (error) throw error;
}

// 🔹 Crear / actualizar precio de PACK
export async function upsertPrecioPack(
  priceListId: number,
  packId: number,
  precio: number
) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("price_list_items")
    .upsert(
      {
        price_list_id: priceListId,
        pack_id: packId,
        producto_id: null,
        precio,
      },
      {
        onConflict: "price_list_id,pack_id",
      }
    );

  if (error) throw error;
}

// (Opcional) actualizar cabecera de la lista
export async function actualizarCabeceraLista(
  priceListId: number,
  data: { nombre?: string; descripcion?: string }
) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("price_lists")
    .update(data)
    .eq("id", priceListId);

  if (error) throw error;
}
