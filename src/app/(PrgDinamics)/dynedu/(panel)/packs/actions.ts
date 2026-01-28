"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabaseClient";

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
  if (authz.roleKey === "superadmin") return authz;

  const ok = keys.some((k) => authz.permissions?.[k] === true);
  if (!ok) throw new Error("Not authorized.");
  return authz;
}

// ------------------------------------------------------------
// Code generator: PAC0001
// ------------------------------------------------------------
export async function generarCodigoPack(): Promise<string> {
  await requirePermissionOrThrow(["canViewPacks", "canManagePacks"]);

  const PREFIX = "PAC";
  const PAD = 4;

  const supabase = await sb();

  const { data, error } = await supabase
    .from("packs")
    .select("internal_id")
    .like("internal_id", `${PREFIX}%`)
    .order("internal_id", { ascending: false })
    .limit(1);

  if (error) throw error;

  const last = (data?.[0] as any)?.internal_id as string | undefined;
  const lastNumber = last
    ? Number(String(last).replace(PREFIX, "").replace(/\D/g, ""))
    : 0;

  const next = lastNumber + 1;
  return `${PREFIX}${String(next).padStart(PAD, "0")}`;
}

// ------------------------------------------------------------
// Products for selector
// ------------------------------------------------------------
export async function obtenerProductosParaPacks() {
  await requirePermissionOrThrow(["canViewPacks", "canManagePacks"]);

  const supabase = await sb();

  const { data, error } = await supabase
    .from("productos")
    .select("id, internal_id, codigo_venta, descripcion")
    .order("internal_id", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

// ------------------------------------------------------------
// Fetch packs (with items + product info)
// ------------------------------------------------------------
export async function fetchPacks() {
  await requirePermissionOrThrow(["canViewPacks", "canManagePacks"]);

  const supabase = await sb();

  const { data, error } = await supabase
    .from("packs")
    .select(
      `
      id,
      internal_id,
      codigo,
      codigo_venta,
      nombre,
      descripcion,
      is_public,
      foto_url,
      created_at,
      updated_at,
      pack_items (
        id,
        cantidad,
        producto_id,
        productos (
          id,
          internal_id,
          codigo_venta,
          descripcion
        )
      )
    `
    )
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (data ?? []).map((p: any) => ({
    ...p,
    items: (p.pack_items ?? []).map((it: any) => ({
      id: it.id,
      cantidad: it.cantidad,
      producto_id: it.producto_id,
      productos: Array.isArray(it.productos) ? it.productos[0] : it.productos,
    })),
  }));
}

// keep page.tsx working
export async function obtenerPacks() {
  return await fetchPacks();
}

async function fetchPackById(id: number) {
  const supabase = await sb();

  const { data, error } = await supabase
    .from("packs")
    .select(
      `
      id,
      internal_id,
      codigo,
      codigo_venta,
      nombre,
      descripcion,
      is_public,
      foto_url,
      created_at,
      updated_at,
      pack_items (
        id,
        cantidad,
        producto_id,
        productos (
          id,
          internal_id,
          codigo_venta,
          descripcion
        )
      )
    `
    )
    .eq("id", id)
    .single();

  if (error) throw error;

  return {
    ...data,
    items:
      (data as any)?.pack_items?.map((it: any) => ({
        id: it.id,
        cantidad: it.cantidad,
        producto_id: it.producto_id,
        productos: Array.isArray(it.productos) ? it.productos[0] : it.productos,
      })) ?? [],
  };
}

// ------------------------------------------------------------
// Create
// ------------------------------------------------------------
export async function crearPack(input: {
  nombre: string;
  descripcion?: string | null;
  codigo_venta?: string | null;
  is_public?: boolean;
  items: Array<{ producto_id: number; cantidad: number }>;
}) {
  await requirePermissionOrThrow(["canManagePacks"]);

  const supabase = await sb();

  const internalId = await generarCodigoPack();

  const payload: any = {
    internal_id: internalId,
    codigo: internalId, // legacy compatibility
    codigo_venta: normalizeText(input.codigo_venta) ?? internalId,
    nombre: String(input.nombre ?? "").trim(),
    descripcion: normalizeText(input.descripcion),
    estado: true,
    is_public: Boolean(input.is_public),
    foto_url: null,
  };

  if (!payload.nombre) throw new Error("nombre is required");
  if (!input.items?.length) throw new Error("items is required");

  const { data: newPack, error } = await supabase
    .from("packs")
    .insert(payload)
    .select(
      `
      id,
      internal_id,
      codigo,
      codigo_venta,
      nombre,
      descripcion,
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

  for (const it of input.items) {
    const { error: errItem } = await supabase.from("pack_items").insert({
      pack_id: newPack.id,
      producto_id: it.producto_id,
      cantidad: it.cantidad ?? 1,
    });
    if (errItem) throw errItem;
  }

  const full = await fetchPackById(Number(newPack.id));
  revalidatePath("/dynedu/packs");
  return full;
}

// ------------------------------------------------------------
// Update (basic fields + foto_url)
// ------------------------------------------------------------
export async function actualizarPack(
  id: number,
  input: {
    nombre?: string;
    descripcion?: string | null;
    codigo_venta?: string | null;
    is_public?: boolean;
    foto_url?: string | null;
  }
) {
  await requirePermissionOrThrow(["canManagePacks"]);

  const supabase = await sb();

  const payload: any = {
    nombre: input.nombre !== undefined ? String(input.nombre ?? "").trim() : undefined,
    descripcion: input.descripcion !== undefined ? normalizeText(input.descripcion) : undefined,
    codigo_venta: input.codigo_venta !== undefined ? normalizeText(input.codigo_venta) : undefined,
    is_public: input.is_public !== undefined ? Boolean(input.is_public) : undefined,
    foto_url: input.foto_url !== undefined ? normalizeText(input.foto_url) : undefined,
  };

  Object.keys(payload).forEach((k) => payload[k] === undefined && delete payload[k]);

  const { data, error } = await supabase
    .from("packs")
    .update(payload)
    .eq("id", id)
    .select(
      `
      id,
      internal_id,
      codigo,
      codigo_venta,
      nombre,
      descripcion,
      is_public,
      foto_url,
      created_at,
      updated_at
    `
    )
    .single();

  if (error) throw error;

  revalidatePath("/dynedu/packs");
  return data;
}

// ------------------------------------------------------------
// Delete
// ------------------------------------------------------------
export async function eliminarPack(id: number) {
  await requirePermissionOrThrow(["canManagePacks"]);

  const supabase = await sb();

  const { error } = await supabase.from("packs").delete().eq("id", id);
  if (error) throw error;

  revalidatePath("/dynedu/packs");
  return true;
}

// ------------------------------------------------------------
// Toggle public flag (catalog)
// ------------------------------------------------------------
export async function setPackPublicado(id: number, isPublic: boolean) {
  await requirePermissionOrThrow(["canManagePacks"]);

  const supabase = await sb();

  const { error } = await supabase
    .from("packs")
    .update({ is_public: isPublic })
    .eq("id", id);

  if (error) throw error;

  revalidatePath("/dynedu/packs");
}

