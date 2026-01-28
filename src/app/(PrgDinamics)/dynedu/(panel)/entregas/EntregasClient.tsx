"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useMemo, useState } from "react";

import {
  Box,
  Button,
  Chip,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";

import { SectionCard } from "../components/forms/SectionCard";
import { useSearchAndPagination } from "@/modules/dynedu/hooks/useSearchAndPagination";
import { formatDateTime } from "@/lib/dynedu/formatters";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";



import type { DeliveryOrderRow, FulfillmentStatus } from "./actions";

type EstadoUI = "ALL" | FulfillmentStatus;

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

function EntregasClientInner({ initialOrders }: Props) {
  const [tab, setTab] = useState<EstadoUI>("ALL");

  const counts = useMemo(() => {
    const c: Record<string, number> = { ALL: initialOrders?.length ?? 0 };
    for (const o of initialOrders ?? []) {
      const k = String(o.fulfillment_status ?? "");
      c[k] = (c[k] ?? 0) + 1;
    }
    return c;
  }, [initialOrders]);

  // ✅ Igual que Consignaciones: primero filtrar por tab
  const filteredByTab = useMemo(() => {
    if (tab === "ALL") return initialOrders ?? [];
    return (initialOrders ?? []).filter((o) => o.fulfillment_status === tab);
  }, [initialOrders, tab]);

  const {
    searchTerm,
    setSearchTerm,
    page,
    setPage,
    rowsPerPage,
    filteredData,
    paginatedData,
  } = useSearchAndPagination<DeliveryOrderRow>({
    data: filteredByTab,
    rowsPerPage: 10,
    sortFn: (a, b) => (a.created_at < b.created_at ? 1 : -1),
    filterFn: (row, q) => {
      const term = q.toLowerCase();
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

      return haystack.includes(term);
    },
  });

  const total = filteredData.length;
  const totalPages = Math.max(1, Math.ceil(total / rowsPerPage));

  return (
    <Box>
      <Typography variant="h4" mb={2}>
        Entregas
      </Typography>

      {/* ✅ Tabs estilo Consignaciones (botones) */}
      <Stack direction="row" spacing={1} mb={2} flexWrap="wrap">
        <Button variant={tab === "ALL" ? "contained" : "outlined"} onClick={() => setTab("ALL")}>
          Todos ({counts.ALL ?? 0})
        </Button>

        {(["REGISTERED", "PACKING", "DELIVERY", "DELIVERED"] as FulfillmentStatus[]).map((s) => (
          <Button
            key={s}
            variant={tab === s ? "contained" : "outlined"}
            onClick={() => setTab(s)}
          >
            {fulfillmentLabel(s)} ({counts[s] ?? 0})
          </Button>
        ))}
      </Stack>

      <SectionCard
        title="Órdenes para entrega"
        subtitle="Actualiza el estado: registrado, empacando, en reparto y entregado."
      >
        {/* Header con count + search (igual a consignaciones) */}
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={2}
          justifyContent="space-between"
          alignItems={{ xs: "stretch", md: "center" }}
          mb={2}
        >
          <Typography variant="body2" color="text.secondary">
            {filteredData.length} orden(es)
          </Typography>

          <TextField
            size="small"
            label="Buscar"
            placeholder="Orden, cliente, distrito, estado..."
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
              <TableCell>Distrito</TableCell>
              <TableCell align="right">Total</TableCell>
              <TableCell>Pago</TableCell>
              <TableCell>Entrega</TableCell>
              <TableCell>Fecha entrega</TableCell>
              <TableCell>Actualizado</TableCell>
              <TableCell align="right">Acciones</TableCell>
            </TableRow>
          </TableHead>

          <TableBody>
            {paginatedData.map((o) => {
              const orderId = typeof o.id === "string" ? o.id : "";
              const canOpen = orderId.length > 0;

              return (
                <TableRow key={orderId || Math.random()} hover>
                  <TableCell sx={{ fontWeight: 700 }}>
                    {shortId(orderId || "--------")}
                  </TableCell>

                  <TableCell>
                    <Typography variant="body2" fontWeight={700}>
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
                        variant="outlined"
                        endIcon={<OpenInNewIcon />}
                        component={Link}
                        href={`/dynedu/entregas/${orderId}`}
                      >
                        Ver detalle
                      </Button>
                    ) : (
                      <Button size="small" variant="outlined" disabled>
                        Ver detalle
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

        {/* ✅ Paginación estilo Consignaciones */}
        {filteredData.length > rowsPerPage ? (
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
      </SectionCard>
    </Box>
  );
}

// Igual que consignaciones: evitar hydration mismatch con MUI en App Router
const EntregasClient = dynamic(() => Promise.resolve(EntregasClientInner), { ssr: false });
export default EntregasClient;
