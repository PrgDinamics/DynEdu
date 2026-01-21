"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Box,
  Button,
  Card,
  CardContent,
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

/**
 * Wrapper to avoid hydration mismatch with MUI:
 * - Server render outputs only a lightweight loader (no MUI markup)
 * - After mount, we render the real UI in TrackingClientInner
 * This also avoids breaking hook order rules.
 */
export default function TrackingClient(props: TrackingClientProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          padding: 24,
          background:
            "linear-gradient(135deg, rgba(42,20,94,1) 0%, rgba(17,26,46,1) 60%, rgba(11,18,32,1) 100%)",
          color: "rgba(255,255,255,0.9)",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div style={{ fontWeight: 900, fontSize: 16 }}>Cargando tracking…</div>
          <div style={{ marginTop: 6, fontSize: 13, opacity: 0.75 }}>
            Preparando panel
          </div>
        </div>
      </div>
    );
  }

  return <TrackingClientInner {...props} />;
}

function TrackingClientInner({
  orders,
  selectedOrder,
  timeline,
  pedidoRealDetalle,
}: TrackingClientProps) {
  const router = useRouter();

  const [commentText, setCommentText] = useState("");
  const [realRows, setRealRows] = useState<RealItemRow[]>([]);
  const [finalizar, setFinalizar] = useState(true);

  const openReal = Boolean(pedidoRealDetalle);

  // ---------------------------------
  // Hook de búsqueda + paginación (lista de pedidos en seguimiento)
  // ---------------------------------
  const {
    searchTerm: pedidosSearch,
    setSearchTerm: setPedidosSearch,
    page: pedidosPage,
    setPage: setPedidosPage,
    rowsPerPage: pedidosRowsPerPage,
    filteredData: pedidosFiltrados,
    paginatedData: pedidosPaginados,
  } = useSearchAndPagination<TrackingOrderSummary>({
    data: orders,
    rowsPerPage: 10,
    sortFn: (a, b) => b.id - a.id, // más recientes primero
    filterFn: (o, q) => {
      const term = q.toLowerCase();
      return (
        o.codigo.toLowerCase().includes(term) ||
        o.proveedor_nombre.toLowerCase().includes(term) ||
        (o.doc_ref ?? "").toLowerCase().includes(term) ||
        o.estado.toLowerCase().includes(term)
      );
    },
  });

  // Toggle historial (muestra/oculta el bloque embebido)
  const handleToggleHistorial = (orderId: number) => {
    if (selectedOrder && selectedOrder.id === orderId) {
      // si ya está abierto, lo cerramos volviendo a la URL base
      router.push("/dynedu/tracking");
    } else {
      router.push(`/dynedu/tracking?pedidoId=${orderId}#historial`);
    }
  };

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

  const totalPages = Math.max(
    1,
    Math.ceil(pedidosFiltrados.length / pedidosRowsPerPage)
  );

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
          {pedidosFiltrados.length} pedido(s) en seguimiento
        </Typography>

        <TextField
          size="small"
          label="Buscar"
          placeholder="Código, proveedor, doc, estado..."
          value={pedidosSearch}
          onChange={(e) => {
            setPedidosSearch(e.target.value);
            setPedidosPage(0);
          }}
          sx={{ maxWidth: 360 }}
        />
      </Stack>

      {/* LISTA DE PEDIDOS + HISTORIAL EMBEBIDO */}
      <Stack spacing={2}>
        {pedidosPaginados.map((order) => {
          const isClosed = order.estado === "COMPLETO" || order.estado === "PARCIAL";
          const isSelected = selectedOrder && selectedOrder.id === order.id;

          return (
            <Box key={order.id}>
              <Card
                variant="outlined"
                sx={{
                  borderColor: isClosed ? "success.light" : "grey.300",
                  backgroundColor: isClosed ? "success.50" : "background.paper",
                }}
              >
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
                      <Button
                        size="small"
                        variant={isSelected ? "contained" : "outlined"}
                        color={isSelected ? "primary" : "inherit"}
                        onClick={() => handleToggleHistorial(order.id)}
                      >
                        {isSelected ? "Ocultar historial" : "Ver historial"}
                      </Button>

                      <Typography variant="body2">Pedido {order.codigo}</Typography>
                      <Typography variant="body2">
                        • Proveedor: {order.proveedor_nombre}
                      </Typography>

                      {order.doc_ref && (
                        <Typography variant="body2">• Doc: {order.doc_ref}</Typography>
                      )}

                      <UltimoEventoChip
                        ultimoEvento={order.ultimo_evento}
                        fecha={order.ultimo_evento_fecha}
                      />

                      <PedidoStatusChip estado={order.estado} />
                    </Stack>
                  </Box>

                  {!isClosed && (
                    <Stack direction="row" spacing={1}>
                      <Link href={`/dynedu/tracking?pedidoId=${order.id}#comentarios`}>
                        <Button size="small" variant="contained">
                          Comentar
                        </Button>
                      </Link>

                      <Link
                        href={`/dynedu/tracking?pedidoId=${order.id}&realId=${order.id}#real`}
                      >
                        <Button size="small" variant="contained" color="success">
                          Pedido real
                        </Button>
                      </Link>
                    </Stack>
                  )}
                </CardContent>
              </Card>

              {/* HISTORIAL + COMENTARIO INLINE */}
              {isSelected && (
                <Box mt={2} id="historial">
                  <Typography variant="h6" mb={1.5}>
                    Historial del pedido
                  </Typography>

                  <Card variant="outlined" sx={{ mb: 2 }}>
                    <DialogContent sx={{ p: 2 }}>
                      <Stack
                        direction={{ xs: "column", md: "row" }}
                        spacing={1}
                        alignItems={{ xs: "flex-start", md: "center" }}
                        justifyContent="space-between"
                        mb={2}
                      >
                        <Stack
                          direction="row"
                          spacing={1}
                          alignItems="center"
                          flexWrap="wrap"
                        >
                          <Typography variant="subtitle1">
                            Pedido {selectedOrder!.codigo} • Proveedor:{" "}
                            {selectedOrder!.proveedor_nombre}
                            {selectedOrder!.doc_ref && ` • Doc: ${selectedOrder!.doc_ref}`}
                          </Typography>

                          <UltimoEventoChip
                            ultimoEvento={selectedOrder!.ultimo_evento}
                            fecha={selectedOrder!.ultimo_evento_fecha}
                          />

                          <PedidoStatusChip estado={selectedOrder!.estado} />
                        </Stack>
                      </Stack>

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
                    </DialogContent>
                  </Card>

                  {/* Comentario inline */}
                  {!(
                    selectedOrder!.estado === "COMPLETO" ||
                    selectedOrder!.estado === "PARCIAL"
                  ) && (
                    <Box component="section" id="comentarios" mt={2}>
                      <Typography variant="subtitle2" mb={1}>
                        Agregar comentario
                      </Typography>

                      <form action={addOrderCommentAction}>
                        <input type="hidden" name="pedidoId" value={selectedOrder!.id} />
                        <TextField
                          name="detalle"
                          label="Comentario"
                          fullWidth
                          multiline
                          minRows={2}
                          value={commentText}
                          onChange={(e) => setCommentText(e.target.value)}
                        />
                        <Box mt={1} display="flex" justifyContent="flex-end">
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
                </Box>
              )}
            </Box>
          );
        })}

        {pedidosFiltrados.length === 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            No se encontraron pedidos para la búsqueda.
          </Typography>
        )}
      </Stack>

      {/* Paginación de pedidos */}
      {pedidosFiltrados.length > pedidosRowsPerPage && (
        <Box
          mt={2}
          display="flex"
          justifyContent="flex-end"
          alignItems="center"
          gap={1}
        >
          <Typography variant="caption" color="text.secondary">
            Página {pedidosPage + 1} de {totalPages}
          </Typography>

          <Button
            size="small"
            variant="outlined"
            disabled={pedidosPage === 0}
            onClick={() => setPedidosPage((prev) => Math.max(0, prev - 1))}
          >
            Anterior
          </Button>

          <Button
            size="small"
            variant="outlined"
            disabled={pedidosPage + 1 >= totalPages}
            onClick={() =>
              setPedidosPage((prev) => (prev + 1 < totalPages ? prev + 1 : prev))
            }
          >
            Siguiente
          </Button>
        </Box>
      )}

      {/* MODAL PEDIDO REAL */}
      <Dialog open={openReal} onClose={() => {}} maxWidth="md" fullWidth>
        <DialogTitle>Pedido real</DialogTitle>
        <DialogContent dividers>
          {pedidoRealDetalle && (
            <>
              <Typography variant="subtitle2" gutterBottom>
                Código: <strong>{pedidoRealDetalle.pedido.codigo}</strong>
              </Typography>

              <Typography variant="body2" gutterBottom>
                Proveedor:{" "}
                <strong>{pedidoRealDetalle.pedido.proveedor_nombre}</strong>
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
                      const faltante = Math.max(row.solicitada - row.recibida, 0);
                      const excedente = Math.max(row.recibida - row.solicitada, 0);

                      return (
                        <TableRow key={row.itemId}>
                          <TableCell>{row.codigo}</TableCell>
                          <TableCell>{row.descripcion}</TableCell>
                          <TableCell align="right">{row.solicitada}</TableCell>
                          <TableCell align="right">
                            <TextField
                              type="number"
                              size="small"
                              variant="standard"
                              inputProps={{ min: 0 }}
                              value={row.recibida}
                              onChange={(e) => {
                                const value = Number(e.target.value || 0);
                                setRealRows((prev) =>
                                  prev.map((r) =>
                                    r.itemId === row.itemId ? { ...r, recibida: value } : r
                                  )
                                );
                              }}
                            />
                          </TableCell>
                          <TableCell align="right">{faltante}</TableCell>
                          <TableCell align="right">{excedente}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>

                <Box mt={2}>
                  <Typography variant="body2">
                    Total solicitada: {resumenReal.totalSolicitada} · Total recibida:{" "}
                    {resumenReal.totalRecibida} · Faltante: {resumenReal.totalFaltante} ·
                    Excedente: {resumenReal.totalExcedente}
                  </Typography>
                </Box>

                <Box mt={2} display="flex" alignItems="center" gap={1}>
                  <Chip
                    size="small"
                    color={finalizar ? "success" : "default"}
                    label={
                      finalizar ? "Se finalizará el pedido" : "Se mantendrá abierto"
                    }
                  />
                </Box>
              </Box>
            </>
          )}
        </DialogContent>

        <DialogActions>
          {pedidoRealDetalle && (
            <Link href={`/dynedu/tracking?pedidoId=${pedidoRealDetalle.pedido.id}#historial`}>
              <Button variant="outlined">Cancelar</Button>
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
