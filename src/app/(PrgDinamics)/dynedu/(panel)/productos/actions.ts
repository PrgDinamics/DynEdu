"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabaseClient";

import type {
  Producto,
  ProductoCreateInput,
  ProductoUpdateInput,
} from "@/modules/dynedu/types";

type PermissionMap = Record<string, boolean>;

function normalizeText(v: unknown) {
  const s = String(v ?? "").trim();
  return s.length ? s : null;
}

async function sb() {
  return await createSupabaseServerClient();
}

async function getMeAuthz() {
  const supabase = await sb();

  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  if (userErr) throw new Error(userErr.message);
  const authUser = userRes?.user;
  if (!authUser) throw new Error("Not authenticated.");

  // app_users MUST have auth_user_id linked
  const { data, error } = await supabase
    .from("app_users")
    .select("id, role:app_roles(key, permissions)")
    .eq("auth_user_id", authUser.id)
    .single();

  if (error) throw new Error(error.message);

  const roleKey = (data as any)?.role?.key as string | undefined;
  const permissions = ((data as any)?.role?.permissions ?? {}) as PermissionMap;

  return { roleKey, permissions };
}

async function requirePermissionOrThrow(keys: string[]) {
  const authz = await getMeAuthz();

  // superadmin bypass
  if (authz.roleKey === "superadmin") return authz;

  const ok = keys.some((k) => authz.permissions?.[k] === true);
  if (!ok) throw new Error("Not authorized.");
  return authz;
}

export async function generarCodigoProducto(): Promise<string> {
  // ver productos ya debe poder generar código (para ver el form)
  await requirePermissionOrThrow(["canViewProducts", "canManageProducts"]);

  const PREFIX = "PRO";
  const PAD = 4;

  const supabase = await sb();

  const { data, error } = await supabase
    .from("productos")
    .select("internal_id")
    .like("internal_id", `${PREFIX}%`)
    .order("internal_id", { ascending: false })
    .limit(1);

  if (error) throw error;

  const last = data?.[0]?.internal_id as string | undefined;
  const lastNumber = last
    ? Number(String(last).replace(PREFIX, "").replace(/\D/g, ""))
    : 0;

  const next = lastNumber + 1;
  const nextStr = String(next).padStart(PAD, "0");
  return `${PREFIX}${nextStr}`;
}

export async function fetchProductos(): Promise<Producto[]> {
  await requirePermissionOrThrow(["canViewProducts", "canManageProducts"]);

  const supabase = await sb();

  const { data, error } = await supabase
    .from("productos")
    .select(
      `
      id,
      internal_id,
      codigo_venta,
      descripcion,
      editorial,
      isbn,
      autor,
      anio_publicacion,
      edicion,
      is_public,
      foto_url,
      created_at,
      updated_at
    `
    )
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as Producto[];
}

export async function crearProducto(input: ProductoCreateInput): Promise<Producto> {
  await requirePermissionOrThrow(["canManageProducts"]);

  const supabase = await sb();

  const internalId =
    normalizeText((input as any).internal_id) || (await generarCodigoProducto());

  const payload: any = {
    internal_id: internalId,
    codigo_venta: normalizeText((input as any).codigo_venta),
    descripcion: String((input as any).descripcion ?? "").trim(),
    editorial: normalizeText((input as any).editorial),
    isbn: normalizeText((input as any).isbn),
    autor: normalizeText((input as any).autor),
    anio_publicacion:
      (input as any).anio_publicacion !== null &&
      (input as any).anio_publicacion !== undefined
        ? Number((input as any).anio_publicacion)
        : null,
    edicion: normalizeText((input as any).edicion),
    is_public: Boolean((input as any).is_public),
    foto_url: normalizeText((input as any).foto_url),
  };

  if (!payload.descripcion) throw new Error("descripcion is required");

  const { data, error } = await supabase
    .from("productos")
    .insert(payload)
    .select(
      `
      id,
      internal_id,
      codigo_venta,
      descripcion,
      editorial,
      isbn,
      autor,
      anio_publicacion,
      edicion,
      is_public,
      foto_url,
      created_at,
      updated_at
    `
    )
    .single();

  if (error) {
    if ((error as any).code === "23505") {
      throw new Error("Duplicate value (internal_id / codigo_venta must be unique)");
    }
    throw error;
  }

  revalidatePath("/dynedu/productos");
  return data as Producto;
}

export async function actualizarProducto(id: number, input: ProductoUpdateInput): Promise<Producto> {
  await requirePermissionOrThrow(["canManageProducts"]);

  const supabase = await sb();

  const payload: any = {
    codigo_venta: normalizeText((input as any).codigo_venta),
    descripcion: String((input as any).descripcion ?? "").trim(),
    editorial: normalizeText((input as any).editorial),
    isbn: normalizeText((input as any).isbn),
    autor: normalizeText((input as any).autor),
    anio_publicacion:
      (input as any).anio_publicacion !== null &&
      (input as any).anio_publicacion !== undefined
        ? Number((input as any).anio_publicacion)
        : null,
    edicion: normalizeText((input as any).edicion),
    is_public: Boolean((input as any).is_public),
    foto_url: normalizeText((input as any).foto_url),
  };

  if (!payload.descripcion) throw new Error("descripcion is required");

  const { data, error } = await supabase
    .from("productos")
    .update(payload)
    .eq("id", id)
    .select(
      `
      id,
      internal_id,
      codigo_venta,
      descripcion,
      editorial,
      isbn,
      autor,
      anio_publicacion,
      edicion,
      is_public,
      foto_url,
      created_at,
      updated_at
    `
    )
    .single();

  if (error) {
    if ((error as any).code === "23505") {
      throw new Error("Duplicate value (codigo_venta must be unique)");
    }
    throw error;
  }

  revalidatePath("/dynedu/productos");
  return data as Producto;
}

export async function eliminarProducto(id: number): Promise<void> {
  await requirePermissionOrThrow(["canManageProducts"]);

  const supabase = await sb();

  const { error } = await supabase.from("productos").delete().eq("id", id);
  if (error) throw error;

  revalidatePath("/dynedu/productos");
}

export async function setProductoPublicado(id: number, isPublic: boolean): Promise<void> {
  await requirePermissionOrThrow(["canManageProducts"]);

  const supabase = await sb();

  const { error } = await supabase
    .from("productos")
    .update({ is_public: isPublic })
    .eq("id", id);

  if (error) throw error;

  revalidatePath("/dynedu/productos");
}
