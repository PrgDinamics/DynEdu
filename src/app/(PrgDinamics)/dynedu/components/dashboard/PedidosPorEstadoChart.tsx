// src/app/(PrgDinamics)/components/dashboard/PedidosPorEstadoChart.tsx
"use client";

import React from "react";
import { Card, CardContent, Typography } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import dynamic from "next/dynamic";

const Chart = dynamic<any>(() => import("react-apexcharts"), { ssr: false });

const PedidosPorEstadoChart: React.FC = () => {
  const theme = useTheme();

  // TODO: reemplazar por datos reales desde Supabase
  const categories = ["Borrador", "En proceso", "Parcial", "Completo"];
  const series = [
    {
      name: "Pedidos",
      data: [4, 8, 5, 25],
    },
  ];

  const options = {
    chart: {
      toolbar: { show: false },
      zoom: { enabled: false },
      foreColor: theme.palette.text.secondary,
    },
    xaxis: {
      categories,
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    yaxis: {
      labels: {
        formatter: (val: number) => Math.round(val).toString(),
      },
    },
    dataLabels: { enabled: false },
    plotOptions: {
      bar: {
        borderRadius: 4,
        columnWidth: "45%",
      },
    },
    colors: [theme.palette.primary.main],
    grid: {
      borderColor: theme.palette.divider,
    },
    tooltip: {
      y: {
        formatter: (val: number) => `${val} pedidos`,
      },
    },
  };

  return (
    <Card
      elevation={0}
      sx={{ borderRadius: 3, border: "1px solid", borderColor: "divider" }}
    >
      <CardContent>
        <Typography variant="h6" fontWeight={600} mb={2}>
          Pedidos por estado
        </Typography>
        <Chart options={options} series={series} type="bar" height={280} />
      </CardContent>
    </Card>
  );
};

export default PedidosPorEstadoChart;
