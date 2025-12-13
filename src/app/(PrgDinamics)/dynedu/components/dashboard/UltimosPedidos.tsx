// src/app/(PrgDinamics)/components/dashboard/UltimosPedidos.tsx
"use client";

import React from "react";
import {
  Card,
  CardContent,
  Typography,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Chip,
} from "@mui/material";

type OrderRow = {
  code: string;
  school: string;
  date: string;
  status: "BORRADOR" | "EN PROCESO" | "PARCIAL" | "COMPLETO";
};

const UltimosPedidos: React.FC = () => {
  // TODO: leer los últimos pedidos reales desde Supabase
  const rows: OrderRow[] = [
    {
      code: "PED0025",
      school: "Colegio Genes",
      date: "29/11/2025",
      status: "COMPLETO",
    },
    {
      code: "PED0024",
      school: "Pitágoras Consorcio",
      date: "28/11/2025",
      status: "EN PROCESO",
    },
    {
      code: "PED0023",
      school: "Little Ones",
      date: "27/11/2025",
      status: "PARCIAL",
    },
  ];

  const getStatusChip = (status: OrderRow["status"]) => {
    switch (status) {
      case "COMPLETO":
        return <Chip size="small" label="Completo" color="success" />;
      case "EN PROCESO":
        return <Chip size="small" label="En proceso" color="primary" />;
      case "PARCIAL":
        return <Chip size="small" label="Parcial" color="warning" />;
      default:
        return <Chip size="small" label="Borrador" />;
    }
  };

  return (
    <Card elevation={0} sx={{ borderRadius: 3, border: "1px solid", borderColor: "divider" }}>
      <CardContent>
        <Typography variant="h6" fontWeight={600} mb={2}>
          Últimos pedidos
        </Typography>

        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Código</TableCell>
              <TableCell>Colegio</TableCell>
              <TableCell>Fecha</TableCell>
              <TableCell>Estado</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.code} hover>
                <TableCell>{row.code}</TableCell>
                <TableCell>{row.school}</TableCell>
                <TableCell>{row.date}</TableCell>
                <TableCell>{getStatusChip(row.status)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};

export default UltimosPedidos;
