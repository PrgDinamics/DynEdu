import React from "react";

import { Box, Typography } from "@mui/material";

import DashboardClient from "./DashboardClient";
import { getDashboardData } from "./actions";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const initialData = await getDashboardData({ mode: "closed" });

  return (
    <Box>
      <Typography variant="h4" fontWeight={600} mb={0.5}>
        Resumen
      </Typography>
      <Typography variant="body2" color="text.secondary" mb={3}>
        Ventas estimadas (por consignaciones) + operación e inventario.
      </Typography>

      <DashboardClient initialData={initialData} />
    </Box>
  );
}
