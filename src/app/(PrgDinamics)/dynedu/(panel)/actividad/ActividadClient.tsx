"use client";

import React, { useMemo, useState } from "react";
import {
  Box,
  Card,
  CardContent,
  Chip,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import MuiGrid from "@mui/material/Grid";

// ⚠️ Hack: usamos el Grid de MUI pero le decimos a TS que acepta cualquier prop
const Grid = MuiGrid as any;

type ProveedorRow = {
  id: number;
  razon_social: string;
  ruc: string | null;
  contacto_nombre: string | null;
};

type ProductoRow = {
  id: number;
  internal_id: string;
  descripcion: string;
  editorial: string | null;
};

type PedidoRow = {
  id: number;
  codigo: string;
  proveedor_nombre: string;
  fecha_registro: string | null;
  estado: string;
  unidades_solicitadas: number | null;
};

type TrackingRow = {
  id: number;
  pedido_id: number | null;
  tipo_evento: string | null;
  detalle: string | null;
  created_at: string | null;
  pedido: {
    codigo: string;
    proveedor_nombre: string;
    estado: string;
  } | null;
};

function formatDate(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("es-PE", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusChipColor(status: string) {
  const s = (status || "").toLowerCase();
  if (s.includes("complet") || s.includes("cerr") || s.includes("entreg")) return "success";
  if (s.includes("parcial") || s.includes("devuelt") || s.includes("vend")) return "warning";
  if (s.includes("pend") || s.includes("solicit")) return "info";
  if (s.includes("anul") || s.includes("deneg") || s.includes("cancel")) return "error";
  return "default";
}

function eventChipColor(eventType: string) {
  const e = (eventType || "").toLowerCase();
  if (e.includes("cread") || e.includes("solic")) return "info";
  if (e.includes("apro") || e.includes("abiert") || e.includes("final") || e.includes("cerr")) return "success";
  if (e.includes("parcial") || e.includes("devuel") || e.includes("vend")) return "warning";
  if (e.includes("deneg") || e.includes("anul") || e.includes("revok")) return "error";
  return "default";
}

function kpiCard(label: string, value: string | number, helper?: string) {
  return (
    <Card>
      <CardContent>
        <Typography variant="body2" color="text.secondary">
          {label}
        </Typography>
        <Typography variant="h4" fontWeight={700}>
          {value}
        </Typography>
        {helper ? (
          <Typography variant="caption" color="text.secondary">
            {helper}
          </Typography>
        ) : null}
      </CardContent>
    </Card>
  );
}

function normalize(v: unknown) {
  return String(v ?? "").toLowerCase();
}

function useFilteredRows<T>(
  rows: T[],
  query: string,
  pick: (row: T) => Array<unknown>
) {
  return useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => pick(r).some((x) => normalize(x).includes(q)));
  }, [rows, query, pick]);
}

