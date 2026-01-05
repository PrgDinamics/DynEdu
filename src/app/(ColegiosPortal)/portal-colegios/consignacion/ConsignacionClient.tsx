"use client";

import React, { useMemo, useState } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  IconButton,
  InputAdornment,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import Autocomplete from "@mui/material/Autocomplete";
import { createConsignacionAction } from "@/app/(PrgDinamics)/dynedu/(panel)/consignaciones/actions";
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
} from "lucide-react";

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
};

const ConsignacionClient: React.FC<Props> = ({ colegioId, productos }) => {
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

  const summary = useMemo(() => {
    const valid = rows.filter((r) => r.productoId && r.cantidad && Number(r.cantidad) > 0);
    const totalUnits = valid.reduce((acc, r) => acc + Number(r.cantidad), 0);
    return { items: valid.length, totalUnits };
  }, [rows]);

  const handleAddRow = () => {
    setRows((prev) => [...prev, { productoId: "", cantidad: "" }]);
  };

  const handleRemoveRow = (index: number) => {
    setRows((prev) => prev.filter((_, i) => i !== index));
  };

  const handleChangeRow = (
    index: number,
    field: keyof ConsignacionRow,
    value: string
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
                  : (value as any),
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

      const result = await createConsignacionAction({
        colegioId,
        fechaSalida,
        observaciones: observaciones || undefined,
        items: validItems,
      });

      if (!result.success) {
        setError(result.error ?? "No se pudo registrar la consignación.");
      } else {
        setMessage("Consignación registrada correctamente.");
        setRows([{ productoId: "", cantidad: "" }]);
        setObservaciones("");
      }
    } catch (err) {
      console.error("[ConsignacionClient] submit error:", err);
      setError("Ocurrió un error inesperado al registrar la consignación.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card sx={{ borderRadius: 3 }}>
      <CardContent>
        <Stack spacing={3}>
          {/* Summary */}
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
              <Box
                sx={{
                  px: 1.4,
                  py: 0.6,
                  borderRadius: 999,
                  border: "1px solid rgba(255,255,255,0.14)",
                  bgcolor: "rgba(255,255,255,0.08)",
                }}
              >
                <Typography variant="caption" sx={{ opacity: 0.9 }}>
                  Items: <b>{summary.items}</b>
                </Typography>
              </Box>

              <Box
                sx={{
                  px: 1.4,
                  py: 0.6,
                  borderRadius: 999,
                  border: "1px solid rgba(255,255,255,0.14)",
                  bgcolor: "rgba(255,255,255,0.08)",
                }}
              >
                <Typography variant="caption" sx={{ opacity: 0.9 }}>
                  Total unidades: <b>{summary.totalUnits}</b>
                </Typography>
              </Box>
            </Stack>
          </Stack>

          {/* Top fields */}
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField
              type="date"
              label="Fecha de salida"
              size="small"
              fullWidth
              value={fechaSalida}
              onChange={(e) => setFechaSalida(e.target.value)}
              InputLabelProps={{ shrink: true }}
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
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <StickyNote size={18} />
                  </InputAdornment>
                ),
              }}
            />
          </Stack>

          {/* Rows */}
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
                          newValue ? String(newValue.id) : ""
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
              sx={{ mt: 2 }}
              variant="outlined"
              onClick={handleAddRow}
              startIcon={<Plus size={18} />}
            >
              Agregar libro
            </Button>
          </Box>

          {/* Feedback */}
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
              <Typography color="success.main" variant="body2">
                {message}
              </Typography>
            </Stack>
          )}

          {/* Submit */}
          <Box>
            <Button
              variant="contained"
              onClick={handleSubmit}
              disabled={submitting}
              startIcon={<Save size={18} />}
            >
              {submitting ? "Guardando..." : "Registrar consignación"}
            </Button>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
};

export default ConsignacionClient;
