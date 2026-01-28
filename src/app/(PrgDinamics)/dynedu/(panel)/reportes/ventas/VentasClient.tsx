"use client";

import React, { useMemo, useState } from "react";
import {
  Box,
  Button,
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
} from "@mui/material";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import { useRouter } from "next/navigation";

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

function paymentChipColor(s: PaymentStatus | null): "default" | "success" | "warning" | "error" | "info" {
  if (!s) return "default";
  if (s === "APPROVED") return "success";
  if (s === "PENDING" || s === "CREATED") return "warning";
  if (s === "REJECTED" || s === "CANCELLED") return "error";
  if (s === "REFUNDED") return "info";
  return "default";
}

function fulfillmentLabel(s: FulfillmentStatus) {
  if (s === "REGISTERED") return "Registrado";
  if (s === "PACKING") return "Empacando";
  if (s === "DELIVERY") return "En reparto";
  if (s === "DELIVERED") return "Entregado";
  return s;
}

function matchesTab(row: SalesOverviewRow, tab: Tab) {
  const pay = row.payment_status;
  if (tab === "ALL") return true;
  if (tab === "PAID") return pay === "APPROVED";
  if (tab === "PENDING") return pay === "PENDING" || pay === "CREATED";
  if (tab === "FAILED") return pay === "REJECTED" || pay === "CANCELLED";
  if (tab === "REFUNDED") return pay === "REFUNDED";
  return true;
}

export default function VentasClient({ initialRows }: Props) {
  const router = useRouter();
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

  // ✅ IMPORTANTE: primero filtrar por tab (igual a consignaciones)
  const filteredByTab = useMemo(() => {
    if (tab === "ALL") return initialRows ?? [];
    return (initialRows ?? []).filter((r) => matchesTab(r, tab));
  }, [initialRows, tab]);

  const {
    searchTerm,
    setSearchTerm,
    page,
    setPage,
    rowsPerPage,
    filteredData,
    paginatedData,
  } = useSearchAndPagination<SalesOverviewRow>({
    data: filteredByTab,
    rowsPerPage: 10,
    sortFn: (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    filterFn: (row, qMaybe) => {
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

  const total = filteredData.length;
  const totalPages = Math.max(1, Math.ceil(total / rowsPerPage));

  return (
    <Box>
      <Typography variant="h4" mb={2}>
        Ventas
      </Typography>

      {/* ✅ Tabs estilo consignaciones (botones arriba) */}
      <Stack direction="row" spacing={1} mb={2} flexWrap="wrap">
        <Button variant={tab === "ALL" ? "contained" : "outlined"} onClick={() => { setTab("ALL"); setPage(0); }}>
          Todos ({counts.ALL})
        </Button>
        <Button variant={tab === "PAID" ? "contained" : "outlined"} onClick={() => { setTab("PAID"); setPage(0); }}>
          Pagadas ({counts.PAID})
        </Button>
        <Button variant={tab === "PENDING" ? "contained" : "outlined"} onClick={() => { setTab("PENDING"); setPage(0); }}>
          Pendientes ({counts.PENDING})
        </Button>
        <Button variant={tab === "FAILED" ? "contained" : "outlined"} onClick={() => { setTab("FAILED"); setPage(0); }}>
          Fallidas ({counts.FAILED})
        </Button>
        <Button variant={tab === "REFUNDED" ? "contained" : "outlined"} onClick={() => { setTab("REFUNDED"); setPage(0); }}>
          Reembolsos ({counts.REFUNDED})
        </Button>
      </Stack>

      {/* Card igual que consignaciones */}
      <Paper sx={{ p: 2, borderRadius: 3 }}>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          Listado de ventas
        </Typography>
        <Typography variant="body2" sx={{ opacity: 0.75, mb: 2 }}>
          Órdenes web + estado de pago (Mercado Pago) + productos + acceso a entrega.
        </Typography>

        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={2}
          justifyContent="space-between"
          alignItems={{ xs: "stretch", md: "center" }}
          mb={2}
        >
          <Typography variant="body2" color="text.secondary">
            {total} venta(s)
          </Typography>

          <TextField
            size="small"
            label="Buscar"
            placeholder="Orden, cliente, producto, distrito…"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPage(0);
            }}
            sx={{ maxWidth: 360 }}
          />
        </Stack>

        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Orden</TableCell>
              <TableCell>Cliente</TableCell>
              <TableCell>Productos</TableCell>
              <TableCell>Distrito</TableCell>
              <TableCell>Total</TableCell>
              <TableCell>Pago</TableCell>
              <TableCell>Entrega</TableCell>
              <TableCell>Fecha</TableCell>
              <TableCell align="right">Acciones</TableCell>
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

                <TableCell>{r.shipping_district ?? "-"}</TableCell>

                <TableCell>
                  {r.currency ?? "PEN"} {Number(r.total ?? 0).toFixed(2)}
                </TableCell>

                <TableCell>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Chip
                      size="small"
                      color={paymentChipColor(r.payment_status)}
                      label={paymentLabel(r.payment_status)}
                    />
                    {r.payment_id ? (
                      <Typography variant="caption" sx={{ opacity: 0.7 }}>
                        MP: {r.payment_id}
                      </Typography>
                    ) : null}
                  </Stack>
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
                      onClick={() => router.push(`/dynedu/reportes/ventas/${r.id}`)}
                      sx={{ minWidth: 84 }}
                    >
                      Ver Detalle
                    </Button>

                    <Button
                      size="small"
                      variant="contained"
                      onClick={() => router.push(`/dynedu/entregas/${r.id}`)}
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
