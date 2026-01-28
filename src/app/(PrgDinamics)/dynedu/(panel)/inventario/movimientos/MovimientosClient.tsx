"use client";

import React, { useMemo, useState } from "react";
import {
  Box,
  Button,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import { useRouter } from "next/navigation";

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

type Tab = "ALL" | InventoryMovementType;

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
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("ALL");

  const counts = useMemo(() => {
    const base: Record<Tab, number> = {
      ALL: initialRows.length,
      WEB_RESERVE: 0,
      WEB_SALE: 0,
      CONSIGNACION_SALIDA: 0,
    };
    for (const r of initialRows ?? []) base[r.movement_type] += 1;
    return base;
  }, [initialRows]);

  // ✅ Igual que consignaciones: primero filtrar por tab
  const filteredByTab = useMemo(() => {
    if (tab === "ALL") return initialRows ?? [];
    return (initialRows ?? []).filter((r) => r.movement_type === tab);
  }, [initialRows, tab]);

  const {
    searchTerm,
    setSearchTerm,
    page,
    setPage,
    rowsPerPage,
    filteredData,
    paginatedData,
  } = useSearchAndPagination<InventoryMovementRow>({
    data: filteredByTab,
    rowsPerPage: 10,
    sortFn: (a, b) => {
      const da = a.happened_at ? new Date(a.happened_at).getTime() : 0;
      const db = b.happened_at ? new Date(b.happened_at).getTime() : 0;
      return db - da; // newest first
    },
    filterFn: (row, qLower) => {
      const q = String(qLower ?? "").toLowerCase().trim();
      if (!q) return true;

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

      return hay.includes(q);
    },
  });

  const total = filteredData.length;
  const totalPages = Math.max(1, Math.ceil(total / rowsPerPage));

  return (
    <Box sx={{ p: 2, pt: 1.5 }}>
      <Typography variant="h4" sx={{ mb: 0.5, fontWeight: 700 }}>
        Movimientos
      </Typography>
      <Typography variant="body2" sx={{ mb: 2, opacity: 0.75 }}>
        Salidas por venta web, reservas y consignaciones.
      </Typography>

      {/* ✅ Tabs estilo consignaciones (botones arriba) */}
      <Stack direction="row" spacing={1} mb={2} flexWrap="wrap">
        <Button
          variant={tab === "ALL" ? "contained" : "outlined"}
          onClick={() => {
            setTab("ALL");
            setPage(0);
          }}
        >
          Todos ({counts.ALL})
        </Button>

        <Button
          variant={tab === "WEB_SALE" ? "contained" : "outlined"}
          onClick={() => {
            setTab("WEB_SALE");
            setPage(0);
          }}
        >
          {TYPE_LABEL.WEB_SALE} ({counts.WEB_SALE})
        </Button>

        <Button
          variant={tab === "WEB_RESERVE" ? "contained" : "outlined"}
          onClick={() => {
            setTab("WEB_RESERVE");
            setPage(0);
          }}
        >
          {TYPE_LABEL.WEB_RESERVE} ({counts.WEB_RESERVE})
        </Button>

        <Button
          variant={tab === "CONSIGNACION_SALIDA" ? "contained" : "outlined"}
          onClick={() => {
            setTab("CONSIGNACION_SALIDA");
            setPage(0);
          }}
        >
          {TYPE_LABEL.CONSIGNACION_SALIDA} ({counts.CONSIGNACION_SALIDA})
        </Button>
      </Stack>

      <Paper sx={{ p: 2, borderRadius: 3 }}>
        {/* Header count + search (igual consignaciones) */}
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={2}
          justifyContent="space-between"
          alignItems={{ xs: "stretch", md: "center" }}
          mb={2}
        >
          <Typography variant="body2" color="text.secondary">
            {total} movimiento(s)
          </Typography>

          <TextField
            size="small"
            label="Buscar"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPage(0);
            }}
            sx={{ width: { xs: "100%", sm: 360 } }}
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
                Acciones
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
                      title={r.product_name ?? ""}
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
                      onClick={() => router.push(link)} // ✅ misma pestaña
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

        {/* ✅ Paginación estilo consignaciones */}
        {total > rowsPerPage ? (
          <Box mt={2} display="flex" justifyContent="flex-end" alignItems="center" gap={1}>
            <Typography variant="caption" color="text.secondary">
              Página {page + 1} de {totalPages}
            </Typography>

            <Button
              size="small"
              variant="outlined"
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              Anterior
            </Button>

            <Button
              size="small"
              variant="outlined"
              disabled={page + 1 >= totalPages}
              onClick={() => setPage((p) => (p + 1 < totalPages ? p + 1 : p))}
            >
              Siguiente
            </Button>
          </Box>
        ) : null}
      </Paper>
    </Box>
  );
}
