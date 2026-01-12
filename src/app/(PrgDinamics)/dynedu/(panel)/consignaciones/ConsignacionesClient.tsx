"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import {
  Box,
  Button,
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

import { SectionCard } from "../components/forms/SectionCard";
import { useSearchAndPagination } from "@/modules/dynedu/hooks/useSearchAndPagination";

import type { ConsignacionWithItems } from "./actions";
import {
  approveConsignacionAction,
  denyConsignacionAction,
  updateConsignacionSolicitudAction,
  updateConsignacionAbiertaAction,
  closeConsignacionAction,
} from "./actions";

type EstadoUI = "ALL" | "PENDIENTE" | "ABIERTA" | "CERRADA" | "ANULADA";

function getActionError(res: any): string | undefined {
  if (!res) return "No se pudo completar la acción.";
  if (typeof res === "string") return res;
  if (typeof res.error === "string" && res.error.trim()) return res.error;
  if (typeof res.message === "string" && res.message.trim()) return res.message;
  return undefined;
}

function formatDateTimeLima(iso: string | null | undefined) {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("es-PE", {
      dateStyle: "short",
      timeStyle: "short",
      timeZone: "America/Lima",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function clampInt(n: any, min: number, max: number) {
  const v = Math.floor(Number(n || 0));
  if (Number.isNaN(v)) return min;
  return Math.max(min, Math.min(max, v));
}

type ToastState =
  | { type: "success"; text: string }
  | { type: "error"; text: string }
  | null;

function ConsignacionesClientInner({ consignaciones }: { consignaciones: ConsignacionWithItems[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [tab, setTab] = useState<EstadoUI>("ALL");
  const [selected, setSelected] = useState<ConsignacionWithItems | null>(null);
  const [toast, setToast] = useState<ToastState>(null);

  // --- Edición PENDIENTE ---
  const [editComentario, setEditComentario] = useState<string>("");
  const [editFechaEntrega, setEditFechaEntrega] = useState<string>("");
  const [approvedByItemId, setApprovedByItemId] = useState<Record<number, number>>({});

  // --- Edición ABIERTA ---
  const [openComentario, setOpenComentario] = useState<string>("");
  const [openFechaEntrega, setOpenFechaEntrega] = useState<string>("");
  const [openDevByItemId, setOpenDevByItemId] = useState<Record<number, number>>({});
  const [openSoldByItemId, setOpenSoldByItemId] = useState<Record<number, number>>({});

  // -------------------------------
  // Filtros + paginación
  // -------------------------------
  const filteredByTab = useMemo(() => {
    if (tab === "ALL") return consignaciones;
    return consignaciones.filter((c) => c.estado === tab);
  }, [consignaciones, tab]);

  const {
    searchTerm,
    setSearchTerm,
    page,
    setPage,
    rowsPerPage,
    filteredData,
    paginatedData,
  } = useSearchAndPagination<ConsignacionWithItems>({
    data: filteredByTab,
    rowsPerPage: 10,
    sortFn: (a, b) => b.id - a.id,
    filterFn: (c, q) => {
      const term = q.toLowerCase();
      const colegio = (c.colegio?.nombre_comercial || c.colegio?.razon_social || "").toLowerCase();
      return (
        (c.codigo || "").toLowerCase().includes(term) ||
        colegio.includes(term) ||
        (c.estado || "").toLowerCase().includes(term)
      );
    },
  });

  // -------------------------------
  // Sync de estados al seleccionar
  // -------------------------------
  useEffect(() => {
    if (!selected) return;

    if (selected.estado === "PENDIENTE") {
      setEditComentario(selected.admin_comentario || "");
      setEditFechaEntrega(selected.fecha_entrega ? selected.fecha_entrega.slice(0, 10) : "");
      const map: Record<number, number> = {};
      (selected.items || []).forEach((it) => {
        const base = Number(it.cantidad_aprobada ?? it.cantidad ?? 0);
        map[it.id] = Number.isFinite(base) ? base : 0;
      });
      setApprovedByItemId(map);
    }

    if (selected.estado === "ABIERTA") {
      setOpenComentario(selected.admin_comentario || "");
      setOpenFechaEntrega(selected.fecha_entrega ? selected.fecha_entrega.slice(0, 10) : "");
      const devMap: Record<number, number> = {};
      const soldMap: Record<number, number> = {};
      (selected.items || []).forEach((it) => {
        devMap[it.id] = Number(it.cantidad_devuelta ?? 0);
        soldMap[it.id] = Number(it.cantidad_vendida ?? 0);
      });
      setOpenDevByItemId(devMap);
      setOpenSoldByItemId(soldMap);
    }
  }, [selected]);

  // -------------------------------
  // Totales (para UI)
  // -------------------------------
  const totalsForSelected = useMemo(() => {
    if (!selected) return { items: 0, unidades: 0 };
    const items = selected.items?.length ?? 0;

    // En PENDIENTE mostramos unidades "aprobadas" en edición
    if (selected.estado === "PENDIENTE") {
      const unidades = (selected.items || []).reduce((sum, it) => sum + (approvedByItemId[it.id] ?? Number(it.cantidad ?? 0)), 0);
      return { items, unidades };
    }

    // En ABIERTA mostramos unidades enviadas (aprobadas si existe)
    const unidades = (selected.items || []).reduce((sum, it) => sum + Number(it.cantidad_aprobada ?? it.cantidad ?? 0), 0);
    return { items, unidades };
  }, [selected, approvedByItemId]);

  const totalsOpen = useMemo(() => {
    if (!selected || selected.estado !== "ABIERTA") return null;

    const enviada = (selected.items || []).reduce((s, it) => s + Number(it.cantidad_aprobada ?? it.cantidad ?? 0), 0);
    const devuelta = (selected.items || []).reduce((s, it) => s + Number(openDevByItemId[it.id] ?? it.cantidad_devuelta ?? 0), 0);
    const vendida = (selected.items || []).reduce((s, it) => s + Number(openSoldByItemId[it.id] ?? it.cantidad_vendida ?? 0), 0);
    const pendiente = Math.max(0, enviada - devuelta - vendida);
    return { enviada, devuelta, vendida, pendiente };
  }, [selected, openDevByItemId, openSoldByItemId]);

  // -------------------------------
  // Acciones
  // -------------------------------
  function openDetail(c: ConsignacionWithItems) {
    setToast(null);
    setSelected(c);
  }

  function closeDetail() {
    setSelected(null);
    setToast(null);
  }

  function handleSavePending() {
    if (!selected) return;
    const payload = {
      consignacionId: selected.id,
      fechaEntrega: editFechaEntrega || null,
      comentarioAdmin: editComentario || null,
      items: (selected.items || []).map((it) => ({
        itemId: it.id,
        cantidadAprobada: approvedByItemId[it.id] ?? Number(it.cantidad ?? 0),
      })),
    };

    setToast(null);
    startTransition(async () => {
      const res = await updateConsignacionSolicitudAction(payload as any);
      if (!res?.success) {
        setToast({ type: "error", text: getActionError(res) || "No se pudieron guardar cambios." });
        return;
      }
      setToast({ type: "success", text: "Cambios guardados (sigue PENDIENTE)." });
      router.refresh();
    });
  }

  function handleApprove() {
    if (!selected) return;

    const payload = {
      consignacionId: selected.id,
      fechaEntrega: editFechaEntrega || null,
      comentarioAdmin: editComentario || null,
      items: (selected.items || []).map((it) => ({
        itemId: it.id,
        cantidadAprobada: approvedByItemId[it.id] ?? Number(it.cantidad ?? 0),
      })),
    };

    setToast(null);
    startTransition(async () => {
      const res = await approveConsignacionAction(payload as any);
      if (!res?.success) {
        setToast({ type: "error", text: getActionError(res) || "No se pudo aprobar." });
        return;
      }
      setToast({ type: "success", text: "Consignación aprobada (ABIERTA) y stock actualizado." });
      router.refresh();
    });
  }

  function handleDeny() {
    if (!selected) return;
    const reason = (editComentario || "").trim();

    setToast(null);
    startTransition(async () => {
      const res = await denyConsignacionAction({
        consignacionId: selected.id,
        comentarioAdmin: reason || null,
      } as any);

      if (!res?.success) {
        setToast({ type: "error", text: getActionError(res) || "No se pudo denegar." });
        return;
      }
      setToast({ type: "success", text: "Consignación denegada (ANULADA)." });
      router.refresh();
    });
  }

  function handleSaveOpen() {
    if (!selected || selected.estado !== "ABIERTA") return;

    const itemsPayload = (selected.items || []).map((it) => ({
      itemId: it.id,
      cantidadDevuelta: Number(openDevByItemId[it.id] ?? it.cantidad_devuelta ?? 0),
      cantidadVendida: Number(openSoldByItemId[it.id] ?? it.cantidad_vendida ?? 0),
    }));

    setToast(null);
    startTransition(async () => {
      const res = await updateConsignacionAbiertaAction({
        consignacionId: selected.id,
        fechaEntrega: openFechaEntrega || null,
        comentarioAdmin: openComentario || null,
        items: itemsPayload,
      } as any);

      if (!res?.success) {
        setToast({ type: "error", text: getActionError(res) || "No se pudieron guardar cambios." });
        return;
      }

      setToast({ type: "success", text: "Cambios guardados (ABIERTA)." });
      router.refresh();
    });
  }

  function handleCloseOpen() {
    if (!selected || selected.estado !== "ABIERTA") return;

    setToast(null);
    startTransition(async () => {
      // 1) Guardar cambios antes de cerrar
      const itemsPayload = (selected.items || []).map((it) => ({
        itemId: it.id,
        cantidadDevuelta: Number(openDevByItemId[it.id] ?? it.cantidad_devuelta ?? 0),
        cantidadVendida: Number(openSoldByItemId[it.id] ?? it.cantidad_vendida ?? 0),
      }));

      const saveRes = await updateConsignacionAbiertaAction({
        consignacionId: selected.id,
        fechaEntrega: openFechaEntrega || null,
        comentarioAdmin: openComentario || null,
        items: itemsPayload,
      } as any);

      if (!saveRes?.success) {
        setToast({ type: "error", text: getActionError(saveRes) || "No se pudieron guardar cambios." });
        return;
      }

      // 2) Cerrar (valida que vendida+devuelta == enviada)
      const closeRes = await closeConsignacionAction(selected.id);
      if (!closeRes?.success) {
        setToast({ type: "error", text: getActionError(closeRes) || "No se pudo cerrar." });
        return;
      }

      setToast({ type: "success", text: "Consignación cerrada." });
      router.refresh();
    });
  }

  function getStatusColor(estado: string) {
    switch (estado) {
      case "PENDIENTE":
        return "info";
      case "ABIERTA":
        return "warning";
      case "CERRADA":
        return "success";
      case "ANULADA":
        return "error";
      default:
        return "default";
    }
  }

  const counts = useMemo(() => {
    const c = {
      ALL: consignaciones.length,
      PENDIENTE: consignaciones.filter((x) => x.estado === "PENDIENTE").length,
      ABIERTA: consignaciones.filter((x) => x.estado === "ABIERTA").length,
      CERRADA: consignaciones.filter((x) => x.estado === "CERRADA").length,
      ANULADA: consignaciones.filter((x) => x.estado === "ANULADA").length,
    };
    return c;
  }, [consignaciones]);

  return (
    <Box>
      <Typography variant="h4" mb={2}>
        Consignaciones
      </Typography>

      <Stack direction="row" spacing={1} mb={2} flexWrap="wrap">
        <Button variant={tab === "ALL" ? "contained" : "outlined"} onClick={() => setTab("ALL")}>
          Todos ({counts.ALL})
        </Button>
        <Button variant={tab === "PENDIENTE" ? "contained" : "outlined"} onClick={() => setTab("PENDIENTE")}>
          Pendiente ({counts.PENDIENTE})
        </Button>
        <Button variant={tab === "ABIERTA" ? "contained" : "outlined"} onClick={() => setTab("ABIERTA")}>
          Abierta ({counts.ABIERTA})
        </Button>
        <Button variant={tab === "CERRADA" ? "contained" : "outlined"} onClick={() => setTab("CERRADA")}>
          Cerrada ({counts.CERRADA})
        </Button>
        <Button variant={tab === "ANULADA" ? "contained" : "outlined"} onClick={() => setTab("ANULADA")}>
          Anulada ({counts.ANULADA})
        </Button>
      </Stack>

      <SectionCard title="Listado de consignaciones" subtitle="Las solicitudes del portal entran como PENDIENTE y se aplican al aprobar.">
        <Stack direction={{ xs: "column", md: "row" }} spacing={2} justifyContent="space-between" alignItems={{ xs: "stretch", md: "center" }} mb={2}>
          <Typography variant="body2" color="text.secondary">
            {filteredData.length} consignación(es)
          </Typography>

          <TextField
            size="small"
            placeholder="Buscar"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPage(0);
            }}
            sx={{ maxWidth: 320 }}
          />
        </Stack>

        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Código</TableCell>
              <TableCell>Colegio</TableCell>
              <TableCell>Fecha salida</TableCell>
              <TableCell>Estado</TableCell>
              <TableCell align="right">Items</TableCell>
              <TableCell align="right">Unidades</TableCell>
              <TableCell align="right">Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {paginatedData.map((c) => (
              <TableRow key={c.id} hover>
                <TableCell>
                  <strong>{c.codigo}</strong>
                </TableCell>
                <TableCell>
                  <Typography variant="body2">
                    {c.colegio?.nombre_comercial || c.colegio?.razon_social || "—"}
                  </Typography>
                  {c.colegio?.ruc ? (
                    <Typography variant="caption" color="text.secondary">
                      RUC: {c.colegio.ruc}
                    </Typography>
                  ) : null}
                </TableCell>
                <TableCell>{formatDateTimeLima(c.fecha_salida)}</TableCell>
                <TableCell>
                  <Chip size="small" color={getStatusColor(c.estado) as any} label={c.estado} />
                </TableCell>
                <TableCell align="right">{c.totals?.totalItems ?? c.items?.length ?? 0}</TableCell>
                <TableCell align="right">{c.totals?.totalUnits ?? 0}</TableCell>
                <TableCell align="right">
                  <Button size="small" variant="outlined" onClick={() => openDetail(c)}>
                    Ver detalle
                  </Button>
                </TableCell>
              </TableRow>
            ))}

            {!paginatedData.length ? (
              <TableRow>
                <TableCell colSpan={7}>
                  <Typography variant="body2" color="text.secondary">
                    No hay consignaciones para mostrar.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>

        {filteredData.length > rowsPerPage ? (
          <Box mt={2} display="flex" justifyContent="flex-end" alignItems="center" gap={1}>
            <Typography variant="caption" color="text.secondary">
              Página {page + 1} de {Math.max(1, Math.ceil(filteredData.length / rowsPerPage))}
            </Typography>

            <Button size="small" variant="outlined" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
              Anterior
            </Button>
            <Button
              size="small"
              variant="outlined"
              disabled={page + 1 >= Math.max(1, Math.ceil(filteredData.length / rowsPerPage))}
              onClick={() => setPage((p) => (p + 1 < Math.max(1, Math.ceil(filteredData.length / rowsPerPage)) ? p + 1 : p))}
            >
              Siguiente
            </Button>
          </Box>
        ) : null}
      </SectionCard>

      <Dialog open={Boolean(selected)} onClose={closeDetail} maxWidth="lg" fullWidth>
        <DialogTitle>Detalle de consignación</DialogTitle>

        <DialogContent dividers>
          {selected ? (
            <Box>
              <Typography variant="body2" sx={{ mb: 0.5 }}>
                Código: <strong>{selected.codigo}</strong>
              </Typography>
              <Typography variant="body2" sx={{ mb: 0.5 }}>
                Colegio: <strong>{selected.colegio?.nombre_comercial || selected.colegio?.razon_social || "—"}</strong>
              </Typography>
              <Typography variant="body2" sx={{ mb: 0.5 }}>
                Fecha salida: {formatDateTimeLima(selected.fecha_salida)}
              </Typography>

              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" sx={{ mb: 1 }}>
                <Chip size="small" color={getStatusColor(selected.estado) as any} label={selected.estado} />
                {selected.fecha_entrega ? (
                  <Chip size="small" variant="outlined" label={`Entrega: ${formatDateTimeLima(selected.fecha_entrega)}`} />
                ) : null}
              </Stack>

              {selected.admin_comentario ? (
                <Typography variant="body2" sx={{ mb: 1 }}>
                  <strong>Comentario admin:</strong> {selected.admin_comentario}
                </Typography>
              ) : null}

              {/* Edición según estado */}
              {selected.estado === "PENDIENTE" ? (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    Aprobación / ajustes (PENDIENTE)
                  </Typography>

                  <Stack direction={{ xs: "column", md: "row" }} spacing={2} sx={{ mb: 1 }}>
                    <TextField
                      label="Fecha de entrega (opcional)"
                      type="date"
                      value={editFechaEntrega}
                      onChange={(e) => setEditFechaEntrega(e.target.value)}
                      InputLabelProps={{ shrink: true }}
                      fullWidth
                    />
                    <TextField
                      label="Comentario (visible para el colegio)"
                      value={editComentario}
                      onChange={(e) => setEditComentario(e.target.value)}
                      fullWidth
                    />
                  </Stack>

                  <Typography variant="caption" color="text.secondary">
                    Tip: puedes aprobar menos unidades que las solicitadas y explicar el motivo en el comentario.
                  </Typography>
                </Box>
              ) : null}

              {selected.estado === "ABIERTA" ? (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    Gestión de consignación (ABIERTA)
                  </Typography>

                  <Stack direction={{ xs: "column", md: "row" }} spacing={2} sx={{ mb: 1 }}>
                    <TextField
                      label="Fecha de entrega (opcional)"
                      type="date"
                      value={openFechaEntrega}
                      onChange={(e) => setOpenFechaEntrega(e.target.value)}
                      InputLabelProps={{ shrink: true }}
                      fullWidth
                    />
                    <TextField
                      label="Comentario (visible para el colegio)"
                      value={openComentario}
                      onChange={(e) => setOpenComentario(e.target.value)}
                      fullWidth
                    />
                  </Stack>

                  {totalsOpen ? (
                    <Stack direction="row" spacing={1} flexWrap="wrap">
                      <Chip size="small" variant="outlined" label={`Enviada: ${totalsOpen.enviada}`} />
                      <Chip size="small" variant="outlined" label={`Devuelta: ${totalsOpen.devuelta}`} />
                      <Chip size="small" variant="outlined" label={`Vendida: ${totalsOpen.vendida}`} />
                      <Chip size="small" color={totalsOpen.pendiente === 0 ? "success" : "warning"} label={`Pendiente: ${totalsOpen.pendiente}`} />
                    </Stack>
                  ) : null}

                  <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
                    Para cerrar, cada item debe tener: <strong>Devuelta + Vendida = Enviada</strong>.
                  </Typography>
                </Box>
              ) : null}

              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Código</TableCell>
                    <TableCell>Descripción</TableCell>

                    {selected.estado === "PENDIENTE" ? (
                      <>
                        <TableCell align="right">Solicitada</TableCell>
                        <TableCell align="right">Aprobar</TableCell>
                      </>
                    ) : selected.estado === "ABIERTA" ? (
                      <>
                        <TableCell align="right">Enviada</TableCell>
                        <TableCell align="right">Devuelta</TableCell>
                        <TableCell align="right">Vendida</TableCell>
                      </>
                    ) : (
                      <>
                        <TableCell align="right">Enviada</TableCell>
                        <TableCell align="right">Devuelta</TableCell>
                        <TableCell align="right">Vendida</TableCell>
                      </>
                    )}
                  </TableRow>
                </TableHead>

                <TableBody>
                  {(selected.items || []).map((it) => {
                    const codigo = it.product?.internal_id || "—";
                    const desc = it.product?.descripcion || "—";

                    const solicitada = Number(it.cantidad ?? 0);
                    const enviada = Number(it.cantidad_aprobada ?? it.cantidad ?? 0);

                    if (selected.estado === "PENDIENTE") {
                      const aprobada = approvedByItemId[it.id] ?? solicitada;
                      return (
                        <TableRow key={it.id}>
                          <TableCell>{codigo}</TableCell>
                          <TableCell>{desc}</TableCell>
                          <TableCell align="right">{solicitada}</TableCell>
                          <TableCell align="right">
                            <TextField
                              type="number"
                              size="small"
                              variant="standard"
                              inputProps={{ min: 0 }}
                              value={aprobada}
                              onChange={(e) => {
                                const next = clampInt(e.target.value, 0, 999999);
                                setApprovedByItemId((prev) => ({ ...prev, [it.id]: next }));
                              }}
                              sx={{ width: 80 }}
                            />
                          </TableCell>
                        </TableRow>
                      );
                    }

                    if (selected.estado === "ABIERTA") {
                      const dev = Number(openDevByItemId[it.id] ?? it.cantidad_devuelta ?? 0);
                      const ven = Number(openSoldByItemId[it.id] ?? it.cantidad_vendida ?? 0);

                      return (
                        <TableRow key={it.id}>
                          <TableCell>{codigo}</TableCell>
                          <TableCell>{desc}</TableCell>
                          <TableCell align="right">{enviada}</TableCell>
                          <TableCell align="right">
                            <TextField
                              type="number"
                              size="small"
                              variant="standard"
                              inputProps={{ min: 0 }}
                              value={dev}
                              onChange={(e) => {
                                const max = Math.max(0, enviada - ven);
                                const next = clampInt(e.target.value, 0, max);
                                setOpenDevByItemId((prev) => ({ ...prev, [it.id]: next }));
                              }}
                              sx={{ width: 80 }}
                            />
                          </TableCell>
                          <TableCell align="right">
                            <TextField
                              type="number"
                              size="small"
                              variant="standard"
                              inputProps={{ min: 0 }}
                              value={ven}
                              onChange={(e) => {
                                const max = Math.max(0, enviada - dev);
                                const next = clampInt(e.target.value, 0, max);
                                setOpenSoldByItemId((prev) => ({ ...prev, [it.id]: next }));
                              }}
                              sx={{ width: 80 }}
                            />
                          </TableCell>
                        </TableRow>
                      );
                    }

                    // CERRADA / ANULADA: solo lectura
                    return (
                      <TableRow key={it.id}>
                        <TableCell>{codigo}</TableCell>
                        <TableCell>{desc}</TableCell>
                        <TableCell align="right">{enviada}</TableCell>
                        <TableCell align="right">{Number(it.cantidad_devuelta ?? 0)}</TableCell>
                        <TableCell align="right">{Number(it.cantidad_vendida ?? 0)}</TableCell>
                      </TableRow>
                    );
                  })}

                  {(selected.items || []).length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5}>
                        <Typography variant="body2" color="text.secondary">
                          Sin items.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>

              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
                Totales — Items: {totalsForSelected.items} · Unidades: {totalsForSelected.unidades}
              </Typography>

              {selected.estado === "PENDIENTE" ? (
                <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
                  Esta consignación fue enviada desde el portal y está pendiente de aprobación. Al aprobar, pasará a ABIERTA y aplicará salida de stock.
                </Typography>
              ) : null}

              {toast ? (
                <Box mt={2}>
                  <Typography variant="body2" color={toast.type === "error" ? "error" : "success.main"}>
                    {toast.text}
                  </Typography>
                </Box>
              ) : null}
            </Box>
          ) : null}
        </DialogContent>

        <DialogActions>
          <Button variant="outlined" onClick={closeDetail} disabled={isPending}>
            Cerrar
          </Button>

          {selected?.estado === "PENDIENTE" ? (
            <>
              <Button onClick={handleSavePending} variant="outlined" disabled={isPending}>
                Guardar cambios
              </Button>
              <Button onClick={handleDeny} variant="outlined" color="error" disabled={isPending}>
                Denegar
              </Button>
              <Button onClick={handleApprove} variant="contained" disabled={isPending}>
                Aprobar
              </Button>
            </>
          ) : null}

          {selected?.estado === "ABIERTA" ? (
            <>
              <Button onClick={handleSaveOpen} variant="outlined" disabled={isPending}>
                Guardar cambios
              </Button>
              <Button onClick={handleCloseOpen} variant="contained" color="success" disabled={isPending}>
                Cerrar consignación
              </Button>
            </>
          ) : null}
        </DialogActions>
      </Dialog>
    </Box>
  );
}

// Evitar hydration mismatch de MUI en App Router (render solo cliente)
const ConsignacionesClient = dynamic(() => Promise.resolve(ConsignacionesClientInner), {
  ssr: false,
});

export default ConsignacionesClient;
