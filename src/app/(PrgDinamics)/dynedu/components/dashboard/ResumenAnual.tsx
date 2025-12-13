// src/app/(PrgDinamics)/components/dashboard/ResumenAnual.tsx
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
} from "@mui/material";

type CampaignRow = {
  year: number;
  totalOrders: number;
  totalBooks: number;
  statusLabel: string;
};

const ResumenAnual: React.FC = () => {
  // TODO: reemplazar con un resumen real por campaña/año
  const campaigns: CampaignRow[] = [
    { year: 2025, totalOrders: 42, totalBooks: 1275, statusLabel: "Activa" },
    { year: 2024, totalOrders: 36, totalBooks: 1103, statusLabel: "Cerrada" },
  ];

  return (
    <Card elevation={0} sx={{ borderRadius: 3, border: "1px solid", borderColor: "divider" }}>
      <CardContent>
        <Typography variant="h6" fontWeight={600} mb={2}>
          Resumen por campaña
        </Typography>
        <Typography variant="body2" color="text.secondary" mb={2}>
          Vista general de pedidos y libros entregados por campaña académica.
        </Typography>

        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Año</TableCell>
              <TableCell>Pedidos</TableCell>
              <TableCell>Libros entregados</TableCell>
              <TableCell>Estado</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {campaigns.map((c) => (
              <TableRow key={c.year} hover>
                <TableCell>{c.year}</TableCell>
                <TableCell>{c.totalOrders}</TableCell>
                <TableCell>{c.totalBooks.toLocaleString("es-PE")}</TableCell>
                <TableCell>{c.statusLabel}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};

export default ResumenAnual;
