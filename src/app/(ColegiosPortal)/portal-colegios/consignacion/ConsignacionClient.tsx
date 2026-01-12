"use client";

import React, { useEffect, useMemo, useState } from "react";
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
  IconButton,
  InputAdornment,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import Autocomplete from "@mui/material/Autocomplete";

import { createPortalConsignacionSolicitudAction } from "./actions";

import {
  CalendarDays,
  StickyNote,
  BookOpen,
  Hash,
  Plus,
  Save,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  ClipboardList,
  Eye,
} from "lucide-react";

import type { PortalConsignacionRow } from "./page";

type ProductoBasic = {
  id: number;
  internal_id: string;
  descripcion: string;
};

type ConsignacionRow = {
  productoId: number | "";
  cantidad: number | "";
};

type Props = {
  colegioId: number;
  productos: ProductoBasic[];
  initialConsignaciones: PortalConsignacionRow[];
};

function getStatusColor(estado: string) {
  switch (estado) {
    case "PENDIENTE":
      return "info";
    case "ABIERTA":
      return "warning";
    case "CERRADA":
      return "success";
    default:
      return "default";
  }
}

function sumRequested(items: PortalConsignacionRow["items"]) {
  return items.reduce((acc, it) => acc + Number(it.cantidad ?? 0), 0);
}

function sumApproved(items: PortalConsignacionRow["items"]) {
  return items.reduce((acc, it) => acc + Number(it.cantidad_aprobada ?? 0), 0);
}

function fmtDate(value?: string | null) {
  if (!value) return "TBA";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    return value.includes("T") ? value.split("T")[0] : value;
  }
  return d.toLocaleDateString("es-PE");
}

const glassCardSx = {
  borderRadius: 3,
  backgroundColor: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.12)",
  backdropFilter: "blur(10px)",
  color: "rgba(255,255,255,0.92)",
};

const tableGlassSx = {
  "& .MuiTableCell-head": {
    color: "rgba(255,255,255,0.85)",
    borderColor: "rgba(255,255,255,0.14)",
    fontWeight: 900,
  },
  "& .MuiTableCell-body": {
    color: "rgba(255,255,255,0.92)",
    borderColor: "rgba(255,255,255,0.10)",
  },
  "& .MuiTableRow-root": {
    backgroundColor: "rgba(0,0,0,0.10)",
  },
  "& .MuiTableRow-root:hover": {
    backgroundColor: "rgba(255,255,255,0.06)",
  },
};

const darkFieldSx = {
  "& .MuiInputBase-root": {
    color: "rgba(255,255,255,0.92)",
    backgroundColor: "rgba(0,0,0,0.14)",
    borderRadius: 2,
  },
  "& .MuiInputLabel-root": {
    color: "rgba(255,255,255,0.75)",
  },
  "& .MuiOutlinedInput-notchedOutline": {
    borderColor: "rgba(255,255,255,0.18)",
  },
  "&:hover .MuiOutlinedInput-notchedOutline": {
    borderColor: "rgba(255,255,255,0.28)",
  },
  "& .MuiSvgIcon-root": {
    color: "rgba(255,255,255,0.75)",
  },
};

