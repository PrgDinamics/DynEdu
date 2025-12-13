"use server";

import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const PORTAL_COLEGIO_COOKIE = "portal_colegio_id";

export type ColegioPortalSession = {
  id: number;
  nombre: string | null;          // usamos nombre_comercial aquí
  razon_social: string | null;
  ruc: string;
};

export type ColegioLoginInput = {
  ruc: string;
  accessKey: string;
};

export type ColegioLoginResult = {
  success: boolean;
  error?: string;
};

/**
 * Login for colegio portal (RUC + access_key).
 * Sets a cookie with the colegio id if credentials are valid.
 */
export async function loginColegioAction(
  input: ColegioLoginInput
): Promise<ColegioLoginResult> {
  const ruc = input.ruc.trim();
  const accessKey = input.accessKey.trim();

  if (!ruc || !accessKey) {
    return { success: false, error: "RUC y código de acceso son requeridos." };
  }

  const { data, error } = await supabaseAdmin
    .from("colegios")
    .select(
      "id, razon_social, nombre_comercial, ruc, access_key, activo"
    )
    .eq("ruc", ruc)
    .limit(1);

  if (error) {
    console.error("[loginColegioAction] error:", error);
    return { success: false, error: "Error al validar el colegio." };
  }

  const colegio = data?.[0] as
    | {
        id: number;
        razon_social: string | null;
        nombre_comercial: string | null;
        ruc: string;
        access_key: string | null;
        activo: boolean | null;
      }
    | undefined;

  if (!colegio) {
    return { success: false, error: "Colegio no encontrado." };
  }

  if (!colegio.activo) {
    return {
      success: false,
      error: "El colegio no está activo para esta campaña.",
    };
  }

  if (!colegio.access_key || colegio.access_key !== accessKey) {
    return { success: false, error: "Código de acceso incorrecto." };
  }

  // Next 16: cookies() es async
  const cookieStore = await cookies();
  cookieStore.set(PORTAL_COLEGIO_COOKIE, String(colegio.id), {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    maxAge: 60 * 60 * 8, // 8 horas
  });

  return { success: true };
}

/**
 * Get current colegio from portal cookie.
 */
export async function getPortalColegio(): Promise<ColegioPortalSession | null> {
  const cookieStore = await cookies();
  const rawId = cookieStore.get(PORTAL_COLEGIO_COOKIE)?.value;

  if (!rawId) return null;

  const colegioId = Number(rawId);
  if (!colegioId || Number.isNaN(colegioId)) return null;

  const { data, error } = await supabaseAdmin
    .from("colegios")
    .select("id, razon_social, nombre_comercial, ruc, activo")
    .eq("id", colegioId)
    .limit(1);

  if (error) {
    console.error("[getPortalColegio] error:", error);
    return null;
  }

  const colegio = data?.[0] as
    | {
        id: number;
        razon_social: string | null;
        nombre_comercial: string | null;
        ruc: string;
        activo: boolean | null;
      }
    | undefined;

  if (!colegio || !colegio.activo) return null;

  return {
    id: colegio.id,
    nombre: colegio.nombre_comercial ?? null, // mostramos comercial si existe
    razon_social: colegio.razon_social ?? null,
    ruc: colegio.ruc,
  };
}

/**
 * Logout: clear colegio portal cookie.
 */
export async function logoutColegioAction(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(PORTAL_COLEGIO_COOKIE);
}
