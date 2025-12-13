"use client";

import * as React from "react";
import {
  Box,
  Card,
  CardContent,
  CardHeader,
  Typography,
  TextField,
  Button,
  Stack,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  TablePagination,
} from "@mui/material";
import {
  IconPlus,
  IconTrash,
  IconEye,
  IconEdit,
  IconFileDownload,
} from "@tabler/icons-react";

import { formatDateTime } from "@/lib/dynedu/formatters";
import { PedidoStatusChip } from "../components/forms/PedidoStatusChip";
import { useSearchAndPagination } from "@/modules/dynedu/hooks/useSearchAndPagination";

import type {
  Pedido,
  PedidoEstado,
  Producto,
  Proveedor,
} from "@/modules/dynedu/types";

import {
  createPedidoCabecera,
  fetchPedidos,
  guardarLineasPedido,
  updatePedidoCabecera,
  fetchPedidoDetalle,
  type LineaPedidoInput,
  deletePedido, // <- NUEVO
} from "./actions";

// -------------------------------------
// Utils fecha UTC-5 → string para input
// -------------------------------------

function toPeruLocalInputValue(date: Date): string {
  const localOffset = date.getTimezoneOffset(); // minutos
  const peruOffset = -5 * 60;
  const diffMinutes = peruOffset - localOffset;
  const peruDate = new Date(date.getTime() + diffMinutes * 60_000);

  const pad = (n: number) => String(n).padStart(2, "0");
  const y = peruDate.getFullYear();
  const m = pad(peruDate.getMonth() + 1);
  const d = pad(peruDate.getDate());
  const hh = pad(peruDate.getHours());
  const mm = pad(peruDate.getMinutes());

  return `${y}-${m}-${d}T${hh}:${mm}`;
}

const ESTADOS_PEDIDO: PedidoEstado[] = ["PENDIENTE", "PARCIAL"];

type OrdersClientProps = {
  initialPedidos: Pedido[];
  proveedores: Proveedor[];
  productos: Producto[];
};

// Línea en el formulario (detalle) del lado cliente
type LineaForm = {
  tempId: number;
  producto_id: number | "";
  cantidad: number;
};

type DetalleViewItem = {
  id: number;
  productoCodigo: string;
  productoDescripcion: string;
  productoEditorial: string | null;
  solicitada: number;
  recibida: number;
};

