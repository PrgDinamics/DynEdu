"use client";
export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";

import { formatDateTime } from "@/lib/dynedu/formatters";
import { PedidoStatusChip } from "../components/forms/PedidoStatusChip";
import { UltimoEventoChip } from "../components/forms/UltimoEventoChip";
import { useSearchAndPagination } from "@/modules/dynedu/hooks/useSearchAndPagination";

import {
  addOrderCommentAction,
  registrarPedidoRealAction,
  type TrackingEvent,
  type TrackingOrderSummary,
} from "./actions";
import type { Pedido, PedidoItem } from "@/modules/dynedu/types";

type PedidoDetalle = {
  pedido: Pedido;
  items: PedidoItem[];
} | null;

type FinalizadoDetalleJson = {
  totalFaltante: number;
  totalExcedente: number;
  detalle: {
    product_id: number;
    codigo: string;
    solicitada: number;
    recibida: number;
    faltante: number;
    excedente: number;
  }[];
};

function renderDetalleEvento(ev: TrackingEvent) {
  if (!ev.detalle) return "—";

  try {
    const parsed = JSON.parse(ev.detalle) as FinalizadoDetalleJson;

    if (!parsed || !Array.isArray(parsed.detalle)) {
      return ev.detalle;
    }

    return (
      <Box>
        <Typography variant="body2" sx={{ mb: 0.5 }}>
          Faltantes: <strong>{parsed.totalFaltante}</strong> · Excedentes:{" "}
          <strong>{parsed.totalExcedente}</strong>
        </Typography>

        <Box component="ul" sx={{ m: 0, pl: 2 }}>
          {parsed.detalle.map((item) => (
            <li key={item.codigo}>
              <Typography variant="body2" component="span">
                <strong>{item.codigo}</strong> — Solicitada: {item.solicitada},
                Recibida: {item.recibida}
                {item.faltante > 0 && `, Faltante: ${item.faltante}`}
                {item.excedente > 0 && `, Excedente: ${item.excedente}`}
              </Typography>
            </li>
          ))}
        </Box>
      </Box>
    );
  } catch {
    return ev.detalle;
  }
}

type RealItemRow = {
  itemId: number;
  productId: number;
  codigo: string;
  descripcion: string;
  solicitada: number;
  recibida: number;
};

type TrackingClientProps = {
  orders: TrackingOrderSummary[];
  selectedOrder?: TrackingOrderSummary;
  timeline: TrackingEvent[];
  pedidoRealDetalle: PedidoDetalle;
};

