// src/app/(PrgDinamics)/components/dashboard/RendimientoLibros.tsx
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
  LinearProgress,
  Box,
} from "@mui/material";

const RendimientoLibros: React.FC = () => {
  // TODO: traer top libros desde Supabase (por cantidad pedida/entregada)
  const items = [
    { code: "MAT-5", name: "Matemática 5° Primaria", percent: 82 },
    { code: "COM-4", name: "Comunicación 4° Primaria", percent: 68 },
    { code: "ARIT-3", name: "Aritmética 3° Secundaria", percent: 55 },
    { code: "CIEN-2", name: "Ciencias 2° Primaria", percent: 41 },
  ];

  return (
    <Card elevation={0} sx={{ borderRadius: 3, border: "1px solid", borderColor: "divider" }}>
      <CardContent>
        <Typography variant="h6" fontWeight={600} mb={2}>
          Rendimiento de libros
        </Typography>

        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Código</TableCell>
              <TableCell>Libro</TableCell>
              <TableCell align="right">Participación</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.code} hover>
                <TableCell>{item.code}</TableCell>
                <TableCell>{item.name}</TableCell>
                <TableCell align="right" sx={{ width: 180 }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <Box sx={{ flex: 1 }}>
                      <LinearProgress
                        variant="determinate"
                        value={item.percent}
                        sx={{ height: 6, borderRadius: 999 }}
                      />
                    </Box>
                    <Typography variant="caption" sx={{ minWidth: 32 }}>
                      {item.percent}%
                    </Typography>
                  </Box>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};

export default RendimientoLibros;
