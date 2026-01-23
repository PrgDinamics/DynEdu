"use client";

import React, { useMemo, useState } from "react";
import {
  Box,
  Chip,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
  Button,
  TablePagination,
} from "@mui/material";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";

import { useSearchAndPagination } from "@/modules/dynedu/hooks/useSearchAndPagination";
import type { InventoryMovementRow, InventoryMovementType } from "./actions";

type Props = {
  initialRows: InventoryMovementRow[];
};

const TYPE_LABEL: Record<InventoryMovementType, string> = {
  WEB_RESERVE: "Reserva web",
  WEB_SALE: "Venta web",
  CONSIGNACION_SALIDA: "Consignación (salida)",
};

function formatDateTime(value: string | null) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("es-PE", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function MovimientosClient({ initialRows }: Props) {
  const [activeType, setActiveType] = useState<InventoryMovementType | "ALL">("ALL");

  const counts = useMemo(() => {
    const base = {
      ALL: initialRows.length,
      WEB_RESERVE: 0,
      WEB_SALE: 0,
      CONSIGNACION_SALIDA: 0,
    };
    for (const r of initialRows) base[r.movement_type] += 1;
    return base;
  }, [initialRows]);

  const {
    searchTerm,
    setSearchTerm,
    page,
    setPage,
    rowsPerPage,
    total,
    paginatedData,
  } = useSearchAndPagination<InventoryMovementRow>({
    data: initialRows ?? [],
    rowsPerPage: 15,
    sortFn: (a, b) => {
      const da = a.happened_at ? new Date(a.happened_at).getTime() : 0;
      const db = b.happened_at ? new Date(b.happened_at).getTime() : 0;
      return db - da; // newest first
    },
    filterFn: (row, qLower) => {
      const passType = activeType === "ALL" ? true : row.movement_type === activeType;
      if (!passType) return false;

      if (!qLower.trim()) return true;

      const hay = [
        row.product_code,
        row.product_name,
        row.counterparty,
        row.district,
        row.source_id,
        row.movement_type,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return hay.includes(qLower);
    },
  });

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" sx={{ mb: 0.5, fontWeight: 700 }}>
        Movimientos
      </Typography>
      <Typography variant="body2" sx={{ mb: 2, opacity: 0.75 }}>
        Salidas por venta web, reservas y consignaciones.
      </Typography>

      <Paper sx={{ p: 2, borderRadius: 3 }}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1.2}
          alignItems={{ xs: "stretch", sm: "center" }}
          justifyContent="space-between"
          sx={{ mb: 2 }}
        >
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Chip
              label={`Todos (${counts.ALL})`}
              variant={activeType === "ALL" ? "filled" : "outlined"}
              onClick={() => setActiveType("ALL")}
              sx={{ mb: 0.5 }}
            />
            <Chip
              label={`${TYPE_LABEL.WEB_SALE} (${counts.WEB_SALE})`}
              variant={activeType === "WEB_SALE" ? "filled" : "outlined"}
              onClick={() => setActiveType("WEB_SALE")}
              sx={{ mb: 0.5 }}
            />
            <Chip
              label={`${TYPE_LABEL.WEB_RESERVE} (${counts.WEB_RESERVE})`}
              variant={activeType === "WEB_RESERVE" ? "filled" : "outlined"}
              onClick={() => setActiveType("WEB_RESERVE")}
              sx={{ mb: 0.5 }}
            />
            <Chip
              label={`${TYPE_LABEL.CONSIGNACION_SALIDA} (${counts.CONSIGNACION_SALIDA})`}
              variant={activeType === "CONSIGNACION_SALIDA" ? "filled" : "outlined"}
              onClick={() => setActiveType("CONSIGNACION_SALIDA")}
              sx={{ mb: 0.5 }}
            />
          </Stack>

          <TextField
            size="small"
            label="Buscar"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            sx={{ width: { xs: "100%", sm: 320 } }}
          />
        </Stack>

        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 700 }}>Fecha</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Tipo</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Código</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Producto</TableCell>
              <TableCell sx={{ fontWeight: 700 }} align="right">
                Cant.
              </TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Cliente/Colegio</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Distrito</TableCell>
              <TableCell sx={{ fontWeight: 700 }} align="right">
                Acción
              </TableCell>
            </TableRow>
          </TableHead>

          <TableBody>
            {paginatedData.map((r) => {
              const qtyLabel = r.qty > 0 ? `+${r.qty}` : `${r.qty}`;
              const qtyColor =
                r.movement_type === "WEB_RESERVE"
                  ? "text.secondary"
                  : r.qty < 0
                  ? "error.main"
                  : "success.main";

              const link =
                r.movement_type === "CONSIGNACION_SALIDA"
                  ? `/dynedu/consignaciones/${r.source_id}`
                  : `/dynedu/entregas/${r.source_id}`;

              return (
                <TableRow key={r.movement_id} hover>
                  <TableCell>{formatDateTime(r.happened_at)}</TableCell>
                  <TableCell>{TYPE_LABEL[r.movement_type]}</TableCell>
                  <TableCell>{r.product_code ?? "-"}</TableCell>
                  <TableCell sx={{ maxWidth: 420 }}>
                    <span
                      style={{
                        display: "inline-block",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        maxWidth: 420,
                      }}
                    >
                      {r.product_name ?? "-"}
                    </span>
                  </TableCell>
                  <TableCell align="right" sx={{ color: qtyColor, fontWeight: 700 }}>
                    {qtyLabel}
                  </TableCell>
                  <TableCell>{r.counterparty ?? "-"}</TableCell>
                  <TableCell>{r.district ?? "-"}</TableCell>
                  <TableCell align="right">
                    <Button
                      size="small"
                      variant="outlined"
                      endIcon={<OpenInNewIcon />}
                      onClick={() => window.open(link, "_blank")}
                    >
                      Ver
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}

            {total === 0 && (
              <TableRow>
                <TableCell colSpan={8} sx={{ py: 4, textAlign: "center", opacity: 0.7 }}>
                  No hay movimientos para mostrar.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        {total > rowsPerPage && (
          <TablePagination
            component="div"
            count={total}
            page={page}
            onPageChange={(_, newPage) => setPage(newPage)}
            rowsPerPage={rowsPerPage}
            rowsPerPageOptions={[rowsPerPage]}
            labelRowsPerPage="Filas por página"
            labelDisplayedRows={({ from, to, count }) => `${from}-${to} de ${count}`}
            sx={{ mt: 1 }}
          />
        )}
      </Paper>
    </Box>
  );
}