const ConsignacionClient: React.FC<Props> = ({
  colegioId,
  productos,
  initialConsignaciones,
}) => {
  const router = useRouter();

  // FORM
  const [fechaSalida, setFechaSalida] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [observaciones, setObservaciones] = useState<string>("");
  const [rows, setRows] = useState<ConsignacionRow[]>([
    { productoId: "", cantidad: "" },
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // TABLE
  const [myCons, setMyCons] = useState<PortalConsignacionRow[]>(
    initialConsignaciones
  );
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<PortalConsignacionRow | null>(null);

  useEffect(() => {
    setMyCons(initialConsignaciones);
  }, [initialConsignaciones]);

  const summary = useMemo(() => {
    const valid = rows.filter(
      (r) => r.productoId && r.cantidad && Number(r.cantidad) > 0
    );
    const totalUnits = valid.reduce((acc, r) => acc + Number(r.cantidad), 0);
    return { items: valid.length, totalUnits };
  }, [rows]);

  const filteredMyCons = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return myCons;

    return myCons.filter((c) => {
      const hay = [
        c.codigo,
        c.estado,
        c.fecha_salida,
        c.fecha_entrega ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(term);
    });
  }, [myCons, search]);

  const handleAddRow = () => {
    setRows((prev) => [...prev, { productoId: "", cantidad: "" }]);
  };

  const handleRemoveRow = (index: number) => {
    setRows((prev) => prev.filter((_, i) => i !== index));
  };

  const handleChangeRow = (
    index: number,
    field: keyof ConsignacionRow,
    value: number | "" | string
  ) => {
    setRows((prev) =>
      prev.map((row, i) =>
        i === index
          ? {
              ...row,
              [field]:
                field === "cantidad"
                  ? value === ""
                    ? ""
                    : Number(value)
                  : value === ""
                  ? ""
                  : Number(value),
            }
          : row
      )
    );
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setMessage(null);
    setError(null);

    try {
      const validItems = rows
        .filter((r) => r.productoId && r.cantidad && Number(r.cantidad) > 0)
        .map((r) => ({
          productoId: Number(r.productoId),
          cantidad: Number(r.cantidad),
        }));

      if (!validItems.length) {
        setError("Debe agregar al menos un libro con cantidad mayor a 0.");
        setSubmitting(false);
        return;
      }

      const result = await createPortalConsignacionSolicitudAction({
        colegioId,
        fechaSalida,
        observaciones: observaciones || undefined,
        items: validItems,
      });

      if (!result.success) {
        setError(result.error ?? "No se pudo enviar la solicitud.");
      } else {
        setMessage("Solicitud enviada. Estado: PENDIENTE DE APROBACIÓN.");
        setRows([{ productoId: "", cantidad: "" }]);
        setObservaciones("");

        // refresca server data para que se actualice la tabla
        router.refresh();
      }
    } catch (err) {
      console.error("[ConsignacionClient] submit error:", err);
      setError("Ocurrió un error inesperado al enviar la solicitud.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Stack spacing={3}>
      {/* FORM CARD */}
      <Card sx={glassCardSx}>
        <CardContent>
          <Stack spacing={3}>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={1.5}
              alignItems={{ xs: "flex-start", sm: "center" }}
              justifyContent="space-between"
            >
              <Stack direction="row" spacing={1.2} alignItems="center">
                <ClipboardList size={18} />
                <Typography variant="subtitle1" fontWeight={900}>
                  Registro de consignación
                </Typography>
              </Stack>

              <Stack direction="row" spacing={1} alignItems="center">
                <Chip
                  size="small"
                  label={`Items: ${summary.items}`}
                  sx={{
                    bgcolor: "rgba(255,255,255,0.08)",
                    color: "rgba(255,255,255,0.92)",
                    border: "1px solid rgba(255,255,255,0.14)",
                  }}
                />
                <Chip
                  size="small"
                  label={`Total unidades: ${summary.totalUnits}`}
                  sx={{
                    bgcolor: "rgba(255,255,255,0.08)",
                    color: "rgba(255,255,255,0.92)",
                    border: "1px solid rgba(255,255,255,0.14)",
                  }}
                />
              </Stack>
            </Stack>

            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField
                type="date"
                label="Fecha de salida"
                size="small"
                fullWidth
                value={fechaSalida}
                onChange={(e) => setFechaSalida(e.target.value)}
                InputLabelProps={{ shrink: true }}
                sx={darkFieldSx}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <CalendarDays size={18} />
                    </InputAdornment>
                  ),
                }}
              />

              <TextField
                label="Observaciones (opcional)"
                size="small"
                fullWidth
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                sx={darkFieldSx}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <StickyNote size={18} />
                    </InputAdornment>
                  ),
                }}
              />
            </Stack>

            <Box>
              <Typography variant="subtitle2" mb={1} fontWeight={900}>
                Libros en consignación
              </Typography>

              <Stack spacing={1.5}>
                {rows.map((row, index) => {
                  const selectedProducto =
                    typeof row.productoId === "number"
                      ? productos.find((p) => p.id === row.productoId) ?? null
                      : null;

                  return (
                    <Stack
                      key={index}
                      direction={{ xs: "column", sm: "row" }}
                      spacing={1}
                      alignItems={{ xs: "flex-start", sm: "center" }}
                    >
                      <Autocomplete
                        size="small"
                        fullWidth
                        options={productos}
                        value={selectedProducto}
                        onChange={(_, newValue) =>
                          handleChangeRow(
                            index,
                            "productoId",
                            newValue ? newValue.id : ""
                          )
                        }
                        getOptionLabel={(option) =>
                          `${option.internal_id} - ${option.descripcion}`
                        }
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            label="Producto"
                            placeholder="Buscar por código o nombre"
                            sx={darkFieldSx}
                            InputProps={{
                              ...params.InputProps,
                              startAdornment: (
                                <>
                                  <InputAdornment position="start">
                                    <BookOpen size={18} />
                                  </InputAdornment>
                                  {params.InputProps.startAdornment}
                                </>
                              ),
                            }}
                          />
                        )}
                        isOptionEqualToValue={(option, value) =>
                          option.id === value.id
                        }
                      />

                      <TextField
                        type="number"
                        size="small"
                        label="Cantidad"
                        fullWidth
                        value={row.cantidad}
                        onChange={(e) =>
                          handleChangeRow(index, "cantidad", e.target.value)
                        }
                        inputProps={{ min: 0 }}
                        sx={darkFieldSx}
                        InputProps={{
                          startAdornment: (
                            <InputAdornment position="start">
                              <Hash size={18} />
                            </InputAdornment>
                          ),
                        }}
                      />

                      {rows.length > 1 && (
                        <IconButton
                          aria-label="Eliminar fila"
                          onClick={() => handleRemoveRow(index)}
                          sx={{
                            borderRadius: 2,
                            border: "1px solid rgba(255,255,255,0.14)",
                            bgcolor: "rgba(255,255,255,0.06)",
                            color: "rgba(255,255,255,0.9)",
                          }}
                        >
                          <Trash2 size={18} />
                        </IconButton>
                      )}
                    </Stack>
                  );
                })}
              </Stack>

              <Button
                sx={{
                  mt: 2,
                  borderRadius: 2,
                  textTransform: "none",
                  fontWeight: 800,
                  borderColor: "rgba(255,255,255,0.22)",
                  color: "rgba(255,255,255,0.92)",
                }}
                variant="outlined"
                onClick={handleAddRow}
                startIcon={<Plus size={18} />}
              >
                Agregar libro
              </Button>
            </Box>

            {error && (
              <Stack direction="row" spacing={1} alignItems="center">
                <AlertTriangle size={18} />
                <Typography color="error" variant="body2">
                  {error}
                </Typography>
              </Stack>
            )}

            {message && (
              <Stack direction="row" spacing={1} alignItems="center">
                <CheckCircle2 size={18} />
                <Typography sx={{ color: "rgba(190,255,210,0.95)" }} variant="body2">
                  {message}
                </Typography>
              </Stack>
            )}

            <Box>
              <Button
                variant="contained"
                onClick={handleSubmit}
                disabled={submitting}
                startIcon={<Save size={18} />}
                sx={{
                  borderRadius: 2,
                  textTransform: "none",
                  fontWeight: 900,
                }}
              >
                {submitting ? "Enviando..." : "Registrar consignación"}
              </Button>
            </Box>
          </Stack>
        </CardContent>
      </Card>

      {/* TABLE CARD */}
      <Card sx={glassCardSx}>
        <CardContent>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1.5}
            alignItems={{ xs: "stretch", sm: "center" }}
            justifyContent="space-between"
            mb={2}
          >
            <Stack spacing={0.3}>
              <Typography variant="subtitle1" fontWeight={900}>
                Mis consignaciones
              </Typography>
              <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.70)" }}>
                Verás el estado y lo que se te entregará una vez aprobado por DynEdu.
              </Typography>
            </Stack>

            <TextField
              size="small"
              label="Buscar"
              placeholder="Código, estado, fechas..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              sx={{ minWidth: 260, ...darkFieldSx }}
            />
          </Stack>

          <Table size="small" sx={tableGlassSx}>
            <TableHead>
              <TableRow>
                <TableCell>Código</TableCell>
                <TableCell>Estado</TableCell>
                <TableCell>Fecha salida</TableCell>
                <TableCell>Fecha entrega</TableCell>
                <TableCell align="right">Pedir</TableCell>
                <TableCell align="right">Entregar</TableCell>
                <TableCell align="right">Acciones</TableCell>
              </TableRow>
            </TableHead>

            <TableBody>
              {filteredMyCons.map((c) => {
                const requested = sumRequested(c.items);
                const approved = sumApproved(c.items);

                return (
                  <TableRow key={c.id} hover>
                    <TableCell sx={{ fontWeight: 900 }}>{c.codigo}</TableCell>

                    <TableCell>
                      <Chip
                        size="small"
                        color={getStatusColor(c.estado)}
                        label={c.estado}
                        sx={{ fontWeight: 900 }}
                      />
                    </TableCell>

                    <TableCell>{fmtDate(c.fecha_salida)}</TableCell>
                    <TableCell>{fmtDate(c.fecha_entrega)}</TableCell>

                    <TableCell align="right">{requested}</TableCell>

                    <TableCell align="right">
                      {c.estado === "PENDIENTE" ? "—" : approved}
                    </TableCell>

                    <TableCell align="right">
                      <Button
                        size="small"
                        variant="contained"
                        startIcon={<Eye size={16} />}
                        onClick={() => setSelected(c)}
                        sx={{
                          textTransform: "none",
                          borderRadius: 2,
                          fontWeight: 900,
                        }}
                      >
                        Ver detalle
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}

              {filteredMyCons.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7}>
                    <Typography
                      variant="body2"
                      sx={{ color: "rgba(255,255,255,0.70)" }}
                    >
                      Aún no hay consignaciones registradas (o no coincide la búsqueda).
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* DETAIL MODAL */}
      <Dialog
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Detalle de consignación</DialogTitle>

        <DialogContent dividers>
          {selected ? (
            <>
              <Stack spacing={0.8} sx={{ mb: 2 }}>
                <Typography variant="subtitle2">
                  Código: <strong>{selected.codigo}</strong>
                </Typography>

                {/* ✅ FIX: no Chip dentro de Typography (p) */}
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography variant="body2" component="span">
                    Estado:
                  </Typography>
                  <Chip
                    component="span"
                    size="small"
                    color={getStatusColor(selected.estado)}
                    label={selected.estado}
                    sx={{ fontWeight: 900 }}
                  />
                </Stack>

                <Typography variant="body2">
                  Fecha salida: <strong>{fmtDate(selected.fecha_salida)}</strong>
                </Typography>

                <Typography variant="body2">
                  Fecha entrega: <strong>{fmtDate(selected.fecha_entrega)}</strong>
                </Typography>
              </Stack>

              <Table size="small" sx={tableGlassSx}>
                <TableHead>
                  <TableRow>
                    <TableCell>Código</TableCell>
                    <TableCell>Descripción</TableCell>
                    <TableCell align="right">Pedido</TableCell>
                    <TableCell align="right">A entregar</TableCell>
                  </TableRow>
                </TableHead>

                <TableBody>
                  {selected.items.map((it) => (
                    <TableRow key={it.id} hover>
                      <TableCell sx={{ fontWeight: 900 }}>
                        {it.product?.internal_id || `#${it.producto_id}`}
                      </TableCell>
                      <TableCell>{it.product?.descripcion || "-"}</TableCell>
                      <TableCell align="right">{it.cantidad}</TableCell>
                      <TableCell align="right">
                        {selected.estado === "PENDIENTE"
                          ? "—"
                          : it.cantidad_aprobada ?? 0}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          ) : null}
        </DialogContent>

        <DialogActions>
          <Button onClick={() => setSelected(null)} variant="contained">
            Cerrar
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
};

export default ConsignacionClient;
