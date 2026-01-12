"use server";

import { getPortalColegio } from "../actions";

// Reuse the panel action but enforce session -> colegioId match
import { createConsignacionSolicitudAction } from "@/app/(PrgDinamics)/dynedu/(panel)/consignaciones/actions";

export type PortalSolicitudItem = {
  productoId: number;
  cantidad: number;
};

export type PortalSolicitudInput = {
  colegioId: number;
  fechaSalida: string;
  observaciones?: string;
  items: PortalSolicitudItem[];
};

export type PortalSolicitudResult = {
  success: boolean;
  error?: string;
  consignacionId?: number;
  codigo?: string;
};

export async function createPortalConsignacionSolicitudAction(
  input: PortalSolicitudInput
): Promise<PortalSolicitudResult> {
  const colegio = await getPortalColegio();
  if (!colegio) {
    return { success: false, error: "Sesión expirada. Vuelve a ingresar." };
  }

  if (Number(input.colegioId) !== Number(colegio.id)) {
    return { success: false, error: "Sesión inválida para este colegio." };
  }

  const res = await createConsignacionSolicitudAction({
    colegioId: input.colegioId,
    fechaSalida: input.fechaSalida,
    observaciones: input.observaciones,
    items: input.items,
  });

  return res as PortalSolicitudResult;
}