function TableWithSearchAndPagination(props: {
  title: string;
  subtitle?: string;
  rowsCountLabel?: string;
  showControlsThreshold?: number; // default 5
  searchPlaceholder?: string;
  columns: Array<{ key: string; label: string; width?: number | string }>;
  rows: Array<Record<string, unknown>>;
  searchKeys: (row: Record<string, unknown>) => Array<unknown>;
  renderCell?: (colKey: string, row: Record<string, unknown>) => React.ReactNode;
}) {
  const threshold = props.showControlsThreshold ?? 5;
  const shouldShowControls = props.rows.length > threshold;

  const [search, setSearch] = useState("");
  const filtered = useFilteredRows(props.rows, search, props.searchKeys);

  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(threshold);

  const total = filtered.length;

  const pagedRows = useMemo(() => {
    if (!shouldShowControls) return filtered;
    const start = page * rowsPerPage;
    return filtered.slice(start, start + rowsPerPage);
  }, [filtered, page, rowsPerPage, shouldShowControls]);

  // reset page when searching
  React.useEffect(() => {
    setPage(0);
  }, [search]);

  return (
    <Card>
      <CardContent>
        <Box display="flex" alignItems="flex-start" justifyContent="space-between" gap={2} mb={1}>
          <Box>
            <Typography variant="h6" fontWeight={700}>
              {props.title}
            </Typography>
            {props.subtitle ? (
              <Typography variant="body2" color="text.secondary">
                {props.subtitle}
              </Typography>
            ) : null}
          </Box>

          {shouldShowControls ? (
            <TextField
              size="small"
              placeholder={props.searchPlaceholder ?? "Buscar..."}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              sx={{ minWidth: 260 }}
            />
          ) : null}
        </Box>

        <Divider sx={{ mb: 2 }} />

        <Table size="small">
          <TableHead>
            <TableRow>
              {props.columns.map((c) => (
                <TableCell key={c.key} sx={{ width: c.width }}>
                  <Typography variant="caption" color="text.secondary" fontWeight={700}>
                    {c.label}
                  </Typography>
                </TableCell>
              ))}
            </TableRow>
          </TableHead>

          <TableBody>
            {pagedRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={props.columns.length}>
                  <Typography variant="body2" color="text.secondary">
                    No hay registros.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              pagedRows.map((row, i) => (
                <TableRow key={String(row.id ?? i)} hover>
                  {props.columns.map((c) => (
                    <TableCell key={c.key}>
                      {props.renderCell ? props.renderCell(c.key, row) : String(row[c.key] ?? "—")}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {shouldShowControls ? (
          <TablePagination
            component="div"
            count={total}
            page={page}
            onPageChange={(_, next) => setPage(next)}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={(e) => {
              setRowsPerPage(parseInt(e.target.value, 10));
              setPage(0);
            }}
            rowsPerPageOptions={[5, 10, 25]}
            labelRowsPerPage="Filas"
          />
        ) : null}

        {props.rowsCountLabel ? (
          <Typography variant="caption" color="text.secondary">
            {props.rowsCountLabel}: {total}
          </Typography>
        ) : null}
      </CardContent>
    </Card>
  );
}

export default function ActividadClient(props: {
  proveedores: ProveedorRow[];
  productos: ProductoRow[];
  pedidos: PedidoRow[];
  tracking: TrackingRow[];
}) {
  const totalSuppliers = props.proveedores.length;
  const totalProducts = props.productos.length;
  const totalOrders = props.pedidos.length;
  const totalUnitsOrdered = props.pedidos.reduce(
    (sum, p) => sum + (p.unidades_solicitadas ?? 0),
    0
  );

  const latestOrders = useMemo(() => props.pedidos.slice(0, 10), [props.pedidos]);

  const latestTracking = useMemo(() => {
    const rows = props.tracking.slice(0, 20);
    return rows;
  }, [props.tracking]);

  const orderRows = useMemo(
    () =>
      latestOrders.map((p) => ({
        id: p.id,
        codigo: p.codigo,
        proveedor: p.proveedor_nombre,
        estado: p.estado,
        unidades: p.unidades_solicitadas ?? 0,
        fecha: p.fecha_registro,
      })),
    [latestOrders]
  );

  const trackingRows = useMemo(
    () =>
      latestTracking.map((t) => ({
        id: t.id,
        fecha: t.created_at,
        pedidoCodigo: t.pedido?.codigo ?? "—",
        proveedor: t.pedido?.proveedor_nombre ?? "—",
        evento: t.tipo_evento ?? "—",
        detalle: t.detalle ?? "—",
      })),
    [latestTracking]
  );

  return (
    <Box>
      {/* KPIs */}
      <Grid container spacing={2} mb={2}>
        <Grid item xs={12} md={3}>
          {kpiCard("Proveedores", totalSuppliers)}
        </Grid>
        <Grid item xs={12} md={3}>
          {kpiCard("Productos", totalProducts)}
        </Grid>
        <Grid item xs={12} md={3}>
          {kpiCard("Pedidos", totalOrders)}
        </Grid>
        <Grid item xs={12} md={3}>
          {kpiCard("Unidades solicitadas", totalUnitsOrdered)}
        </Grid>
      </Grid>

      {/* Tablas */}
      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <TableWithSearchAndPagination
            title="Últimos pedidos"
            subtitle="Lista reciente (filtro + paginación si hay más de 5 filas)"
            showControlsThreshold={5}
            columns={[
              { key: "codigo", label: "Código" },
              { key: "proveedor", label: "Proveedor" },
              { key: "estado", label: "Estado" },
              { key: "unidades", label: "Unidades", width: 110 },
              { key: "fecha", label: "Fecha", width: 180 },
            ]}
            rows={orderRows}
            searchKeys={(row) => [row.codigo, row.proveedor, row.estado]}
            renderCell={(key, row) => {
              if (key === "estado") {
                const s = String(row.estado ?? "");
                return (
                  <Chip
                    size="small"
                    label={s || "—"}
                    color={statusChipColor(s) as any}
                    variant="outlined"
                  />
                );
              }
              if (key === "fecha") return formatDate(row.fecha as any);
              return String(row[key] ?? "—");
            }}
          />
        </Grid>

        <Grid item xs={12} md={6}>
          <TableWithSearchAndPagination
            title="Movimientos recientes"
            subtitle="Eventos del tracking"
            showControlsThreshold={5}
            columns={[
              { key: "fecha", label: "Fecha", width: 180 },
              { key: "pedidoCodigo", label: "Pedido", width: 110 },
              { key: "proveedor", label: "Proveedor" },
              { key: "evento", label: "Evento", width: 140 },
              { key: "detalle", label: "Detalle" },
            ]}
            rows={trackingRows}
            searchKeys={(row) => [row.pedidoCodigo, row.proveedor, row.evento, row.detalle]}
            renderCell={(key, row) => {
              if (key === "fecha") return formatDate(row.fecha as any);
              if (key === "evento") {
                const e = String(row.evento ?? "");
                return (
                  <Chip
                    size="small"
                    label={e || "—"}
                    color={eventChipColor(e) as any}
                    variant="outlined"
                  />
                );
              }
              return String(row[key] ?? "—");
            }}
          />
        </Grid>
      </Grid>

    
    </Box>
  );
}
