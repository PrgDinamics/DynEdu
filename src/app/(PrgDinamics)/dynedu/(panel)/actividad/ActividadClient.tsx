"use client";

import React, { useMemo, useState } from "react";
import {
  Box,
  Card,
  CardContent,
  Chip,
  Divider,
  IconButton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import MuiGrid from "@mui/material/Grid";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";

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
  if (e.includes("apro") || e.includes("abiert") || e.includes("final") || e.includes("cerr"))
    return "success";
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

function useFilteredRows<T>(rows: T[], query: string, pick: (row: T) => Array<unknown>) {
  return useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => pick(r).some((x) => normalize(x).includes(q)));
  }, [rows, query, pick]);
}

/** ---------------------------
 *  Tracking detail formatter
 *  --------------------------*/

type TrackingDetailPayload = {
  totalFaltante?: number | string;
  totalExcedente?: number | string;
  detalle?: Array<{
    product_id?: number;
    codigo?: string;
    solicitada?: number | string;
    recibida?: number | string;
    faltante?: number | string;
    excedente?: number | string;
  }>;
};

type ProductLabel = {
  primary: string; // description (preferred)
  secondary?: string; // code
};

type ResolveProductLabel = (input: { productId?: number; code?: string }) => ProductLabel | null;

function safeJsonParse(input: string): unknown | null {
  try {
    return JSON.parse(input);
  } catch {
    return null;
  }
}

