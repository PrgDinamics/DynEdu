// src/app/(PrgDinamics)/dynedu/components/dashboard/ResumenCampania.tsx
"use client";

import React from "react";
import {
  Card,
  CardContent,
  Typography,
  Stack,
  Box,
  Divider,
} from "@mui/material";
import type {
  GeneralSettingsCampaign,
  GeneralSettingsCampaignStatus,
} from "@/modules/settings/types";

type ResumenCampaniaProps = {
  campaign: GeneralSettingsCampaign | null;
};

function getStatusLabel(
  status: GeneralSettingsCampaignStatus | undefined
): string {
  if (!status) return "Sin estado";
  switch (status) {
    case "planning":
      return "En planificación";
    case "active":
      return "Activa";
    case "closed":
      return "Cerrada";
    default:
      return "Sin estado";
  }
}

const ResumenCampania: React.FC<ResumenCampaniaProps> = ({ campaign }) => {
  const year = campaign?.year ?? new Date().getFullYear();
  const statusLabel = getStatusLabel(campaign?.status);

  // TODO: conectar a Supabase para traer métricas reales.
  // Por ahora dejamos todo en 0 para no usar mocks duros.
  const metrics = {
    totalSchools: 0,
    totalOrders: 0,
    totalAmount: 0,
    deliveredOrders: 0,
    pendingOrders: 0,
    deliveredConsignments: 0,
    pendingConsignments: 0,
  };

  return (
    <Card sx={{ borderRadius: 3 }}>
      <CardContent>
        <Stack direction={{ xs: "column", md: "row" }} spacing={3}>
          {/* Columna izquierda: info campaña */}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="overline" color="text.secondary">
              Resumen de campaña
            </Typography>
            <Typography variant="h5" fontWeight={700} mt={0.5}>
              Campaña académica {year}
            </Typography>
            <Stack direction="row" spacing={1.5} alignItems="center" mt={1}>
              <Box
                sx={{
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  bgcolor:
                    statusLabel === "Activa"
                      ? "success.main"
                      : statusLabel === "En planificación"
                      ? "warning.main"
                      : "text.disabled",
                }}
              />
              <Typography variant="subtitle1" fontWeight={600}>
                {statusLabel}
              </Typography>
            </Stack>
            {campaign?.startDate && campaign?.endDate && (
              <Typography variant="body2" color="text.secondary" mt={1}>
                {campaign.startDate} &mdash; {campaign.endDate}
              </Typography>
            )}
          </Box>

          <Divider
            orientation="vertical"
            flexItem
            sx={{ display: { xs: "none", md: "block" } }}
          />

          {/* Columna derecha: métricas principales */}
          <Box sx={{ flex: 2 }}>
            <Stack
              direction={{ xs: "column", md: "row" }}
              spacing={3}
              sx={{ width: "100%" }}
            >
              <Box sx={{ flex: 1 }}>
                <Typography variant="subtitle2" color="text.secondary">
                  Colegios activos
                </Typography>
                <Typography variant="h5" fontWeight={700} mt={0.5}>
                  {metrics.totalSchools}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Colegios con pedidos o consignaciones en esta campaña.
                </Typography>
              </Box>

              <Box sx={{ flex: 1 }}>
                <Typography variant="subtitle2" color="text.secondary">
                  Pedidos generados
                </Typography>
                <Typography variant="h5" fontWeight={700} mt={0.5}>
                  {metrics.totalOrders}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Total de pedidos registrados para el año {year}.
                </Typography>
              </Box>

              <Box sx={{ flex: 1 }}>
                <Typography variant="subtitle2" color="text.secondary">
                  Monto total (S/)
                </Typography>
                <Typography variant="h5" fontWeight={700} mt={0.5}>
                  {metrics.totalAmount.toLocaleString("es-PE", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Suma de todos los pedidos confirmados.
                </Typography>
              </Box>
            </Stack>

            <Divider sx={{ my: 2 }} />

            <Stack
              direction={{ xs: "column", md: "row" }}
              spacing={3}
              sx={{ width: "100%" }}
            >
              <Box sx={{ flex: 1 }}>
                <Typography variant="subtitle2" color="text.secondary">
                  Pedidos entregados
                </Typography>
                <Typography
                  variant="h5"
                  fontWeight={700}
                  color="success.main"
                  mt={0.5}
                >
                  {metrics.deliveredOrders}
                </Typography>
              </Box>

              <Box sx={{ flex: 1 }}>
                <Typography variant="subtitle2" color="text.secondary">
                  Pedidos pendientes
                </Typography>
                <Typography
                  variant="h5"
                  fontWeight={700}
                  color="warning.main"
                  mt={0.5}
                >
                  {metrics.pendingOrders}
                </Typography>
              </Box>

              <Box sx={{ flex: 1 }}>
                <Typography variant="subtitle2" color="text.secondary">
                  Consignaciones entregadas
                </Typography>
                <Typography
                  variant="h5"
                  fontWeight={700}
                  color="success.main"
                  mt={0.5}
                >
                  {metrics.deliveredConsignments}
                </Typography>
              </Box>

              <Box sx={{ flex: 1 }}>
                <Typography variant="subtitle2" color="text.secondary">
                  Consignaciones pendientes
                </Typography>
                <Typography
                  variant="h5"
                  fontWeight={700}
                  color="warning.main"
                  mt={0.5}
                >
                  {metrics.pendingConsignments}
                </Typography>
              </Box>
            </Stack>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
};

export default ResumenCampania;
