"use client";

import React, { useState } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import Autocomplete from "@mui/material/Autocomplete";
import { createConsignacionAction } from "@/app/(PrgDinamics)/dynedu/(panel)/consignaciones/actions";

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
    new Date().toISOString().slice(0, 10) // YYYY-MM-DD
  );
  const [observaciones, setObservaciones] = useState<string>("");
  const [rows, setRows] = useState<ConsignacionRow[]>([
    { productoId: "", cantidad: "" },
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
        .filter((r) => r.productoId && r.cantidad && r.cantidad > 0)
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
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField
              type="date"
              label="Fecha de salida"
              size="small"
              fullWidth
              value={fechaSalida}
              onChange={(e) => setFechaSalida(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="Observaciones (opcional)"
              size="small"
              fullWidth
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
            />
          </Stack>

          <Box>
            <Typography variant="subtitle2" mb={1}>
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
                    {/* Autocomplete con búsqueda */}
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
                        />
                      )}
                      // Permite que escriban algo que no coincide y deje el valor vacío
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
                    />

                    {rows.length > 1 && (
                      <IconButton
                        aria-label="Eliminar fila"
                        onClick={() => handleRemoveRow(index)}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    )}
                  </Stack>
                );
              })}
            </Stack>

            <Button sx={{ mt: 2 }} variant="outlined" onClick={handleAddRow}>
              Agregar libro
            </Button>
          </Box>

          {error && (
            <Typography color="error" variant="body2">
              {error}
            </Typography>
          )}
          {message && (
            <Typography color="success.main" variant="body2">
              {message}
            </Typography>
          )}

          <Box>
            <Button
              variant="contained"
              onClick={handleSubmit}
              disabled={submitting}
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
