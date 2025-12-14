// src/app/(PrgDinamics)/colegio/components/PedidoStatusChip.tsx
"use client";

import { Chip } from "@mui/material";
import { getPedidoStatusColor } from "@/lib/dynedu/formatters";

type Props = {
  estado: string;
};

export function PedidoStatusChip({ estado }: Props) {
  return (
    <Chip
      size="small"
      color={getPedidoStatusColor(estado) as any}
      label={`Estado: ${estado}`}
    />
  );
}
