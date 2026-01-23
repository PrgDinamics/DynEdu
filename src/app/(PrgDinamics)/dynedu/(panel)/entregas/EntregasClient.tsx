"use client";

import Link from "next/link";
import {
  Box,
  Card,
  CardContent,
  CardHeader,
  Chip,
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
  Button,
} from "@mui/material";

import { useMemo, useState } from "react";
import { useSearchAndPagination } from "@/modules/dynedu/hooks/useSearchAndPagination";
import { formatDateTime } from "@/lib/dynedu/formatters";
import type { DeliveryOrderRow, FulfillmentStatus } from "./actions";

type Props = {
  initialOrders: DeliveryOrderRow[];
};

function shortId(id: string) {
  return String(id ?? "").replaceAll("-", "").slice(0, 8).toUpperCase();
}

function paymentChipLabel(status: string) {
  const s = String(status ?? "").toUpperCase();
  if (s.includes("PAGADO") || s === "PAID") return "Pago aprobado";
  if (s.includes("PENDIENTE") || s.includes("PAYMENT_PENDING")) return "Pendiente de pago";
  if (s.includes("CANCELADO") || s === "CANCELLED") return "Cancelado";
  if (s.includes("FALLIDO") || s === "FAILED") return "Fallido";
  if (s.includes("REEMBOLSO") || s === "REFUND") return "Reembolso";
  return s || "—";
}

function fulfillmentLabel(s: FulfillmentStatus) {
  switch (s) {
    case "REGISTERED":
      return "Pedido registrado";
    case "PACKING":
      return "Empacando";
    case "DELIVERY":
      return "En reparto";
    case "DELIVERED":
      return "Entregado";
    default:
      return s;
  }
}

function fulfillmentChipColor(s: FulfillmentStatus): "default" | "info" | "warning" | "success" {
  switch (s) {
    case "REGISTERED":
      return "default";
    case "PACKING":
      return "info";
    case "DELIVERY":
      return "warning";
    case "DELIVERED":
      return "success";
    default:
      return "default";
  }
}

export default function EntregasClient({ initialOrders }: Props) {
  const [statusFilter, setStatusFilter] = useState<"ALL" | FulfillmentStatus>("ALL");

  const {
    searchTerm,
    setSearchTerm,
    page,
    setPage,
    rowsPerPage,
    filteredData,
    paginatedData,
  } = useSearchAndPagination<DeliveryOrderRow>({
    data: initialOrders ?? [],
    rowsPerPage: 10,
    sortFn: (a, b) => (a.created_at < b.created_at ? 1 : -1),
    filterFn: (row, q) => {
      const haystack = [
        shortId(row.id),
        row.customer_name ?? "",
        row.customer_phone ?? "",
        row.shipping_district ?? "",
        row.shipping_address ?? "",
        row.status ?? "",
        row.fulfillment_status ?? "",
      ]
        .join(" ")
        .toLowerCase();

      const passText = haystack.includes(q);
      const passStatus = statusFilter === "ALL" ? true : row.fulfillment_status === statusFilter;

      return passText && passStatus;
    },
  });

  const total = filteredData.length;

  const counts = useMemo(() => {
    const c: Record<string, number> = { ALL: initialOrders.length };
    for (const o of initialOrders) c[o.fulfillment_status] = (c[o.fulfillment_status] ?? 0) + 1;
    return c;
  }, [initialOrders]);

  return (
    <Box>
      <Typography variant="h4" fontWeight={600} mb={0.5}>
        Entregas
      </Typography>
      <Typography variant="body2" color="text.secondary" mb={3}>
        Gestión de estado de entrega y fecha estimada (ETA) para pedidos pagados.
      </Typography>

      <Card elevation={0} sx={{ borderRadius: 3, border: "1px solid", borderColor: "divider" }}>
        <CardHeader
          title="Órdenes para entrega"
          subheader="Actualiza el estado: registrado, empacando, en reparto y entregado."
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
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              <Chip
                label={`Todos (${counts.ALL ?? 0})`}
                variant={statusFilter === "ALL" ? "filled" : "outlined"}
                onClick={() => setStatusFilter("ALL")}
              />
              {(["REGISTERED", "PACKING", "DELIVERY", "DELIVERED"] as FulfillmentStatus[]).map(
                (s) => (
                  <Chip
                    key={s}
                    label={`${fulfillmentLabel(s)} (${counts[s] ?? 0})`}
                    color={fulfillmentChipColor(s)}
                    variant={statusFilter === s ? "filled" : "outlined"}
                    onClick={() => setStatusFilter(s)}
                  />
                )
              )}
            </Stack>

            <TextField
              size="small"
              label="Buscar"
              placeholder="Orden, cliente, distrito, estado..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              sx={{ maxWidth: 360 }}
            />
          </Stack>

          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Orden</TableCell>
                <TableCell>Cliente</TableCell>
                <TableCell>Distrito</TableCell>
                <TableCell align="right">Total</TableCell>
                <TableCell>Pago</TableCell>
                <TableCell>Entrega</TableCell>
                <TableCell>Fecha entrega</TableCell>
                <TableCell>Actualizado</TableCell>
                <TableCell align="right">Acción</TableCell>
              </TableRow>
            </TableHead>

            <TableBody>
              {paginatedData.map((o) => {
                const orderId = typeof o.id === "string" ? o.id : "";
                const canOpen = orderId.length > 0;

                return (
                  <TableRow key={orderId || Math.random()} hover>
                    <TableCell sx={{ fontWeight: 600 }}>{shortId(orderId || "--------")}</TableCell>

                    <TableCell>
                      <Typography variant="body2" fontWeight={600}>
                        {o.customer_name ?? "—"}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {o.customer_phone ?? "—"}
                      </Typography>
                    </TableCell>

                    <TableCell>{o.shipping_district ?? "—"}</TableCell>

                    <TableCell align="right">
                      {(o.total ?? 0).toFixed(2)} {o.currency ?? "PEN"}
                    </TableCell>

                    <TableCell>
                      <Chip size="small" label={paymentChipLabel(o.status)} />
                    </TableCell>

                    <TableCell>
                      <Chip
                        size="small"
                        color={fulfillmentChipColor(o.fulfillment_status)}
                        label={fulfillmentLabel(o.fulfillment_status)}
                        variant="outlined"
                      />
                    </TableCell>

                    <TableCell>{o.delivery_date ?? "Por confirmar"}</TableCell>

                    <TableCell>
                      {o.fulfillment_updated_at ? formatDateTime(o.fulfillment_updated_at) : "—"}
                    </TableCell>

                    <TableCell align="right">
                      {canOpen ? (
                        <Button
                          size="small"
                          component={Link}
                          href={`/dynedu/entregas/${orderId}`}
                          variant="outlined"
                        >
                          Ver
                        </Button>
                      ) : (
                        <Button size="small" variant="outlined" disabled>
                          Ver
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}

              {total === 0 && (
                <TableRow>
                  <TableCell colSpan={9} align="center">
                    <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                      No hay órdenes para mostrar.
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
              labelDisplayedRows={({ from, to, count }) => `${from}-${to} de ${count}`}
            />
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
