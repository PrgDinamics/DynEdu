// src/app/(PrgDinamics)/components/dashboard/DistribucionColegiosChart.tsx
"use client";

import React from "react";
import { Card, CardContent, Typography, Stack, Box } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import dynamic from "next/dynamic";

const Chart = dynamic<any>(() => import("react-apexcharts"), { ssr: false });

const DistribucionColegiosChart: React.FC = () => {
  const theme = useTheme();

  // TODO: reemplazar por top colegios reales (por pedidos o libros)
  const labels = ["Colegio Genes", "Pitágoras", "Little Ones", "Bonifaz"];
  const series = [35, 25, 20, 20];

  const options = {
    chart: {
      toolbar: { show: false },
      foreColor: theme.palette.text.secondary,
    },
    labels,
    legend: {
      position: "right" as const,
      markers: {
        width: 10,
        height: 10,
        radius: 999,
      },
    },
    dataLabels: { enabled: false },
    stroke: { width: 1, colors: [theme.palette.background.paper] },
    colors: [
      theme.palette.primary.main,
      theme.palette.secondary.main,
      theme.palette.success.main,
      theme.palette.warning.main,
    ],
    tooltip: {
      y: {
        formatter: (val: number) => `${val}%`,
      },
    },
  };

  return (
    <Card
      elevation={0}
      sx={{ borderRadius: 3, border: "1px solid", borderColor: "divider" }}
    >
      <CardContent>
        <Typography variant="h6" fontWeight={600} mb={1}>
          Participación por colegio
        </Typography>
        <Typography variant="body2" color="text.secondary" mb={2}>
          Distribución aproximada de pedidos por colegio en la campaña actual.
        </Typography>

        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={2}
          alignItems="center"
        >
          <Box sx={{ flex: 1, minWidth: 240 }}>
            <Chart options={options} series={series} type="donut" height={260} />
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
};

export default DistribucionColegiosChart;
