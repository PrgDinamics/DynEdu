// src/app/(PrgDinamics)/dynedu/page.tsx

export const dynamic = "force-dynamic";

import { Box, Stack, Typography } from "@mui/material";

import ResumenCampania from "@/app/(PrgDinamics)/dynedu/components/dashboard/ResumenCampania";
import IngresosMensuales from "@/app/(PrgDinamics)/dynedu/components/dashboard/IngresosMensuales";
import RendimientoLibros from "@/app/(PrgDinamics)/dynedu/components/dashboard/RendimientoLibros";
import UltimosPedidos from "@/app/(PrgDinamics)/dynedu/components/dashboard/UltimosPedidos";
import ResumenAnual from "@/app/(PrgDinamics)/dynedu/components/dashboard/ResumenAnual";
import PedidosPorEstadoChart from "@/app/(PrgDinamics)/dynedu/components/dashboard/PedidosPorEstadoChart";
import DistribucionColegiosChart from "@/app/(PrgDinamics)/dynedu/components/dashboard/DistribucionColegiosChart";
import YearFilterBar from "@/app/(PrgDinamics)/dynedu/components/dashboard/YearFilterBar";


import { getGeneralSettings } from "@/app/(PrgDinamics)/dynedu/settings/general/actions";
import type { GeneralSettingsCampaignStatus } from "@/modules/settings/types";

type SearchParams = {
  [key: string]: string | string[] | undefined;
};

function getCampaignStatusLabel(status: GeneralSettingsCampaignStatus): string {
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

export default async function DynEduDashboardPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const settings = await getGeneralSettings();
  // justo después de obtener settings y campaign:

const campaign = settings.campaign;
const baseYear = campaign?.year ?? new Date().getFullYear();

// -------------------------
// leer year desde searchParams
// -------------------------
let selectedYear = baseYear;

if (searchParams && "year" in searchParams) {
  const raw = (searchParams as any).year as
    | string
    | string[]
    | undefined;

  let parsed: number | null = null;

  if (typeof raw === "string") {
    parsed = Number(raw);
  } else if (Array.isArray(raw) && raw.length > 0) {
    parsed = Number(raw[0]);
  }

  if (parsed !== null && Number.isFinite(parsed)) {
    selectedYear = parsed;
  }
}



  // de momento generamos años +/- 1; luego podemos leerlos desde pedidos reales
  const availableYears = [baseYear - 1, baseYear, baseYear + 1];

  const statusLabel = campaign
    ? getCampaignStatusLabel(campaign.status)
    : "Sin estado";

  return (
    <Box
      sx={{
        p: 2,
        display: "flex",
        flexDirection: "column",
        gap: 3,
      }}
    >
      {/* Encabezado de campaña académica */}
      <Box
        sx={{
          display: "flex",
          flexDirection: { xs: "column", md: "row" },
          justifyContent: "space-between",
          alignItems: { xs: "flex-start", md: "center" },
          gap: 2,
        }}
      >
        <Box>
          <Typography variant="h4" fontWeight={700} gutterBottom>
            Campaña Académica {selectedYear}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Estado de la campaña actual: <strong>{statusLabel}</strong>
          </Typography>
        </Box>

        {/* Filtro de año (afecta todo el dashboard) */}
        <YearFilterBar
          selectedYear={selectedYear}
          availableYears={availableYears}
          baseYear={baseYear}
        />
      </Box>

      {/* Fila 1: resumen general de campaña */}
        

      {/* Fila 2: ingresos mensuales + rendimiento de libros */}
      <Stack
        direction={{ xs: "column", lg: "row" }}
        spacing={2}
        sx={{ width: "100%" }}
      >
        <Box sx={{ flex: 2 }}>
          {/* luego podemos pasar selectedYear como prop también */}
          <IngresosMensuales />
        </Box>
        <Box sx={{ flex: 1 }}>
          <RendimientoLibros />
        </Box>
      </Stack>

      {/* Fila 3: últimos pedidos + gráficos de pedidos/colegios */}
      <Stack
        direction={{ xs: "column", xl: "row" }}
        spacing={2}
        sx={{ width: "100%" }}
      >
        <Box sx={{ flex: 1 }}>
          <UltimosPedidos />
        </Box>

        <Box sx={{ flex: 1 }}>
          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={2}
            sx={{ height: "100%" }}
          >
            <Box sx={{ flex: 1 }}>
              <PedidosPorEstadoChart />
            </Box>
            <Box sx={{ flex: 1 }}>
              <DistribucionColegiosChart />
            </Box>
          </Stack>
        </Box>
      </Stack>

      {/* Fila 4: resumen anual por campaña/año */}
      <Box sx={{ width: "100%" }}>
        <ResumenAnual />
      </Box>
    </Box>
  );
}
