"use client";

import { useMemo } from "react";
import {
  Box,
  Card,
  CardContent,
  CardHeader,
  Divider,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
  TablePagination,
  Chip,
} from "@mui/material";

import { useSearchAndPagination } from "@/modules/dynedu/hooks/useSearchAndPagination";
import { formatDateTime } from "@/lib/dynedu/formatters";
import type { StockRow } from "./actions";

type StockClientProps = {
  initialStock: StockRow[];
};

export default function StockClient({ initialStock }: StockClientProps) {
  const rows = initialStock ?? [];

  const {
    searchTerm,
    setSearchTerm,
    page,
    setPage,
    rowsPerPage,
    filteredData,
    paginatedData,
  } = useSearchAndPagination<StockRow>({
    data: rows,
    rowsPerPage: 10,
    sortFn: (a, b) => {
      const prodA = a.productos;
      const prodB = b.productos;

      const codeA = prodA?.internal_id ?? "";
      const codeB = prodB?.internal_id ?? "";

      if (codeA && codeB && codeA !== codeB) {
        return codeA.localeCompare(codeB, "es");
      }
      return a.id - b.id;
    },
    filterFn: (row, q) => {
      const prod = row.productos;

      const code = prod?.internal_id ?? "";
      const desc = prod?.descripcion ?? "";
      const editorial = prod?.editorial ?? "";
      const updatedBy = row.updated_by ?? "";

      return (
        code.toLowerCase().includes(q) ||
        desc.toLowerCase().includes(q) ||
        editorial.toLowerCase().includes(q) ||
        updatedBy.toLowerCase().includes(q)
      );
    },
  });

  const total = filteredData.length;

  const rowsWithDisponible = useMemo(
    () =>
      paginatedData.map((r) => ({
        ...r,
        stock_disponible:
          (r.stock_fisico ?? 0) -
          (r.stock_reservado ?? 0) -
          (r.stock_consignado ?? 0),
      })),
    [paginatedData]
  );

  return (
    <Box>
      <Typography variant="h4" fontWeight={600} mb={0.5}>
        Stock
      </Typography>
      <Typography variant="body2" color="text.secondary" mb={3}>
        Stock físico, reservado (checkout web) y consignado (consignaciones abiertas).
      </Typography>

      <Card
        elevation={0}
        sx={{
          borderRadius: 3,
          border: "1px solid",
          borderColor: "divider",
        }}
      >
        <CardHeader
          title="Stock actual por producto"
          subheader="Incluye stock físico, reservado, consignado y disponible."
        />
        <CardContent>
          <Divider sx={{ mb: 2 }} />

          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={2}
            mb={2}
            justifyContent="space-between"
            alignItems={{ xs: "stretch", md: "center" }}
          >
            <Typography variant="body2" color="text.secondary">
              {total} producto(s) en stock
            </Typography>

            <TextField
              size="small"
              label="Buscar"
              placeholder="Código, descripción, editorial, usuario..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              sx={{ maxWidth: 360 }}
            />
          </Stack>

          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Código</TableCell>
                <TableCell>Descripción</TableCell>
                <TableCell>Editorial</TableCell>
                <TableCell align="right">Stock físico</TableCell>
                <TableCell align="right">Reservado</TableCell>
                <TableCell align="right">Consignado</TableCell>
                <TableCell align="right">Disponible</TableCell>
                <TableCell>Última actualización</TableCell>
                <TableCell>Actualizado por</TableCell>
              </TableRow>
            </TableHead>

            <TableBody>
              {rowsWithDisponible.map((row) => {
                const prod = row.productos;
                const disponible = (row as any).stock_disponible ?? 0;

                const hasNegative =
                  (row.stock_fisico ?? 0) < 0 ||
                  (row.stock_consignado ?? 0) < 0 ||
                  disponible < 0;

                return (
                  <TableRow key={row.id} hover>
                    <TableCell sx={{ fontWeight: 600 }}>
                      {prod?.internal_id ?? `ID ${row.producto_id}`}
                    </TableCell>

                    <TableCell>{prod?.descripcion ?? "—"}</TableCell>
                    <TableCell>{prod?.editorial ?? "—"}</TableCell>

                    <TableCell align="right">{row.stock_fisico ?? 0}</TableCell>
                    <TableCell align="right">{row.stock_reservado ?? 0}</TableCell>
                    <TableCell align="right">{row.stock_consignado ?? 0}</TableCell>

                    <TableCell align="right">
                      {hasNegative ? (
                        <Chip
                          size="small"
                          color="error"
                          label={disponible}
                          sx={{ fontWeight: 800 }}
                        />
                      ) : (
                        disponible
                      )}
                    </TableCell>

                    <TableCell>{formatDateTime(row.updated_at)}</TableCell>
                    <TableCell>{row.updated_by ?? "—"}</TableCell>
                  </TableRow>
                );
              })}

              {total === 0 && (
                <TableRow>
                  <TableCell colSpan={9} align="center">
                    <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                      No hay registros de stock aún.
                    </Typography>
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
              labelDisplayedRows={({ from, to, count }) =>
                `${from}-${to} de ${count !== -1 ? count : `más de ${to}`}`
              }
            />
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
