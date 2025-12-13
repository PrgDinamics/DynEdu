"use server";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type {
  Colegio,
  CreateColegioInput,
  UpdateColegioInput,
} from "@/modules/dynedu/types";

// Representación real de la fila en Supabase
type ColegioRow = {
  id: number;
  ruc: string;
  razon_social: string | null;
  nombre_comercial: string | null;
  direccion: string | null;
  referencia: string | null;
  contacto_nombre: string | null;
  contacto_email: string | null;
  contacto_celular: string | null;
  access_key: string | null;
  activo: boolean;
  created_at?: string;
  updated_at?: string;
};

const mapRowToColegio = (row: ColegioRow): Colegio => ({
  id: row.id,
  ruc: row.ruc,
  razon_social: row.razon_social,
  nombre: row.nombre_comercial ?? "",
  direccion: row.direccion,
  referencia: row.referencia,
  contacto_nombre: row.contacto_nombre,
  contacto_email: row.contacto_email,
  contacto_celular: row.contacto_celular,
  access_key: row.access_key,
  activo: row.activo,
  created_at: row.created_at,
  updated_at: row.updated_at,
});

const generateAccessKey = () => {
  const part1 = Math.random().toString(36).substring(2, 5).toUpperCase();
  const part2 = Math.random().toString(36).substring(2, 5).toUpperCase();
  return `${part1}-${part2}`;
};

export async function fetchColegios(): Promise<Colegio[]> {
  const { data, error } = await supabaseAdmin
    .from("colegios")
    .select(
      [
        "id",
        "ruc",
        "razon_social",
        "nombre_comercial",
        "direccion",
        "referencia",
        "contacto_nombre",
        "contacto_email",
        "contacto_celular",
        "access_key",
        "activo",
        "created_at",
        "updated_at",
      ].join(", "),
    )
    .order("nombre_comercial", { ascending: true });

  if (error) {
    console.error("Error fetching colegios:", error);
    throw error;
  }

  // 👇 aquí el cambio importante (pasamos por unknown)
  const rows = ((data ?? []) as unknown) as ColegioRow[];

  return rows.map(mapRowToColegio);
}

export async function createColegio(
  params: CreateColegioInput,
): Promise<Colegio | null> {
  const accessKey = generateAccessKey();

  const { data, error } = await supabaseAdmin
    .from("colegios")
    .insert({
      ruc: params.ruc,
      razon_social: params.razon_social || null,
      nombre_comercial: params.nombre,
      direccion: params.direccion || null,
      referencia: params.referencia || null,
      contacto_nombre: params.contacto_nombre || null,
      contacto_email: params.contacto_email || null,
      contacto_celular: params.contacto_celular || null,
      access_key: accessKey,
      activo: true,
    })
    .select(
      "id, ruc, razon_social, nombre_comercial, direccion, referencia, contacto_nombre, contacto_email, contacto_celular, access_key, activo, created_at, updated_at",
    )
    .single();

  if (error) {
    console.error("Error creating colegio:", error);
    throw error;
  }

  return mapRowToColegio(data as ColegioRow);
}

export async function updateColegio(
  id: number,
  params: UpdateColegioInput,
): Promise<Colegio | null> {
  const { data, error } = await supabaseAdmin
    .from("colegios")
    .update({
      ruc: params.ruc,
      razon_social: params.razon_social || null,
      nombre_comercial: params.nombre,
      direccion: params.direccion || null,
      referencia: params.referencia || null,
      contacto_nombre: params.contacto_nombre || null,
      contacto_email: params.contacto_email || null,
      contacto_celular: params.contacto_celular || null,
      activo: params.activo,
    })
    .eq("id", id)
    .select(
      "id, ruc, razon_social, nombre_comercial, direccion, referencia, contacto_nombre, contacto_email, contacto_celular, access_key, activo, created_at, updated_at",
    )
    .single();

  if (error) {
    console.error("Error updating colegio:", error);
    throw error;
  }

  return mapRowToColegio(data as ColegioRow);
}

export async function deleteColegio(id: number): Promise<boolean> {
  const { error } = await supabaseAdmin
    .from("colegios")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Error deleting colegio:", error);
    throw error;
  }

  return true;
}
