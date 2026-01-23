"use client";

import React, { useMemo, useState } from "react";
import {
  Box,
  Paper,
  Stack,
  Typography,
  TextField,
  Chip,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Button,
  TablePagination,
} from "@mui/material";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";

import { useSearchAndPagination } from "@/modules/dynedu/hooks/useSearchAndPagination";
import type { SalesOverviewRow, PaymentStatus, FulfillmentStatus } from "./actions";

type Props = { initialRows: SalesOverviewRow[] };
type Tab = "ALL" | "PAID" | "PENDING" | "FAILED" | "REFUNDED";

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

function shortId(id: string) {
  return String(id ?? "").replaceAll("-", "").slice(0, 8).toUpperCase();
}

function paymentLabel(s: PaymentStatus | null) {
  if (!s) return "Sin pago";
  if (s === "APPROVED") return "Aprobado";
  if (s === "PENDING") return "Pendiente";
  if (s === "REJECTED") return "Rechazado";
  if (s === "CANCELLED") return "Cancelado";
  if (s === "REFUNDED") return "Reembolso";
  if (s === "CREATED") return "Creado";
  return s;
}

function fulfillmentLabel(s: FulfillmentStatus) {
  if (s === "REGISTERED") return "Registrado";
  if (s === "PACKING") return "Empacando";
  if (s === "DELIVERY") return "En reparto";
  if (s === "DELIVERED") return "Entregado";
  return s;
}