const OrdersClient: React.FC<OrdersClientProps> = ({
  initialPedidos,
  proveedores,
  productos,
}) => {
  // ----------------------------
  // Estado: cabecera / detalle
  // ----------------------------

  const [pedidos, setPedidos] = React.useState<Pedido[]>(initialPedidos);

  const [pedidoActual, setPedidoActual] = React.useState<Pedido | null>(null);

  const [proveedorId, setProveedorId] = React.useState<number | "">("");
  const [fechaRegistro, setFechaRegistro] = React.useState<string>(
    toPeruLocalInputValue(new Date())
  );
  const [fechaEntrega, setFechaEntrega] = React.useState<string>("");
  const [docRef, setDocRef] = React.useState<string>("");
  const [estadoCabecera, setEstadoCabecera] =
    React.useState<PedidoEstado>("PENDIENTE");

  const [savingCabecera, setSavingCabecera] = React.useState(false);

  // Detalle (líneas)
  const [lineas, setLineas] = React.useState<LineaForm[]>([]);
  const [savingDetalle, setSavingDetalle] = React.useState(false);

  // Vista detalle (modal Ver)
  const [openVerPedido, setOpenVerPedido] = React.useState(false);
  const [detallePedido, setDetallePedido] = React.useState<Pedido | null>(null);
  const [detalleItems, setDetalleItems] = React.useState<DetalleViewItem[]>([]);
  const [loadingDetalle, setLoadingDetalle] = React.useState(false);

  // ---------------------------------
  // Modal EDITAR cabecera
  // ---------------------------------

  const [openEdit, setOpenEdit] = React.useState(false);
  const [editPedido, setEditPedido] = React.useState<Pedido | null>(null);
  const [editProveedorId, setEditProveedorId] = React.useState<number | "">("");
  const [editDocRef, setEditDocRef] = React.useState<string>("");
  const [editFechaEntrega, setEditFechaEntrega] =
    React.useState<string>("");
  const [editEstado, setEditEstado] =
    React.useState<PedidoEstado>("PENDIENTE");
  const [savingEdit, setSavingEdit] = React.useState(false);

  // ---------------------------------
  // Modal ELIMINAR pedido
  // ---------------------------------

  const [openDelete, setOpenDelete] = React.useState(false);
  const [pedidoToDelete, setPedidoToDelete] = React.useState<Pedido | null>(
    null
  );
  const [deleting, setDeleting] = React.useState(false);

  const proveedorOptions = proveedores;

  const productosMap = React.useMemo(() => {
    const map = new Map<number, Producto>();
    productos.forEach((p) => map.set(p.id, p));
    return map;
  }, [productos]);

  // ---------------------------------
  // Hook de búsqueda + paginación
  // ---------------------------------

  const {
    searchTerm: pedidosSearch,
    setSearchTerm: setPedidosSearch,
    page: pedidosPage,
    setPage: setPedidosPage,
    rowsPerPage: pedidosRowsPerPage,
    filteredData: pedidosFiltrados,
    paginatedData: pedidosPaginados,
  } = useSearchAndPagination<Pedido>({
    data: pedidos,
    rowsPerPage: 10,
    sortFn: (a, b) => {
      const fa = a.fecha_registro
        ? new Date(a.fecha_registro).getTime()
        : 0;
      const fb = b.fecha_registro
        ? new Date(b.fecha_registro).getTime()
        : 0;
      if (fb !== fa) return fb - fa;
      return b.id - a.id;
    },
    filterFn: (p, q) => {
      return (
        p.codigo.toLowerCase().includes(q) ||
        p.proveedor_nombre.toLowerCase().includes(q) ||
        (p.doc_ref ?? "").toLowerCase().includes(q) ||
        p.estado.toLowerCase().includes(q)
      );
    },
  });

  // ---------------------------------
  // Acciones cabecera
  // ---------------------------------

  const canContinuar =
    !!proveedorId && !!fechaRegistro && !savingCabecera && !pedidoActual;

  const handleContinuarCabecera = async (
    e: React.FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault();
    if (!proveedorId || !fechaRegistro) return;

    const proveedor = proveedores.find((p) => p.id === proveedorId);
    if (!proveedor) return;

    setSavingCabecera(true);
    try {
      const input = {
        proveedor_id: proveedor.id,
        proveedor_nombre: proveedor.razon_social,
        fecha_registro_iso: new Date(fechaRegistro).toISOString(),
        fecha_entrega_iso: fechaEntrega
          ? new Date(fechaEntrega).toISOString()
          : null,
        estado: estadoCabecera,
        doc_ref: docRef.trim() || null,
      };

      const created = await createPedidoCabecera(input);
      if (!created) return;

      setPedidos((prev) => [...prev, created]);
      setPedidoActual(created);

      setLineas([
        {
          tempId: Date.now(),
          producto_id: "",
          cantidad: 1,
        },
      ]);
    } finally {
      setSavingCabecera(false);
    }
  };

  const handleResetCabecera = () => {
    setPedidoActual(null);
    setProveedorId("");
    setFechaRegistro(toPeruLocalInputValue(new Date()));
    setFechaEntrega("");
    setDocRef("");
    setEstadoCabecera("PENDIENTE");
    setLineas([]);
  };

  // ---------------------------------
  // Acciones detalle (líneas)
  // ---------------------------------

  const addLinea = () => {
    setLineas((prev) => [
      ...prev,
      {
        tempId: Date.now() + Math.random(),
        producto_id: "",
        cantidad: 1,
      },
    ]);
  };

  const removeLinea = (tempId: number) => {
    setLineas((prev) => prev.filter((l) => l.tempId !== tempId));
  };

  const handleLineaChange = (
    tempId: number,
    field: keyof LineaForm,
    value: number | ""
  ) => {
    setLineas((prev) =>
      prev.map((l) =>
        l.tempId === tempId ? { ...l, [field]: value } : l
      )
    );
  };

  const canGuardarDetalle =
    !!pedidoActual &&
    !savingDetalle &&
    lineas.length > 0 &&
    lineas.every(
      (l) => typeof l.producto_id === "number" && l.cantidad > 0
    );

  const handleGuardarDetalle = async () => {
    if (!pedidoActual) return;
    if (!canGuardarDetalle) return;

    const payload: LineaPedidoInput[] = lineas.map((l) => ({
      producto_id: l.producto_id as number,
      cantidad: l.cantidad,
    }));

    setSavingDetalle(true);
    try {
      const ok = await guardarLineasPedido(pedidoActual.id, payload);
      if (!ok) return;

      const refreshed = await fetchPedidos();
      setPedidos(refreshed);

      setPedidoActual(null);
      setLineas([]);
      setProveedorId("");
      setFechaRegistro(toPeruLocalInputValue(new Date()));
      setFechaEntrega("");
      setDocRef("");
      setEstadoCabecera("PENDIENTE");
    } finally {
      setSavingDetalle(false);
    }
  };

  // ---------------------------------
  // Ver pedido (detalle)
  // ---------------------------------

  const handleVerPedido = async (pedido: Pedido) => {
    setOpenVerPedido(true);
    setDetallePedido(pedido);
    setDetalleItems([]);
    setLoadingDetalle(true);

    try {
      const result = await fetchPedidoDetalle(pedido.id);
      if (!result) return;

      setDetallePedido(result.pedido);

      const items: DetalleViewItem[] = (result.items ?? []).map(
        (it: any) => ({
          id: it.id,
          productoCodigo:
            it.productos?.internal_id ?? `ID ${it.producto_id}`,
          productoDescripcion: it.productos?.descripcion ?? "",
          productoEditorial: it.productos?.editorial ?? null,
          solicitada: it.cantidad_solicitada ?? 0,
          recibida: it.cantidad_recibida ?? 0,
        })
      );

      setDetalleItems(items);
    } finally {
      setLoadingDetalle(false);
    }
  };

  const handleCloseVerPedido = () => {
    setOpenVerPedido(false);
    setDetallePedido(null);
    setDetalleItems([]);
  };

  // ---------------------------------
  // Editar cabecera
  // ---------------------------------

  const handleOpenEdit = (pedido: Pedido) => {
    setEditPedido(pedido);
    setEditProveedorId(pedido.proveedor_id);
    setEditDocRef(pedido.doc_ref ?? "");
    setEditFechaEntrega(
      pedido.fecha_entrega
        ? toPeruLocalInputValue(new Date(pedido.fecha_entrega))
        : ""
    );
    setEditEstado(pedido.estado);
    setOpenEdit(true);
  };

  const handleCloseEdit = () => {
    setOpenEdit(false);
    setEditPedido(null);
  };

  const handleSaveEdit = async () => {
    if (!editPedido || !editProveedorId) return;

    const proveedor = proveedores.find(
      (p) => p.id === editProveedorId
    );
    if (!proveedor) return;

    const fechaEntregaIso = editFechaEntrega
      ? new Date(editFechaEntrega).toISOString()
      : null;

    setSavingEdit(true);
    try {
      const updated = await updatePedidoCabecera(editPedido.id, {
        proveedor_id: proveedor.id,
        proveedor_nombre: proveedor.razon_social,
        doc_ref: editDocRef.trim() || null,
        estado: editEstado,
        fecha_entrega_iso: fechaEntregaIso,
      });

      if (!updated) return;

      setPedidos((prev) =>
        prev.map((p) => (p.id === updated.id ? updated : p))
      );

      if (pedidoActual && pedidoActual.id === updated.id) {
        setPedidoActual(updated);
      }

      setEditPedido(updated);
      setOpenEdit(false);
    } finally {
      setSavingEdit(false);
    }
  };

  // ---------------------------------
  // Eliminar pedido
  // ---------------------------------

  const handleOpenDelete = (pedido: Pedido) => {
    setPedidoToDelete(pedido);
    setOpenDelete(true);
  };

  const handleCloseDelete = () => {
    if (deleting) return;
    setOpenDelete(false);
    setPedidoToDelete(null);
  };

  const handleConfirmDelete = async () => {
    if (!pedidoToDelete) return;

    setDeleting(true);
    try {
      const ok = await deletePedido(pedidoToDelete.id);
      if (!ok) return;

      setPedidos((prev) =>
        prev.filter((p) => p.id !== pedidoToDelete.id)
      );

      if (pedidoActual && pedidoActual.id === pedidoToDelete.id) {
        handleResetCabecera();
      }
    } finally {
      setDeleting(false);
      setOpenDelete(false);
      setPedidoToDelete(null);
    }
  };

  // ---------------------------------
  // Helpers de estado
  // ---------------------------------

  const isPedidoCerrado = (p: Pedido) =>
    p.estado === "COMPLETO" || p.estado === "PARCIAL";

  // ---------------------------------
  // Render
  // ---------------------------------

  return (
    <Box>
      <Typography variant="h4" mb={2}>
        Pedidos
      </Typography>

      {/* CABECERA NUEVO PEDIDO */}
      {!pedidoActual && (
        <Card
          elevation={0}
          sx={{
            mb: 3,
            borderRadius: 3,
            border: "1px solid",
            borderColor: "divider",
          }}
        >
          <CardHeader
            title="Datos generales del pedido"
            subheader="Registra proveedor, documento de referencia y fechas."
          />
          <CardContent>
            <Box
              component="form"
              onSubmit={handleContinuarCabecera}
              sx={{ display: "flex", flexDirection: "column", gap: 2 }}
            >
              <Stack
                direction={{ xs: "column", md: "row" }}
                spacing={2}
                alignItems="flex-start"
              >
                <TextField
                  select
                  label="Proveedor"
                  size="small"
                  fullWidth
                  value={proveedorId}
                  onChange={(e) =>
                    setProveedorId(
                      e.target.value === "" ? "" : Number(e.target.value)
                    )
                  }
                >
                  <MenuItem value="">Seleccione proveedor</MenuItem>
                  {proveedorOptions.map((prov) => (
                    <MenuItem key={prov.id} value={prov.id}>
                      {prov.razon_social}
                    </MenuItem>
                  ))}
                </TextField>

                <TextField
                  label="Fecha registro"
                  type="datetime-local"
                  size="small"
                  fullWidth
                  value={fechaRegistro}
                  onChange={(e) => setFechaRegistro(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                />

                <TextField
                  label="Fecha entrega"
                  type="datetime-local"
                  size="small"
                  fullWidth
                  value={fechaEntrega}
                  onChange={(e) => setFechaEntrega(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                />
              </Stack>

              <Stack
                direction={{ xs: "column", md: "row" }}
                spacing={2}
              >
                <TextField
                  label="Documento Ref."
                  size="small"
                  fullWidth
                  value={docRef}
                  onChange={(e) => setDocRef(e.target.value)}
                />

                <TextField
                  select
                  label="Estado inicial"
                  size="small"
                  fullWidth
                  value={estadoCabecera}
                  onChange={(e) =>
                    setEstadoCabecera(e.target.value as PedidoEstado)
                  }
                >
                  {ESTADOS_PEDIDO.map((estado) => (
                    <MenuItem key={estado} value={estado}>
                      {estado}
                    </MenuItem>
                  ))}
                </TextField>

                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "flex-end",
                  }}
                >
                  <Button
                    type="submit"
                    variant="contained"
                    disabled={!canContinuar}
                  >
                    Continuar a detalle
                  </Button>
                </Box>
              </Stack>
            </Box>
          </CardContent>
        </Card>
      )}

      {/* DETALLE DEL PEDIDO */}
      {pedidoActual && (
        <Card
          elevation={0}
          sx={{
            mb: 3,
            borderRadius: 3,
            border: "1px solid",
            borderColor: "divider",
          }}
        >
          <CardHeader
            title="Detalle del pedido"
            subheader={`CabeceraID: ${pedidoActual.id} · Proveedor: ${pedidoActual.proveedor_nombre}`}
          />
          <CardContent>
            <Stack spacing={2}>
              <Typography variant="body2" color="text.secondary">
                Registra los productos y cantidades solicitadas.
              </Typography>

              <Stack spacing={1}>
                {lineas.map((linea) => (
                  <Stack
                    key={linea.tempId}
                    direction={{ xs: "column", md: "row" }}
                    spacing={1}
                    alignItems="flex-start"
                  >
                    <TextField
                      select
                      label="Producto"
                      size="small"
                      fullWidth
                      value={linea.producto_id}
                      onChange={(e) =>
                        handleLineaChange(
                          linea.tempId,
                          "producto_id",
                          e.target.value === ""
                            ? ""
                            : Number(e.target.value)
                        )
                      }
                    >
                      {productos.map((prod) => (
                        <MenuItem key={prod.id} value={prod.id}>
                          {prod.internal_id} — {prod.descripcion}
                        </MenuItem>
                      ))}
                    </TextField>

                    <TextField
                      label="Cantidad solicitada"
                      type="number"
                      size="small"
                      fullWidth
                      inputProps={{ min: 1 }}
                      value={linea.cantidad}
                      onChange={(e) =>
                        handleLineaChange(
                          linea.tempId,
                          "cantidad",
                          Number(e.target.value)
                        )
                      }
                    />

                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "flex-end",
                      }}
                    >
                      <Button
                        variant="outlined"
                        color="error"
                        size="small"
                        onClick={() => removeLinea(linea.tempId)}
                        disabled={lineas.length === 1}
                        startIcon={<IconTrash size={16} />}
                      >
                        Quitar
                      </Button>
                    </Box>
                  </Stack>
                ))}

                <Box>
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={addLinea}
                    startIcon={<IconPlus size={16} />}
                  >
                    Agregar línea
                  </Button>
                </Box>
              </Stack>

              <Stack
                direction={{ xs: "column", md: "row" }}
                spacing={2}
                justifyContent="flex-end"
              >
                <Button
                  variant="text"
                  color="inherit"
                  onClick={handleResetCabecera}
                >
                  Cancelar
                </Button>
                <Button
                  variant="contained"
                  color="primary"
                  onClick={handleGuardarDetalle}
                  disabled={!canGuardarDetalle}
                >
                  Guardar detalle
                </Button>
              </Stack>
            </Stack>
          </CardContent>
        </Card>
      )}

      {/* LISTADO DE PEDIDOS REGISTRADOS */}
      <Card
        elevation={0}
        sx={{
          borderRadius: 3,
          border: "1px solid",
          borderColor: "divider",
        }}
      >
        <CardContent>
          <Typography variant="subtitle1" fontWeight={600} mb={1}>
            Pedidos registrados
          </Typography>
          <Typography variant="body2" color="text.secondary" mb={2}>
            Resumen de órdenes creadas en el sistema.
          </Typography>

          {/* Buscador */}
          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={2}
            mb={2}
            justifyContent="space-between"
            alignItems={{ xs: "stretch", md: "center" }}
          >
            <Typography variant="body2" color="text.secondary">
              {pedidosFiltrados.length} pedido(s) encontrados
            </Typography>

            <TextField
              size="small"
              label="Buscar"
              placeholder="Código, proveedor, doc ref, estado..."
              value={pedidosSearch}
              onChange={(e) => setPedidosSearch(e.target.value)}
              sx={{ maxWidth: 360 }}
            />
          </Stack>

          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Código</TableCell>
                <TableCell>Registro</TableCell>
                <TableCell>Entrega</TableCell>
                <TableCell>Proveedor</TableCell>
                <TableCell>Doc Ref</TableCell>
                <TableCell>Estado</TableCell>
                <TableCell align="right">
                  Cant. solicitada
                </TableCell>
                <TableCell align="center">Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {pedidosPaginados.map((p) => {
                const cerrado = isPedidoCerrado(p);
                const puedeEditar = !cerrado;
                const puedeEliminar = !cerrado;

                return (
                  <TableRow key={p.id} hover>
                    <TableCell>{p.codigo}</TableCell>
                    <TableCell>
                      {formatDateTime(p.fecha_registro)}
                    </TableCell>
                    <TableCell>
                      {formatDateTime(p.fecha_entrega)}
                    </TableCell>
                    <TableCell>{p.proveedor_nombre}</TableCell>
                    <TableCell>{p.doc_ref ?? "—"}</TableCell>
                    <TableCell>
                      <PedidoStatusChip estado={p.estado} />
                    </TableCell>
                    <TableCell align="right">
                      {p.unidades_solicitadas ?? 0}
                    </TableCell>
                    <TableCell align="center">
                      <Stack
                        direction="row"
                        spacing={0.5}
                        justifyContent="center"
                      >
                        <Tooltip title="Ver detalle">
                          <IconButton
                            size="small"
                            color="primary"
                            onClick={() => handleVerPedido(p)}
                          >
                            <IconEye size={18} />
                          </IconButton>
                        </Tooltip>

                        {/* Editar */}
                        <Tooltip
                          title={
                            puedeEditar
                              ? "Editar cabecera"
                              : "Pedido finalizado — no editable"
                          }
                        >
                          <span>
                            <IconButton
                              size="small"
                              sx={{ color: "warning.main" }}
                              disabled={!puedeEditar}
                              onClick={() =>
                                puedeEditar && handleOpenEdit(p)
                              }
                            >
                              <IconEdit size={18} />
                            </IconButton>
                          </span>
                        </Tooltip>

                        {/* Eliminar */}
                        {puedeEliminar && (
                          <Tooltip title="Eliminar pedido">
                            <IconButton
                              size="small"
                              sx={{ color: "error.main" }}
                              onClick={() => handleOpenDelete(p)}
                            >
                              <IconTrash size={18} />
                            </IconButton>
                          </Tooltip>
                        )}

                        <Tooltip title="Descargar PDF (placeholder)">
                          <IconButton size="small" color="success">
                            <IconFileDownload size={18} />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    </TableCell>
                  </TableRow>
                );
              })}

              {pedidosFiltrados.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} align="center">
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ py: 2 }}
                    >
                      No se encontraron pedidos para la búsqueda.
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          {pedidosFiltrados.length > pedidosRowsPerPage && (
            <TablePagination
              component="div"
              count={pedidosFiltrados.length}
              page={pedidosPage}
              onPageChange={(_, newPage) => setPedidosPage(newPage)}
              rowsPerPage={pedidosRowsPerPage}
              rowsPerPageOptions={[pedidosRowsPerPage]}
              labelRowsPerPage="Filas por página"
              labelDisplayedRows={({ from, to, count }) =>
                `${from}-${to} de ${
                  count !== -1 ? count : `más de ${to}`
                }`
              }
            />
          )}
        </CardContent>
      </Card>

      {/* MODAL VER DETALLE */}
      <Dialog
        open={openVerPedido}
        onClose={handleCloseVerPedido}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Detalle del pedido</DialogTitle>
        <DialogContent dividers>
          {detallePedido && (
            <>
              <Typography variant="subtitle2" gutterBottom>
                Código: <strong>{detallePedido.codigo}</strong>
              </Typography>
              <Typography variant="body2" gutterBottom>
                Proveedor:{" "}
                <strong>{detallePedido.proveedor_nombre}</strong>
              </Typography>
              <Typography variant="body2" gutterBottom>
                Registro:{" "}
                {formatDateTime(detallePedido.fecha_registro)}
              </Typography>
              <Typography variant="body2" gutterBottom>
                Entrega:{" "}
                {formatDateTime(detallePedido.fecha_entrega)}
              </Typography>
              <Typography variant="body2" gutterBottom>
                Documento Ref:{" "}
                <strong>{detallePedido.doc_ref ?? "—"}</strong>
              </Typography>
              <Typography variant="body2" gutterBottom>
                Estado: <strong>{detallePedido.estado}</strong>
              </Typography>

              <Divider sx={{ my: 2 }} />

              <Typography variant="subtitle2" gutterBottom>
                Líneas del pedido
              </Typography>

              {loadingDetalle && (
                <Typography
                  variant="body2"
                  color="text.secondary"
                >
                  Cargando detalle...
                </Typography>
              )}

              {!loadingDetalle && detalleItems.length === 0 && (
                <Typography
                  variant="body2"
                  color="text.secondary"
                >
                  No se encontraron líneas para este pedido.
                </Typography>
              )}

              {!loadingDetalle && detalleItems.length > 0 && (
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Código</TableCell>
                      <TableCell>Descripción</TableCell>
                      <TableCell>Editorial</TableCell>
                      <TableCell align="right">
                        Solicitada
                      </TableCell>
                      <TableCell align="right">
                        Recibida
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {detalleItems.map((it) => (
                      <TableRow key={it.id}>
                        <TableCell>{it.productoCodigo}</TableCell>
                        <TableCell>
                          {it.productoDescripcion}
                        </TableCell>
                        <TableCell>
                          {it.productoEditorial ?? "—"}
                        </TableCell>
                        <TableCell align="right">
                          {it.solicitada}
                        </TableCell>
                        <TableCell align="right">
                          {it.recibida}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseVerPedido}>Cerrar</Button>
        </DialogActions>
      </Dialog>

      {/* MODAL EDITAR CABECERA */}
      <Dialog
        open={openEdit}
        onClose={handleCloseEdit}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Editar cabecera del pedido</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} mt={1}>
            <TextField
              select
              label="Proveedor"
              size="small"
              fullWidth
              value={editProveedorId}
              onChange={(e) =>
                setEditProveedorId(
                  e.target.value === "" ? "" : Number(e.target.value)
                )
              }
            >
              <MenuItem value="">Seleccione proveedor</MenuItem>
              {proveedores.map((prov) => (
                <MenuItem key={prov.id} value={prov.id}>
                  {prov.razon_social}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              label="Documento Ref."
              size="small"
              fullWidth
              value={editDocRef}
              onChange={(e) => setEditDocRef(e.target.value)}
            />

            <TextField
              label="Fecha entrega"
              type="datetime-local"
              size="small"
              fullWidth
              value={editFechaEntrega}
              onChange={(e) => setEditFechaEntrega(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />

            <TextField
              select
              label="Estado"
              size="small"
              fullWidth
              value={editEstado}
              onChange={(e) =>
                setEditEstado(e.target.value as PedidoEstado)
              }
            >
              {ESTADOS_PEDIDO.map((estado) => (
                <MenuItem key={estado} value={estado}>
                  {estado}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseEdit} disabled={savingEdit}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            onClick={handleSaveEdit}
            disabled={savingEdit}
          >
            Guardar cambios
          </Button>
        </DialogActions>
      </Dialog>

      {/* MODAL ELIMINAR PEDIDO */}
      <Dialog
        open={openDelete}
        onClose={handleCloseDelete}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Eliminar pedido</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2">
            ¿Seguro que deseas eliminar el pedido{" "}
            <strong>{pedidoToDelete?.codigo}</strong>? Esta acción no se
            puede deshacer.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDelete} disabled={deleting}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleConfirmDelete}
            disabled={deleting}
          >
            Eliminar
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default OrdersClient;