function toNumber(v: unknown): number {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function isTrackingDetailPayload(x: unknown): x is TrackingDetailPayload {
  if (!x || typeof x !== "object") return false;
  const o = x as any;
  return "totalFaltante" in o || "totalExcedente" in o || Array.isArray(o.detalle);
}

function SummaryChip(props: { label: string; value: number; kind: "missing" | "extra" }) {
  const { label, value, kind } = props;
  const color =
    value > 0 ? (kind === "missing" ? ("warning" as any) : ("info" as any)) : ("default" as any);

  return (
    <Chip
      size="small"
      variant="outlined"
      color={color}
      label={`${label}: ${value}`}
      sx={{ fontWeight: 700 }}
    />
  );
}

function TrackingDetailCell(props: { raw: unknown; resolveProductLabel?: ResolveProductLabel }) {
  const rawStr = String(props.raw ?? "").trim();
  if (!rawStr || rawStr === "—") return <Typography variant="body2">—</Typography>;

  const parsed = rawStr.startsWith("{") ? safeJsonParse(rawStr) : null;

  // Not JSON / not our schema => render as nice plain text
  if (!parsed || !isTrackingDetailPayload(parsed)) {
    return (
      <Typography
        variant="body2"
        sx={{
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          maxWidth: 520,
        }}
      >
        {rawStr}
      </Typography>
    );
  }

  const totalMissing = toNumber(parsed.totalFaltante);
  const totalExtra = toNumber(parsed.totalExcedente);
  const items = Array.isArray(parsed.detalle) ? parsed.detalle : [];

  const [open, setOpen] = useState(false);

  return (
    <Box>
      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
        <SummaryChip label="Faltante" value={totalMissing} kind="missing" />
        <SummaryChip label="Excedente" value={totalExtra} kind="extra" />

        {items.length > 0 ? (
          <Tooltip title={open ? "Ocultar detalle" : "Ver detalle"}>
            <IconButton size="small" onClick={() => setOpen((v) => !v)}>
              {open ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
        ) : null}
      </Stack>

      {open && items.length > 0 ? (
        <Box
          sx={{
            mt: 1,
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 1,
            overflow: "hidden",
          }}
        >
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ py: 0.75 }}>
                  <Typography variant="caption" fontWeight={800} color="text.secondary">
                    Producto
                  </Typography>
                </TableCell>
                <TableCell sx={{ py: 0.75, width: 90 }} align="right">
                  <Typography variant="caption" fontWeight={800} color="text.secondary">
                    Sol.
                  </Typography>
                </TableCell>
                <TableCell sx={{ py: 0.75, width: 90 }} align="right">
                  <Typography variant="caption" fontWeight={800} color="text.secondary">
                    Rec.
                  </Typography>
                </TableCell>
                <TableCell sx={{ py: 0.75, width: 100 }} align="right">
                  <Typography variant="caption" fontWeight={800} color="text.secondary">
                    Falt.
                  </Typography>
                </TableCell>
                <TableCell sx={{ py: 0.75, width: 110 }} align="right">
                  <Typography variant="caption" fontWeight={800} color="text.secondary">
                    Exc.
                  </Typography>
                </TableCell>
              </TableRow>
            </TableHead>

            <TableBody>
              {items.map((it, idx) => {
                const req = toNumber(it.solicitada);
                const rec = toNumber(it.recibida);
                const miss = toNumber(it.faltante);
                const extra = toNumber(it.excedente);

                const resolved =
                  props.resolveProductLabel?.({
                    productId: it.product_id,
                    code: it.codigo ? String(it.codigo) : undefined,
                  }) ?? null;

                const fallbackPrimary = String(it.codigo ?? it.product_id ?? `#${idx + 1}`);
                const primary = resolved?.primary ?? fallbackPrimary;
                const secondary = resolved?.secondary;

                return (
                  <TableRow key={`${fallbackPrimary}-${idx}`} hover>
                    <TableCell sx={{ py: 0.75 }}>
                      <Typography variant="body2" fontWeight={800}>
                        {primary}
                      </Typography>
                      {secondary ? (
                        <Typography variant="caption" color="text.secondary">
                          {secondary}
                        </Typography>
                      ) : null}
                    </TableCell>

                    <TableCell sx={{ py: 0.75 }} align="right">
                      <Typography variant="body2">{req}</Typography>
                    </TableCell>
                    <TableCell sx={{ py: 0.75 }} align="right">
                      <Typography variant="body2">{rec}</Typography>
                    </TableCell>
                    <TableCell sx={{ py: 0.75 }} align="right">
                      <Typography variant="body2" color={miss > 0 ? "warning.main" : "text.primary"}>
                        {miss}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ py: 0.75 }} align="right">
                      <Typography variant="body2" color={extra > 0 ? "info.main" : "text.primary"}>
                        {extra}
                      </Typography>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Box>
      ) : null}
    </Box>
  );
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

          {props.rows.length > (props.showControlsThreshold ?? 5) ? (
            <TextField
              size="small"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={props.searchPlaceholder ?? "Buscar..."}
              sx={{ minWidth: 220 }}
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
  // Maps para resolver product_id/codigo -> descripcion
  const productById = useMemo(() => {
    const m = new Map<number, ProductoRow>();
    for (const p of props.productos) m.set(p.id, p);
    return m;
  }, [props.productos]);

  const productByInternalId = useMemo(() => {
    const m = new Map<string, ProductoRow>();
    for (const p of props.productos) m.set(String(p.internal_id ?? "").trim(), p);
    return m;
  }, [props.productos]);

  const resolveProductLabel: ResolveProductLabel = ({ productId, code }) => {
    if (typeof productId === "number") {
      const p = productById.get(productId);
      if (p) return { primary: p.descripcion, secondary: p.internal_id ? `Código: ${p.internal_id}` : undefined };
    }
    if (code) {
      const p = productByInternalId.get(String(code).trim());
      if (p) return { primary: p.descripcion, secondary: p.internal_id ? `Código: ${p.internal_id}` : undefined };
    }
    return null;
  };

  const totalSuppliers = props.proveedores.length;
  const totalProducts = props.productos.length;
  const totalOrders = props.pedidos.length;
  const totalUnitsOrdered = props.pedidos.reduce((sum, p) => sum + (p.unidades_solicitadas ?? 0), 0);

  const latestOrders = useMemo(() => props.pedidos.slice(0, 10), [props.pedidos]);

  const latestTracking = useMemo(() => props.tracking.slice(0, 20), [props.tracking]);

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

      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <TableWithSearchAndPagination
            title="Últimos pedidos"
            subtitle="Lista reciente de pedidos"
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
                  <Chip size="small" label={s || "—"} color={statusChipColor(s) as any} variant="outlined" />
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
                  <Chip size="small" label={e || "—"} color={eventChipColor(e) as any} variant="outlined" />
                );
              }

              if (key === "detalle") {
                return <TrackingDetailCell raw={row.detalle} resolveProductLabel={resolveProductLabel} />;
              }

              return String(row[key] ?? "—");
            }}
          />
        </Grid>
      </Grid>
    </Box>
  );
}
