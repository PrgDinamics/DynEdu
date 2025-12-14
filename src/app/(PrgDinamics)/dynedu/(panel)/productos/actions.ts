"use server";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type {
  Producto,
  ProductoCreateInput,
  ProductoUpdateInput,
} from "@/modules/dynedu/types";
import { revalidatePath } from "next/cache";

// 🔹 Traer productos
export async function fetchProductos(): Promise<Producto[]> {
  const { data, error } = await supabaseAdmin
    .from("productos")
    .select(
      `
      id,
      internal_id,
      descripcion,
      editorial,
      autor,
      anio_publicacion,
      isbn,
      edicion,
      foto_url,
      created_at,
      updated_at
    `
    )
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data as Producto[];
}

// 🔹 Generar código PRO000X usando internal_id
export async function generarCodigoProducto(): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from("productos")
    .select("internal_id")
    .not("internal_id", "is", null)
    .order("internal_id", { ascending: false })
    .limit(1);

  if (error) throw error;

  if (!data || data.length === 0 || !data[0].internal_id) {
    return "PRO0001";
  }

  const last = data[0].internal_id; // ej. "PRO0007"
  const num = parseInt(last.replace(/\D/g, ""), 10) || 0;
  const next = num + 1;

  return `PRO${String(next).padStart(4, "0")}`;
}

// 🔹 Crear producto (internal_id automático)
export async function crearProducto(
  input: Omit<ProductoCreateInput, "internal_id">
): Promise<Producto> {
  const internal_id = await generarCodigoProducto();

  const { data, error } = await supabaseAdmin
    .from("productos")
    .insert([
      {
        internal_id,
        descripcion: input.descripcion,
        editorial: input.editorial,
        autor: input.autor ?? null,
        anio_publicacion: input.anio_publicacion ?? null,
        isbn: input.isbn ?? null,
        edicion: input.edicion ?? null,
        foto_url: input.foto_url ?? null,
      },
    ])
    .select(
      `
      id,
      internal_id,
      descripcion,
      editorial,
      autor,
      anio_publicacion,
      isbn,
      edicion,
      foto_url,
      created_at,
      updated_at
    `
    )
    .single();

  if (error) throw error;
  revalidatePath("/dynedu/productos");
  return data as Producto;
}

// 🔹 Actualizar producto
export async function actualizarProducto(
  id: number,
  input: ProductoUpdateInput
): Promise<Producto> {
  const { data, error } = await supabaseAdmin
    .from("productos")
    .update({
      descripcion: input.descripcion,
      editorial: input.editorial,
      autor: input.autor ?? null,
      anio_publicacion: input.anio_publicacion ?? null,
      isbn: input.isbn ?? null,
      edicion: input.edicion ?? null,
      foto_url: input.foto_url ?? null,
    })
    .eq("id", id)
    .select(
      `
      id,
      internal_id,
      descripcion,
      editorial,
      autor,
      anio_publicacion,
      isbn,
      edicion,
      foto_url,
      created_at,
      updated_at
    `
    )
    .single();

  if (error) throw error;
  revalidatePath("/dynedu/productos");
  return data as Producto;
}

// 🔹 Eliminar producto
export async function eliminarProducto(id: number): Promise<void> {
  const { error } = await supabaseAdmin
    .from("productos")
    .delete()
    .eq("id", id);

  if (error) throw error;
  revalidatePath("/dynedu/productos");
}
