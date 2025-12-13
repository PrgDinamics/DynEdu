// src/app/(PrgDinamics)/colegio/components/UltimoEventoChip.tsx
"use client";

import { Chip } from "@mui/material";
import { formatDateTime } from "@/lib/dynedu/formatters";

type Props = {
  ultimoEvento: string | null;
  fecha: string | null;
};

export function UltimoEventoChip({ ultimoEvento, fecha }: Props) {
  return (
    <Chip
      size="small"
      label={`Último: ${ultimoEvento ?? "CREADO"} — ${formatDateTime(fecha)}`}
    />
  );
}
