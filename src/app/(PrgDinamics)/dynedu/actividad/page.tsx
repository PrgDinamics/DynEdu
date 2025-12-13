import React from "react";
export const dynamic = "force-dynamic";

import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  List,
  ListItem,
  ListItemText,
  Divider,
} from "@mui/material";
import MuiGrid from "@mui/material/Grid";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

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

const pedidoStatusColor: Record<
  string,
  "default" | "primary" | "success" | "warning" | "error"
> = {
  PENDIENTE: "warning",
  PARCIAL: "primary",
  COMPLETO: "success",
  CANCELADO: "error",
};

const formatDate = (iso?: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("es-PE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

async function getDashboardData() {
  // Proveedores
  const { data: proveedoresData, error: proveedoresError } =
    await supabaseAdmin
      .from("proveedores")
      .select("id, razon_social, ruc, contacto_nombre")
      .order("razon_social", { ascending: true });

  if (proveedoresError) {
    console.error("❌ Error cargando proveedores para dashboard:", proveedoresError);
  }

  // Productos
  const { data: productosData, error: productosError } =
    await supabaseAdmin
      .from("productos")
      .select("id, internal_id, descripcion, editorial")
      .order("id", { ascending: true });

  if (productosError) {
    console.error("❌ Error cargando productos para dashboard:", productosError);
  }

  // Pedidos
  const { data: pedidosData, error: pedidosError } = await supabaseAdmin
    .from("pedidos")
    .select(
      "id, codigo, proveedor_nombre, fecha_registro, estado, unidades_solicitadas"
    )
    .order("fecha_registro", { ascending: false });

  if (pedidosError) {
    console.error("❌ Error cargando pedidos para dashboard:", pedidosError);
  }

  return {
    proveedores: (proveedoresData ?? []) as ProveedorRow[],
    productos: (productosData ?? []) as ProductoRow[],
    pedidos: (pedidosData ?? []) as PedidoRow[],
  };
}

const DynEduDashboardPage = async () => {
  const { proveedores, productos, pedidos } = await getDashboardData();

  // ===== RESÚMENES SUPERIORES =====
  const totalSuppliers = proveedores.length;
  const totalProducts = productos.length;
  const totalOrders = pedidos.length;
  const totalUnitsOrdered = pedidos.reduce(
    (sum, p) => sum + (p.unidades_solicitadas ?? 0),
    0
  );

  // ===== ÚLTIMOS PEDIDOS =====
  const latestOrders = [...pedidos].slice(0, 4);

  // ===== ACTIVIDAD RECIENTE =====
  const recentActivity: string[] = latestOrders.map((o) => {
    return `Pedido ${o.codigo} para ${o.proveedor_nombre} (${o.estado}) – ${formatDate(
      o.fecha_registro
    )}`;
  });

  // ===== LISTA DE PROVEEDORES =====
  const suppliersList = proveedores;

  return (
    <Box>
      <Typography variant="h4" fontWeight={600} mb={0.5}>
        DynEdu – Operations Dashboard
      </Typography>
      <Typography variant="body2" color="text.secondary" mb={4}>
        Resumen de proveedores, productos y pedidos usando datos reales desde
        Supabase.
      </Typography>

      {/* CARDS RESUMEN SUPERIOR */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={3}>
          <Card
            elevation={0}
            sx={{
              borderRadius: 3,
              border: "1px solid",
              borderColor: "divider",
            }}
          >
            <CardContent>
              <Typography variant="overline" color="text.secondary">
                Proveedores
              </Typography>
              <Typography variant="h4" fontWeight={600}>
                {totalSuppliers}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Editoriales con registro activo
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card
            elevation={0}
            sx={{
              borderRadius: 3,
              border: "1px solid",
              borderColor: "divider",
            }}
          >
            <CardContent>
              <Typography variant="overline" color="text.secondary">
                Productos
              </Typography>
              <Typography variant="h4" fontWeight={600}>
                {totalProducts}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Libros y packs académicos
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card
            elevation={0}
            sx={{
              borderRadius: 3,
              border: "1px solid",
              borderColor: "divider",
            }}
          >
            <CardContent>
              <Typography variant="overline" color="text.secondary">
                Pedidos
              </Typography>
              <Typography variant="h4" fontWeight={600}>
                {totalOrders}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Pendientes / parciales / completos
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card
            elevation={0}
            sx={{
              borderRadius: 3,
              border: "1px solid",
              borderColor: "divider",
            }}
          >
            <CardContent>
              <Typography variant="overline" color="text.secondary">
                Unidades pedidas
              </Typography>
              <Typography variant="h4" fontWeight={600}>
                {totalUnitsOrdered}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Ejemplares totales solicitados
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* ÚLTIMOS PEDIDOS + ACTIVIDAD RECIENTE */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        {/* Últimos pedidos */}
        <Grid item xs={12} md={8}>
          <Card
            elevation={0}
            sx={{
              borderRadius: 3,
              border: "1px solid",
              borderColor: "divider",
            }}
          >
            <CardContent>
              <Box
                display="flex"
                alignItems="center"
                justifyContent="space-between"
                mb={2}
              >
                <Box>
                  <Typography variant="h6" fontWeight={600}>
                    Últimos pedidos
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Basado en pedidos registrados en DynEdu
                  </Typography>
                </Box>
              </Box>

              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Código</TableCell>
                    <TableCell>Proveedor</TableCell>
                    <TableCell>F. registro</TableCell>
                    <TableCell>Estado</TableCell>
                    <TableCell align="right">Unidades</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {latestOrders.map((o) => (
                    <TableRow key={o.id} hover>
                      <TableCell>{o.codigo}</TableCell>
                      <TableCell>{o.proveedor_nombre}</TableCell>
                      <TableCell>{formatDate(o.fecha_registro)}</TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={o.estado}
                          color={pedidoStatusColor[o.estado] ?? "default"}
                          variant={
                            o.estado === "COMPLETO" ? "filled" : "outlined"
                          }
                        />
                      </TableCell>
                      <TableCell align="right">
                        {o.unidades_solicitadas ?? 0}
                      </TableCell>
                    </TableRow>
                  ))}

                  {latestOrders.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5}>
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{ py: 2 }}
                        >
                          Aún no hay pedidos registrados.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </Grid>

        {/* Actividad reciente */}
        <Grid item xs={12} md={4}>
          <Card
            elevation={0}
            sx={{
              borderRadius: 3,
              border: "1px solid",
              borderColor: "divider",
            }}
          >
            <CardContent>
              <Typography variant="h6" fontWeight={600} mb={1.5}>
                Actividad reciente
              </Typography>

              <List dense>
                {recentActivity.map((text, index) => (
                  <React.Fragment key={index}>
                    {index > 0 && <Divider component="li" />}
                    <ListItem alignItems="flex-start">
                      <ListItemText
                        primary={
                          <Typography variant="body2">{text}</Typography>
                        }
                      />
                    </ListItem>
                  </React.Fragment>
                ))}

                {recentActivity.length === 0 && (
                  <ListItem>
                    <ListItemText
                      primary={
                        <Typography
                          variant="body2"
                          color="text.secondary"
                        >
                          No hay actividad registrada todavía.
                        </Typography>
                      }
                    />
                  </ListItem>
                )}
              </List>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* LISTADO SIMPLE DE PROVEEDORES */}
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card
            elevation={0}
            sx={{
              borderRadius: 3,
              border: "1px solid",
              borderColor: "divider",
            }}
          >
            <CardContent>
              <Typography variant="h6" fontWeight={600} mb={1.5}>
                Proveedores
              </Typography>

              <List dense>
                {suppliersList.map((s) => (
                  <React.Fragment key={s.id}>
                    <ListItem alignItems="flex-start">
                      <ListItemText
                        primary={
                          <Typography variant="body2" fontWeight={500}>
                            {s.razon_social}
                          </Typography>
                        }
                        secondary={
                          <Typography
                            variant="caption"
                            color="text.secondary"
                          >
                            RUC {s.ruc ?? "—"} • Contacto:{" "}
                            {s.contacto_nombre ?? s.contacto_nombre ?? "—"}
                          </Typography>
                        }
                      />
                    </ListItem>
                    <Divider component="li" />
                  </React.Fragment>
                ))}

                {suppliersList.length === 0 && (
                  <ListItem>
                    <ListItemText
                      primary={
                        <Typography
                          variant="body2"
                          color="text.secondary"
                        >
                          No hay proveedores registrados todavía.
                        </Typography>
                      }
                    />
                  </ListItem>
                )}
              </List>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default DynEduDashboardPage;