export default function VentasClient({ initialRows }: Props) {
  const [tab, setTab] = useState<Tab>("ALL");

  const counts = useMemo(() => {
    const c = { ALL: initialRows.length, PAID: 0, PENDING: 0, FAILED: 0, REFUNDED: 0 };
    for (const r of initialRows) {
      const p = r.payment_status;
      if (p === "APPROVED") c.PAID += 1;
      if (p === "PENDING" || p === "CREATED") c.PENDING += 1;
      if (p === "REJECTED" || p === "CANCELLED") c.FAILED += 1;
      if (p === "REFUNDED") c.REFUNDED += 1;
    }
    return c;
  }, [initialRows]);

  const { searchTerm, setSearchTerm, page, setPage, rowsPerPage, total, paginatedData } =
    useSearchAndPagination<SalesOverviewRow>({
      data: initialRows ?? [],
      rowsPerPage: 15,
      sortFn: (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      filterFn: (row, qMaybe) => {
        const pay = row.payment_status;

        const passTab =
          tab === "ALL"
            ? true
            : tab === "PAID"
            ? pay === "APPROVED"
            : tab === "PENDING"
            ? pay === "PENDING" || pay === "CREATED"
            : tab === "FAILED"
            ? pay === "REJECTED" || pay === "CANCELLED"
            : tab === "REFUNDED"
            ? pay === "REFUNDED"
            : true;

        if (!passTab) return false;

        const q = String(qMaybe ?? "").toLowerCase().trim();
        if (!q) return true;

        const hay = [
          row.id,
          shortId(row.id),
          row.customer_name,
          row.customer_email,
          row.customer_phone,
          row.shipping_district,
          row.order_status,
          row.fulfillment_status,
          row.payment_status,
          row.payment_id,
          row.preference_id,
          row.merchant_order_id,
          row.items_summary,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return hay.includes(q);
      },
    });

  const onChangeTab = (t: Tab) => {
    setTab(t);
    setPage(0);
  };

  const onChangeSearch = (v: string) => {
    setSearchTerm(v);
    setPage(0);
  };

  return (
    <Box sx={{ p: 2, pt: 1.5 }}>
      <Typography variant="h4" sx={{ mb: 0.5, fontWeight: 700 }}>
        Ventas
      </Typography>
      <Typography variant="body2" sx={{ mb: 2, opacity: 0.75 }}>
        Órdenes web + estado de pago (Mercado Pago) + productos + acceso a entrega.
      </Typography>

      <Paper sx={{ p: 2, borderRadius: 3 }}>
        {/* Toolbar */}
        <Box
          sx={{
            mb: 2,
            px: 1.25,
            py: 1,
            borderRadius: 2,
            border: "1px solid rgba(0,0,0,0.08)",
            background: "rgba(0,0,0,0.02)",
            display: "flex",
            alignItems: "center",
            gap: 1.25,
          }}
        >
          {/* Tabs */}
          <Box
            sx={{
              flex: 1,
              minWidth: 0,
              display: "flex",
              gap: 1,
              overflowX: "auto",
              py: 0.25,
              "&::-webkit-scrollbar": { height: 6 },
            }}
          >
            <Chip
              size="small"
              label={`Todos (${counts.ALL})`}
              variant={tab === "ALL" ? "filled" : "outlined"}
              onClick={() => onChangeTab("ALL")}
            />
            <Chip
              size="small"
              label={`Pagadas (${counts.PAID})`}
              variant={tab === "PAID" ? "filled" : "outlined"}
              onClick={() => onChangeTab("PAID")}
            />
            <Chip
              size="small"
              label={`Pendientes (${counts.PENDING})`}
              variant={tab === "PENDING" ? "filled" : "outlined"}
              onClick={() => onChangeTab("PENDING")}
            />
            <Chip
              size="small"
              label={`Fallidas (${counts.FAILED})`}
              variant={tab === "FAILED" ? "filled" : "outlined"}
              onClick={() => onChangeTab("FAILED")}
            />
            <Chip
              size="small"
              label={`Reembolsos (${counts.REFUNDED})`}
              variant={tab === "REFUNDED" ? "filled" : "outlined"}
              onClick={() => onChangeTab("REFUNDED")}
            />
          </Box>

          {/* Search */}
          <TextField
            size="small"
            label="Buscar"
            placeholder="Orden, cliente, producto, distrito…"
            value={searchTerm}
            onChange={(e) => onChangeSearch(e.target.value)}
            sx={{
              width: { xs: 220, sm: 320, md: 420 },
              flexShrink: 0,
              "& .MuiInputBase-root": {
                borderRadius: 2,
                background: "#fff",
              },
            }}
          />
        </Box>

        {/* Horizontal scroll wrapper */}
        <Box
          sx={{
            overflowX: "auto",
            width: "100%",
            WebkitOverflowScrolling: "touch",
            "&::-webkit-scrollbar": { height: 10 },
          }}
        >
          <Table
            size="small"
            sx={{
              tableLayout: "auto",
              minWidth: 1000, // fuerza overflow para que sí haya barra
              width: "100%",
            }}
          >
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700, width: 110 }}>Orden</TableCell>
                <TableCell sx={{ fontWeight: 700, width: 260 }}>Cliente</TableCell>
                <TableCell sx={{ fontWeight: 700, width: 520 }}>Productos</TableCell>
                <TableCell sx={{ fontWeight: 700, width: 180 }}>Distrito</TableCell>
                <TableCell sx={{ fontWeight: 700, width: 120 }}>Total</TableCell>
                <TableCell sx={{ fontWeight: 700, width: 190 }}>Pago</TableCell>
                <TableCell sx={{ fontWeight: 700, width: 200 }}>Entrega</TableCell>
                <TableCell sx={{ fontWeight: 700, width: 190 }}>Fecha</TableCell>
                <TableCell sx={{ fontWeight: 700, width: 220 }} align="right">
                  Acción
                </TableCell>
              </TableRow>
            </TableHead>

            <TableBody>
              {paginatedData.map((r) => (
                <TableRow key={r.id} hover>
                  <TableCell sx={{ fontWeight: 700 }}>{shortId(r.id)}</TableCell>

                  <TableCell>
                    <div style={{ fontWeight: 600 }}>{r.customer_name ?? "-"}</div>
                    <div style={{ opacity: 0.75, fontSize: 12 }}>{r.customer_email ?? "-"}</div>
                  </TableCell>

                  <TableCell>
                    <div
                      style={{
                        fontWeight: 600,
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical" as any,
                        overflow: "hidden",
                      }}
                      title={r.items_summary ?? ""}
                    >
                      {r.items_summary ?? "—"}
                    </div>
                    <div style={{ opacity: 0.75, fontSize: 12 }}>
                      {typeof r.items_units === "number" ? `${r.items_units} unidad(es)` : ""}
                    </div>
                  </TableCell>

                  <TableCell sx={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {r.shipping_district ?? "-"}
                  </TableCell>

                  <TableCell>
                    {r.currency ?? "PEN"} {Number(r.total ?? 0).toFixed(2)}
                  </TableCell>

                  <TableCell>
                    <div style={{ fontWeight: 700 }}>{paymentLabel(r.payment_status)}</div>
                    <div style={{ opacity: 0.75, fontSize: 12 }}>
                      {r.payment_id ? `MP: ${r.payment_id}` : ""}
                    </div>
                  </TableCell>

                  <TableCell>
                    <div style={{ fontWeight: 700 }}>{fulfillmentLabel(r.fulfillment_status)}</div>
                    <div style={{ opacity: 0.75, fontSize: 12 }}>
                      {r.delivery_date ? `ETA: ${r.delivery_date}` : "ETA: por confirmar"}
                    </div>
                  </TableCell>

                  <TableCell>{formatDateTime(r.created_at)}</TableCell>

                  <TableCell align="right">
                    <Stack direction="row" spacing={1} justifyContent="flex-end" sx={{ whiteSpace: "nowrap" }}>
                      <Button
                        size="small"
                        variant="outlined"
                        endIcon={<OpenInNewIcon />}
                        onClick={() => window.open(`/dynedu/reportes/ventas/${r.id}`)}
                        sx={{ minWidth: 84 }}
                      >
                        Ver
                      </Button>

                      <Button
                        size="small"
                        variant="contained"
                        onClick={() => window.open(`/dynedu/entregas/${r.id}`)}
                        sx={{ minWidth: 92 }}
                      >
                        Entrega
                      </Button>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}

              {total === 0 && (
                <TableRow>
                  <TableCell colSpan={9} sx={{ py: 4, textAlign: "center", opacity: 0.7 }}>
                    No hay ventas para mostrar.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Box>

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
