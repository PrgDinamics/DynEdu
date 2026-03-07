"use client";

import React, { useMemo, useState, useTransition } from "react";

import Grid from "@mui/material/Grid";

import {
  Box,
  Card,
  CardContent,
  Chip,
  Divider,
  FormControlLabel,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";

import {
  CartesianGrid,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { getDashboardData, type DashboardData, type DashboardMode } from "./actions";

type Props = {
  initialData: DashboardData;
};

function formatCurrency(value: number) {
  try {
    return new Intl.NumberFormat("es-PE", {
      style: "currency",
      currency: "PEN",
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `S/ ${Math.round(value).toLocaleString()}`;
  }
}

function formatCurrencySmall(value: number) {
  try {
    return new Intl.NumberFormat("es-PE", {
      style: "currency",
      currency: "PEN",
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `S/ ${Number(value ?? 0).toFixed(2)}`;
  }
}

function formatNumber(value: number) {
  return Math.round(value).toLocaleString();
}

function StatCard(props: { label: string; value: string; helper?: string }) {
  return (
    <Card variant="outlined" sx={{ height: "100%" }}>
      <CardContent>
        <Typography variant="body2" color="text.secondary">
          {props.label}
        </Typography>
        <Typography variant="h5" fontWeight={700} sx={{ mt: 0.5 }}>
          {props.value}
        </Typography>
        {props.helper ? (
          <Typography variant="caption" color="text.secondary">
            {props.helper}
          </Typography>
        ) : null}
      </CardContent>
    </Card>
  );
}

// NEW: pretty top colegio
function TopSchoolCard(props: { name: string | null; sales: number | null }) {
  if (!props.name) {
    return <StatCard label="Top colegio (campaña)" value="—" />;
  }

  // expected: "Colegio X (RUC: 20xxxx)"
  const raw = String(props.name);
  const m = /^(.*)\s+\(RUC:\s*([0-9]{11}|—)\)\s*$/.exec(raw);
  const displayName = (m?.[1] ?? raw).trim();
  const ruc = (m?.[2] ?? "").trim();

  return (
    <Card variant="outlined" sx={{ height: "100%" }}>
      <CardContent>
        <Typography variant="body2" color="text.secondary">
          Top colegio (campaña)
        </Typography>

        <Typography variant="h6" fontWeight={800} sx={{ mt: 0.5, lineHeight: 1.2 }}>
          {displayName}
        </Typography>

        {ruc ? (
          <Typography variant="caption" color="text.secondary">
            RUC: {ruc}
          </Typography>
        ) : null}

        {props.sales != null ? (
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
            {formatCurrency(props.sales)}
          </Typography>
        ) : null}
      </CardContent>
    </Card>
  );
}

export default function DashboardClient({ initialData }: Props) {
  const [data, setData] = useState<DashboardData>(initialData);
  const [isPending, startTransition] = useTransition();

  const modeLabel = data.mode === "closed" ? "Solo CERRADAS" : "CERRADAS + ABIERTAS";
  const toggleChecked = data.mode === "closed_open";

  const onToggle = (_: any, checked: boolean) => {
    const nextMode: DashboardMode = checked ? "closed_open" : "closed";
    startTransition(async () => {
      const fresh = await getDashboardData({ mode: nextMode });
      setData(fresh);
    });
  };

  const dailyChart = useMemo(() => {
    return data.dailySalesCampaign.map((p) => ({
      ...p,
      day: p.date.slice(5),
    }));
  }, [data.dailySalesCampaign]);

  const statusChart = useMemo(
    () => data.consignacionesByStatus.map((s) => ({ name: s.status, value: s.count })),
    [data.consignacionesByStatus]
  );

  const top5Products = useMemo(() => data.topProductsCampaign.slice(0, 5), [data.topProductsCampaign]);
  const lowStock5 = useMemo(() => data.alerts.lowStock.slice(0, 5), [data.alerts.lowStock]);
  const noPrice5 = useMemo(() => data.alerts.noPrice.slice(0, 5), [data.alerts.noPrice]);

  return (
    <Box>
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
        <Box>
          <Typography variant="subtitle1" fontWeight={700}>
            Ventas (estimadas)
          </Typography>
          <Typography variant="caption" color={data.meta.activeCampaign ? "text.secondary" : "warning.main"} display="block">
            {data.meta.activeCampaign
              ? `Campaña activa: ${data.meta.activeCampaign.name} — ${data.meta.rangeLabel}`
              : "No hay campaña activa."}
          </Typography>
          <Typography variant="caption" color="text.secondary" display="block">
            {data.meta.note}
          </Typography>
        </Box>

        <FormControlLabel control={<Switch checked={toggleChecked} onChange={onToggle} />} label={modeLabel} />
      </Box>

      {/* KPIs */}
      <Grid container spacing={2} mb={2}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard label="Ventas (campaña)" value={formatCurrency(data.kpis.campaignSales)} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard label="Unidades (campaña)" value={formatNumber(data.kpis.campaignUnits)} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard label="Ticket promedio" value={formatCurrency(data.kpis.avgTicket)} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <TopSchoolCard name={data.kpis.topClientName} sales={data.kpis.topClientSales} />
        </Grid>
      </Grid>

      {/* Charts */}
      <Grid container spacing={2} mb={2}>
        <Grid size={{ xs: 12, md: 8 }}>
          <Card variant="outlined" sx={{ height: 360 }}>
            <CardContent sx={{ height: "100%" }}>
              <Typography variant="subtitle1" fontWeight={700} mb={1}>
                Ventas por día (campaña)
              </Typography>
              <Box sx={{ width: "100%", height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={dailyChart} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="day" tickMargin={8} />
                    <YAxis tickFormatter={(v) => formatNumber(Number(v))} width={60} />
                    <Tooltip
                      formatter={(v: any) => formatCurrencySmall(Number(v))}
                      labelFormatter={(l) => `Día ${l}`}
                    />
                    <Line type="monotone" dataKey="amount" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 4 }}>
          <Card variant="outlined" sx={{ height: 360 }}>
            <CardContent sx={{ height: "100%" }}>
              <Typography variant="subtitle1" fontWeight={700} mb={1}>
                Consignaciones por estado
              </Typography>

              {statusChart.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  Sin datos.
                </Typography>
              ) : (
                <Box sx={{ width: "100%", height: 300 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Tooltip />
                      <Pie data={statusChart} dataKey="value" nameKey="name" innerRadius={60} outerRadius={90} />
                    </PieChart>
                  </ResponsiveContainer>
                </Box>
              )}

              <Box display="flex" flexWrap="wrap" gap={1} mt={1}>
                {data.consignacionesByStatus.slice(0, 6).map((s) => (
                  <Chip key={s.status} label={`${s.status}: ${s.count}`} size="small" variant="outlined" />
                ))}
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Top products + Ops */}
      <Grid container spacing={2} mb={2}>
        <Grid size={{ xs: 12, md: 7 }}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="subtitle1" fontWeight={700} mb={1}>
                Top 5 libros vendidos (campaña)
              </Typography>

              {top5Products.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  No hay ventas registradas en el período.
                </Typography>
              ) : (
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Libro</TableCell>
                      <TableCell align="right">Unidades</TableCell>
                      <TableCell align="right">Monto</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {top5Products.map((r) => (
                      <TableRow key={r.label}>
                        <TableCell>{r.label}</TableCell>
                        <TableCell align="right">{formatNumber(r.units)}</TableCell>
                        <TableCell align="right">{formatCurrencySmall(r.amount)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 5 }}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="subtitle1" fontWeight={700}>
                Operaciones
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Conteos generales (no financieros)
              </Typography>

              <Divider sx={{ my: 1.5 }} />

              <Grid container spacing={2}>
                <Grid size={{ xs: 6 }}>
                  <StatCard label="Pedidos abiertos" value={formatNumber(data.ops.openOrders)} />
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <StatCard label="Consignaciones pendientes" value={formatNumber(data.ops.pendingConsignaciones)} />
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <StatCard label="Consignaciones abiertas" value={formatNumber(data.ops.openConsignaciones)} />
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <StatCard label="Entregas (7 días)" value={formatNumber(data.ops.deliveriesWeek)} />
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Alerts */}
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 7 }}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="subtitle1" fontWeight={700} mb={1}>
                Alertas: stock crítico (Top 5)
              </Typography>

              {lowStock5.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  No hay alertas de stock crítico.
                </Typography>
              ) : (
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Internal ID</TableCell>
                      <TableCell>Producto</TableCell>
                      <TableCell align="right">Stock</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {lowStock5.map((r) => (
                      <TableRow key={r.productoId}>
                        <TableCell>{r.internalId || "—"}</TableCell>
                        <TableCell>{r.descripcion || `Producto ${r.productoId}`}</TableCell>
                        <TableCell align="right">{formatNumber(r.stockFisico)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 5 }}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="subtitle1" fontWeight={700} mb={1}>
                Alertas: sin precio (lista predeterminada) — Top 5
              </Typography>

              {data.meta.usedPriceListId == null ? (
                <Typography variant="body2" color="text.secondary">
                  No hay lista predeterminada configurada.
                </Typography>
              ) : noPrice5.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  Todo OK: no se encontraron productos sin precio.
                </Typography>
              ) : (
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Internal ID</TableCell>
                      <TableCell>Producto</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {noPrice5.map((r) => (
                      <TableRow key={r.productoId}>
                        <TableCell>{r.internalId || "—"}</TableCell>
                        <TableCell>{r.descripcion || `Producto ${r.productoId}`}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}

              {isPending ? (
                <Typography variant="caption" color="text.secondary" display="block" mt={1}>
                  Actualizando...
                </Typography>
              ) : null}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {isPending ? (
        <Typography variant="caption" color="text.secondary" display="block" mt={2}>
          Cargando datos...
        </Typography>
      ) : null}
    </Box>
  );
}