export default function TrackingClient({
  orders,
  selectedOrder,
  timeline,
  pedidoRealDetalle,
}: TrackingClientProps) {
  const [commentText, setCommentText] = useState("");

  const [realRows, setRealRows] = useState<RealItemRow[]>([]);
  const [finalizar, setFinalizar] = useState(true);

  const openReal = Boolean(pedidoRealDetalle);

  // Hook de búsqueda + paginación para la lista de pedidos en seguimiento
  const {
    searchTerm: ordersSearch,
    setSearchTerm: setOrdersSearch,
    page: ordersPage,
    setPage: setOrdersPage,
    rowsPerPage: ordersRowsPerPage,
    filteredData: filteredOrders,
    paginatedData: paginatedOrders,
  } = useSearchAndPagination<TrackingOrderSummary>({
    data: orders,
    rowsPerPage: 10,
    sortFn: (a, b) => b.id - a.id,
    filterFn: (o, q) => {
      return (
        o.codigo.toLowerCase().includes(q) ||
        o.proveedor_nombre.toLowerCase().includes(q) ||
        (o.doc_ref ?? "").toLowerCase().includes(q) ||
        o.estado.toLowerCase().includes(q)
      );
    },
  });

  // Cargar datos en el modal de Pedido Real
  useEffect(() => {
    if (pedidoRealDetalle) {
      const itemsAny = (pedidoRealDetalle.items ?? []) as any[];

      const rows: RealItemRow[] = itemsAny.map((item) => ({
        itemId: item.id,
        productId: item.producto_id,
        codigo: item.productos?.internal_id ?? "",
        descripcion: item.productos?.descripcion ?? "",
        solicitada: item.cantidad_solicitada ?? 0,
        recibida:
          typeof item.cantidad_recibida === "number"
            ? item.cantidad_recibida
            : item.cantidad_solicitada,
      }));

      setRealRows(rows);
      setFinalizar(true);
    } else {
      setRealRows([]);
    }
  }, [pedidoRealDetalle]);

  const resumenReal = useMemo(() => {
    const totalSolicitada = realRows.reduce((s, r) => s + r.solicitada, 0);
    const totalRecibida = realRows.reduce((s, r) => s + r.recibida, 0);
    const totalFaltante = realRows.reduce(
      (s, r) => s + Math.max(r.solicitada - r.recibida, 0),
      0
    );
    const totalExcedente = realRows.reduce(
      (s, r) => s + Math.max(r.recibida - r.solicitada, 0),
      0
    );
    return { totalSolicitada, totalRecibida, totalFaltante, totalExcedente };
  }, [realRows]);

  const realPayload = useMemo(() => {
    if (!pedidoRealDetalle) return "";
    return JSON.stringify({
      pedidoId: pedidoRealDetalle.pedido.id,
      finalizar,
      items: realRows,
    });
  }, [pedidoRealDetalle, finalizar, realRows]);

  return (
    <Box>
      <Typography variant="h4" mb={2}>
        Seguimiento
      </Typography>

      {/* Buscador de pedidos */}
      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={2}
        mb={2}
        justifyContent="space-between"
        alignItems={{ xs: "stretch", md: "center" }}
      >
        <Typography variant="body2" color="text.secondary">
          {filteredOrders.length} pedido(s) en seguimiento
        </Typography>

        <TextField
          size="small"
          label="Buscar pedido"
          placeholder="Código, proveedor, estado..."
          value={ordersSearch}
          onChange={(e) => setOrdersSearch(e.target.value)}
          sx={{ maxWidth: 360 }}
        />
      </Stack>

      {/* LISTA DE PEDIDOS */}
      <Stack spacing={1}>
        {paginatedOrders.map((order) => {
          const isClosed =
            order.estado === "COMPLETO" || order.estado === "PARCIAL";

          return (
            <Card key={order.id} variant="outlined">
              <CardContent
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 2,
                }}
              >
                <Box>
                  <Stack
                    direction="row"
                    spacing={1}
                    alignItems="center"
                    flexWrap="wrap"
                  >
                    <Link
                      href={`/dynedu/tracking?pedidoId=${order.id}#historial`}
                    >
                      <Button size="small" variant="outlined">
                        Ver Historial
                      </Button>
                    </Link>

                    <Typography variant="body2">
                      Pedido {order.codigo}
                    </Typography>
                    <Typography variant="body2">
                      • Proveedor: {order.proveedor_nombre}
                    </Typography>
                    {order.doc_ref && (
                      <Typography variant="body2">
                        • Doc: {order.doc_ref}
                      </Typography>
                    )}

                    <UltimoEventoChip
                      ultimoEvento={order.ultimo_evento}
                      fecha={order.ultimo_evento_fecha}
                    />

                    <PedidoStatusChip estado={order.estado} />
                  </Stack>
                </Box>

                {/* Acciones solo si NO está cerrado */}
                {!isClosed && (
                  <Stack direction="row" spacing={1}>
                    <Link
                      href={`/dynedu/tracking?pedidoId=${order.id}#comentarios`}
                    >
                      <Button size="small" variant="contained">
                        Comentar
                      </Button>
                    </Link>

                    <Link
                      href={`/dynedu/tracking?pedidoId=${order.id}&realId=${order.id}#real`}
                    >
                      <Button
                        size="small"
                        variant="contained"
                        color="success"
                      >
                        Pedido Real
                      </Button>
                    </Link>
                  </Stack>
                )}
              </CardContent>
            </Card>
          );
        })}

        {filteredOrders.length === 0 && (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ mt: 1 }}
          >
            No se encontraron pedidos para la búsqueda.
          </Typography>
        )}
      </Stack>

      {/* Controles de página para la lista de pedidos */}
      {filteredOrders.length > ordersRowsPerPage && (
        <Box
          mt={2}
          display="flex"
          justifyContent="flex-end"
          alignItems="center"
          gap={1}
        >
          <Typography variant="caption" color="text.secondary">
            Página {ordersPage + 1} de{" "}
            {Math.ceil(filteredOrders.length / ordersRowsPerPage)}
          </Typography>

          <Button
            size="small"
            variant="outlined"
            disabled={ordersPage === 0}
            onClick={() =>
              setOrdersPage((prev) => Math.max(0, prev - 1))
            }
          >
            Anterior
          </Button>

          <Button
            size="small"
            variant="outlined"
            disabled={
              (ordersPage + 1) * ordersRowsPerPage >=
              filteredOrders.length
            }
            onClick={() =>
              setOrdersPage((prev) =>
                (prev + 1) * ordersRowsPerPage < filteredOrders.length
                  ? prev + 1
                  : prev
              )
            }
          >
            Siguiente
          </Button>
        </Box>
      )}

      {/* HISTORIAL DETALLE DEL PEDIDO SELECCIONADO */}
      {selectedOrder && (
        <Box mt={4}>
          <Typography variant="h5" mb={2}>
            Historial del pedido
          </Typography>

          <Card variant="outlined">
            <CardContent>
              <Stack
                direction="row"
                spacing={1}
                alignItems="center"
                justifyContent="space-between"
                flexWrap="wrap"
                mb={2}
              >
                <Stack
                  direction="row"
                  spacing={1}
                  alignItems="center"
                  flexWrap="wrap"
                >
                  <Link href="/dynedu/tracking">
                    <Button size="small" variant="outlined">
                      Ocultar
                    </Button>
                  </Link>

                  <Typography variant="subtitle1">
                    Pedido {selectedOrder.codigo} • Proveedor:{" "}
                    {selectedOrder.proveedor_nombre}
                    {selectedOrder.doc_ref &&
                      ` • Doc: ${selectedOrder.doc_ref}`}
                  </Typography>

                  <UltimoEventoChip
                    ultimoEvento={selectedOrder.ultimo_evento}
                    fecha={selectedOrder.ultimo_evento_fecha}
                  />

                  <PedidoStatusChip estado={selectedOrder.estado} />
                </Stack>

                {/* Acciones solo si NO está cerrado */}
                {!(
                  selectedOrder.estado === "COMPLETO" ||
                  selectedOrder.estado === "PARCIAL"
                ) && (
                  <Stack direction="row" spacing={1}>
                    <Link
                      href={`/dynedu/tracking?pedidoId=${selectedOrder.id}#comentarios`}
                    >
                      <Button size="small" variant="contained">
                        Comentar
                      </Button>
                    </Link>

                    <Link
                      href={`/dynedu/tracking?pedidoId=${selectedOrder.id}&realId=${selectedOrder.id}#real`}
                    >
                      <Button
                        size="small"
                        variant="contained"
                        color="success"
                      >
                        Pedido Real
                      </Button>
                    </Link>
                  </Stack>
                )}
              </Stack>

              {/* TABLA DE EVENTOS */}
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Fecha</TableCell>
                    <TableCell>Evento</TableCell>
                    <TableCell>Detalle</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {timeline.map((ev) => (
                    <TableRow key={ev.id}>
                      <TableCell>{formatDateTime(ev.created_at)}</TableCell>
                      <TableCell>
                        <Chip size="small" label={ev.tipo_evento} />
                      </TableCell>
                      <TableCell sx={{ whiteSpace: "pre-wrap" }}>
                        {renderDetalleEvento(ev)}
                      </TableCell>
                    </TableRow>
                  ))}

                  {timeline.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3}>Sin eventos aún.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>

              {/* FORMULARIO DE COMENTARIO (solo si no está cerrado) */}
              {!(
                selectedOrder.estado === "COMPLETO" ||
                selectedOrder.estado === "PARCIAL"
              ) && (
                <Box component="section" id="comentarios" mt={3}>
                  <Typography variant="subtitle2" mb={1}>
                    Agregar comentario
                  </Typography>

                  <form action={addOrderCommentAction}>
                    <input
                      type="hidden"
                      name="pedidoId"
                      value={selectedOrder.id}
                    />
                    <TextField
                      /* 👇 nombre corregido para que coincida con la server action */
                      name="detalle"
                      label="Comentario"
                      fullWidth
                      multiline
                      minRows={2}
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                    />
                    <Box
                      mt={1}
                      display="flex"
                      justifyContent="flex-end"
                    >
                      <Button
                        type="submit"
                        variant="contained"
                        disabled={!commentText.trim()}
                      >
                        Guardar comentario
                      </Button>
                    </Box>
                  </form>
                </Box>
              )}
            </CardContent>
          </Card>
        </Box>
      )}

      {/* MODAL PEDIDO REAL */}
      <Dialog open={openReal} onClose={() => {}} maxWidth="md" fullWidth>
        <DialogTitle>Pedido real</DialogTitle>
        <DialogContent dividers>
          {pedidoRealDetalle && (
            <>
              <Typography variant="subtitle2" gutterBottom>
                Código:{" "}
                <strong>{pedidoRealDetalle.pedido.codigo}</strong>
              </Typography>
              <Typography variant="body2" gutterBottom>
                Proveedor:{" "}
                <strong>
                  {pedidoRealDetalle.pedido.proveedor_nombre}
                </strong>
              </Typography>

              <Box component="section" id="real" mt={2}>
                <Typography variant="subtitle2" gutterBottom>
                  Cantidades reales
                </Typography>

                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Código</TableCell>
                      <TableCell>Descripción</TableCell>
                      <TableCell align="right">Solicitada</TableCell>
                      <TableCell align="right">Recibida</TableCell>
                      <TableCell align="right">Faltante</TableCell>
                      <TableCell align="right">Excedente</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {realRows.map((row) => {
                      const faltante = Math.max(
                        row.solicitada - row.recibida,
                        0
                      );
                      const excedente = Math.max(
                        row.recibida - row.solicitada,
                        0
                      );

                      return (
                        <TableRow key={row.itemId}>
                          <TableCell>{row.codigo}</TableCell>
                          <TableCell>{row.descripcion}</TableCell>
                          <TableCell align="right">
                            {row.solicitada}
                          </TableCell>
                          <TableCell align="right">
                            <TextField
                              type="number"
                              size="small"
                              variant="standard"
                              inputProps={{ min: 0 }}
                              value={row.recibida}
                              onChange={(e) => {
                                const value = Number(
                                  e.target.value || 0
                                );
                                setRealRows((prev) =>
                                  prev.map((r) =>
                                    r.itemId === row.itemId
                                      ? { ...r, recibida: value }
                                      : r
                                  )
                                );
                              }}
                            />
                          </TableCell>
                          <TableCell align="right">
                            {faltante}
                          </TableCell>
                          <TableCell align="right">
                            {excedente}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>

                <Box mt={2}>
                  <Typography variant="body2">
                    Total solicitada: {resumenReal.totalSolicitada} · Total
                    recibida: {resumenReal.totalRecibida} · Faltante:{" "}
                    {resumenReal.totalFaltante} · Excedente:{" "}
                    {resumenReal.totalExcedente}
                  </Typography>
                </Box>

                <Box
                  mt={2}
                  display="flex"
                  alignItems="center"
                  gap={1}
                >
                  <Checkbox
                    checked={finalizar}
                    onChange={(e) =>
                      setFinalizar(e.target.checked)
                    }
                  />
                  <Typography variant="body2">
                    Finalizar pedido (cambiar estado a COMPLETO y bloquear
                    edición).
                  </Typography>
                </Box>
              </Box>
            </>
          )}
        </DialogContent>
        <DialogActions>
          {pedidoRealDetalle && (
            <Link
              href={`/dynedu/tracking?pedidoId=${pedidoRealDetalle.pedido.id}#historial`}
            >
              <Button variant="outlined">Regresar</Button>
            </Link>
          )}

          <form action={registrarPedidoRealAction}>
            <input type="hidden" name="payload" value={realPayload} />
            <Button type="submit" variant="contained" color="success">
              Guardar pedido real
            </Button>
          </form>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
