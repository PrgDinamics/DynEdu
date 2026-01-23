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
  Bar,
  BarChart,
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
    // Show short label in X axis
    return data.dailySalesCampaign.map((p) => ({
      ...p,
      day: p.date.slice(5),
    }));
  }, [data.dailySalesCampaign]);

  const statusChart = useMemo(
    () => data.consignacionesByStatus.map((s) => ({ name: s.status, value: s.count })),
    [data.consignacionesByStatus]
  );

  return (
    <Box>
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
        <Box>
          <Typography variant="subtitle1" fontWeight={700}>
            Ventas (estimadas)
          </Typography>
          <Typography variant="caption" color={data.meta.activeCampaign ? "text.secondary" : "warning.main"}>
            {data.meta.activeCampaign
              ? `Campaña activa: ${data.meta.activeCampaign.name} — ${data.meta.rangeLabel}`
              : "No hay campaña activa."}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {data.meta.note}
          </Typography>
        </Box>

        <FormControlLabel
          control={<Switch checked={toggleChecked} onChange={onToggle} />}
          label={modeLabel}
        />
      </Box>

      {/* Sales KPIs */}
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
          <StatCard
            label="Top cliente (campaña)"
            value={data.kpis.topClientName || "—"}
            helper={data.kpis.topClientSales ? formatCurrency(data.kpis.topClientSales) : undefined}
          />
        </Grid>
      </Grid>

      {/* Charts row */}
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
                    <YAxis tickFormatter={(v) => `${Math.round(v / 1000)}k`} width={40} />
                    <Tooltip formatter={(v: any) => formatCurrency(Number(v))} labelFormatter={(l) => `Día ${l}`} />
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

              {data.topProductsCampaign.length === 0 ? (
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
                    {data.topProductsCampaign.map((r) => (
                      <TableRow key={r.label}>
                        <TableCell>{r.label}</TableCell>
                        <TableCell align="right">{formatNumber(r.units)}</TableCell>
                        <TableCell align="right">{formatCurrency(r.amount)}</TableCell>
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
                Alertas: stock crítico
              </Typography>

              {data.alerts.lowStock.length === 0 ? (
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
                    {data.alerts.lowStock.map((r) => (
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
                Alertas: sin precio (lista predeterminada)
              </Typography>

              {data.meta.usedPriceListId == null ? (
                <Typography variant="body2" color="text.secondary">
                  No hay lista predeterminada configurada.
                </Typography>
              ) : data.alerts.noPrice.length === 0 ? (
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
                    {data.alerts.noPrice.map((r) => (
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
