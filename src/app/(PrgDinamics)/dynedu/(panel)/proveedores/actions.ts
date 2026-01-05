"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type {
  Proveedor,
  ProveedorCreateInput,
  ProveedorUpdateInput,
  ProveedorContacto,
  ProveedorContactoInput,
} from "@/modules/dynedu/types";

const BASE_PATH = "/dynedu/proveedores";

// -------------------------------------
// Helpers
// -------------------------------------

async function generarSiguienteCodigoProveedor(): Promise<string> {
  // Tomamos el último internal_id y le sumamos 1 → PRV0001, PRV0002, etc.
  try {
    const { data, error } = await supabaseAdmin
      .from("proveedores")
      .select("internal_id")
      .order("internal_id", { ascending: false })
      .limit(1);

    if (error) {
      console.error("Error generarSiguienteCodigoProveedor:", error);
      return "PRV0001";
    }

    const last = data?.[0]?.internal_id as string | undefined;
    if (!last) return "PRV0001";

    const match = last.match(/(\d+)$/);
    const current = match ? parseInt(match[1], 10) : 0;
    const next = current + 1;
    return `PRV${String(next).padStart(4, "0")}`;
  } catch (err) {
    console.error("Excepción generarSiguienteCodigoProveedor:", err);
    return "PRV0001";
  }
}

// -------------------------------------
// Queries
// -------------------------------------

export async function getProveedores(): Promise<Proveedor[]> {
  try {
    const { data, error } = await supabaseAdmin
      .from("proveedores")
      .select(
        `
        id,
        internal_id,
        razon_social,
        nombre_comercial,
        ruc,
        direccion,
        referencia,
        contacto_nombre,
        contacto_celular,
        contacto_correo,
        total_pedidos,
        total_unidades,
        created_at,
        updated_at
      `
      )
      .order("internal_id", { ascending: true });

    if (error) {
      console.error("Error getProveedores:", error);
      return [];
    }

    return (data ?? []) as Proveedor[];
  } catch (err) {
    console.error("Excepción getProveedores:", err);
    return [];
  }
}

export async function getProveedorContactos(
  proveedorId: number
): Promise<ProveedorContacto[]> {
  try {
    const { data, error } = await supabaseAdmin
      .from("proveedor_contactos")
      .select(
        `
        id,
        proveedor_id,
        nombre,
        celular,
        correo,
        cargo,
        es_principal,
        created_at,
        updated_at
      `
      )
      .eq("proveedor_id", proveedorId)
      .order("id", { ascending: true });

    if (error) {
      console.error("Error getProveedorContactos:", error);
      return [];
    }

    return (data ?? []) as ProveedorContacto[];
  } catch (err) {
    console.error("Excepción getProveedorContactos:", err);
    return [];
  }
}

// -------------------------------------
// Mutaciones
// -------------------------------------

type SaveProveedorPayload = {
  proveedor: ProveedorCreateInput;
  contactos?: ProveedorContactoInput[];
};

export async function createProveedor(
  payload: SaveProveedorPayload
): Promise<Proveedor | null> {
  try {
    const internal_id =
      payload.proveedor.internal_id || (await generarSiguienteCodigoProveedor());

    const { proveedor, contactos } = payload;

    const insertData: ProveedorCreateInput & { internal_id: string } = {
      ...proveedor,
      internal_id,
      nombre_comercial: proveedor.nombre_comercial ?? null,
      direccion: proveedor.direccion ?? null,
      referencia: proveedor.referencia ?? null,
      contacto_correo: proveedor.contacto_correo ?? null,
    };

    const { data, error } = await supabaseAdmin
      .from("proveedores")
      .insert(insertData)
      .select(
        `
        id,
        internal_id,
        razon_social,
        nombre_comercial,
        ruc,
        direccion,
        referencia,
        contacto_nombre,
        contacto_celular,
        contacto_correo,
        total_pedidos,
        total_unidades,
        created_at,
        updated_at
      `
      )
      .single();

    if (error) {
      console.error("Error createProveedor:", error);
      return null;
    }

    const proveedorId = data.id as number;

    // contactos adicionales
    if (contactos && contactos.length > 0) {
      const rows = contactos.map((c) => ({
        proveedor_id: proveedorId,
        nombre: c.nombre,
        celular: c.celular,
        correo: c.correo,
        es_principal: c.es_principal ?? false,
      }));

      const { error: cError } = await supabaseAdmin
        .from("proveedor_contactos")
        .insert(rows);

      if (cError) {
        console.error("Error insert proveedor_contactos:", cError);
      }
    }

    revalidatePath(BASE_PATH);
    return data as Proveedor;
  } catch (err) {
    console.error("Excepción createProveedor:", err);
    return null;
  }
}

type UpdateProveedorPayload = {
  proveedor: ProveedorCreateInput | ProveedorUpdateInput;
  contactos?: ProveedorContactoInput[];
};

export async function updateProveedor(
  id: number,
  payload: UpdateProveedorPayload
): Promise<Proveedor | null> {
  try {
    const { proveedor, contactos } = payload;

    const updateData: Partial<ProveedorUpdateInput> = {
      razon_social: proveedor.razon_social,
      nombre_comercial: proveedor.nombre_comercial ?? null,
      ruc: proveedor.ruc,
      direccion: proveedor.direccion ?? null,
      referencia: proveedor.referencia ?? null,
      contacto_nombre: proveedor.contacto_nombre,
      contacto_celular: proveedor.contacto_celular,
      contacto_correo: proveedor.contacto_correo ?? null,
    };

    const { data, error } = await supabaseAdmin
      .from("proveedores")
      .update(updateData)
      .eq("id", id)
      .select(
        `
        id,
        internal_id,
        razon_social,
        nombre_comercial,
        ruc,
        direccion,
        referencia,
        contacto_nombre,
        contacto_celular,
        contacto_correo,
        total_pedidos,
        total_unidades,
        created_at,
        updated_at
      `
      )
      .single();

    if (error) {
      console.error("Error updateProveedor:", error);
      return null;
    }

    // resetear + volver a insertar contactos adicionales
    if (contactos) {
      const { error: delError } = await supabaseAdmin
        .from("proveedor_contactos")
        .delete()
        .eq("proveedor_id", id);

      if (delError) {
        console.error("Error delete proveedor_contactos:", delError);
      } else if (contactos.length > 0) {
        const rows = contactos.map((c) => ({
          proveedor_id: id,
          nombre: c.nombre,
          celular: c.celular,
          correo: c.correo,
          es_principal: c.es_principal ?? false,
        }));

        const { error: insError } = await supabaseAdmin
          .from("proveedor_contactos")
          .insert(rows);

        if (insError) {
          console.error(
            "Error insert proveedor_contactos (updateProveedor):",
            insError
          );
        }
      }
    }

    revalidatePath(BASE_PATH);
    return data as Proveedor;
  } catch (err) {
    console.error("Excepción updateProveedor:", err);
    return null;
  }
}

export async function deleteProveedor(id: number): Promise<boolean> {
  try {
    const { error } = await supabaseAdmin
      .from("proveedores")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error deleteProveedor:", error);
      return false;
    }

    revalidatePath(BASE_PATH);
    return true;
  } catch (err) {
    console.error("Excepción deleteProveedor:", err);
    return false;
  }
}
