// src/app/(PrgDinamics)/components/dashboard/IngresosMensuales.tsx
"use client";

import React from "react";
import { Card, CardContent, Typography, Stack, Chip } from "@mui/material";

const IngresosMensuales: React.FC = () => {
  // TODO: reemplazar con datos reales de ventas/facturación
  const data = {
    monthLabel: "Últimos 30 días",
    total: 18500,
    variationPercent: 12.5,
    isUp: true,
  };

  return (
    <Card elevation={0} sx={{ borderRadius: 3, border: "1px solid", borderColor: "divider" }}>
      <CardContent>
        <Typography variant="h6" fontWeight={600} mb={0.5}>
          Ingresos estimados
        </Typography>
        <Typography variant="body2" color="text.secondary" mb={2}>
          Monto aproximado por ventas asociadas a la campaña actual.
        </Typography>

        <Typography variant="caption" color="text.secondary">
          {data.monthLabel}
        </Typography>
        <Typography variant="h4" fontWeight={700}>
          S/ {data.total.toLocaleString("es-PE")}
        </Typography>

        <Stack direction="row" spacing={1} mt={1} alignItems="center">
          <Chip
            size="small"
            label={`${data.isUp ? "+" : ""}${data.variationPercent}%`}
            color={data.isUp ? "success" : "error"}
            variant="outlined"
          />
          <Typography variant="caption" color="text.secondary">
            vs. periodo anterior
          </Typography>
        </Stack>
      </CardContent>
    </Card>
  );
};

export default IngresosMensuales;
