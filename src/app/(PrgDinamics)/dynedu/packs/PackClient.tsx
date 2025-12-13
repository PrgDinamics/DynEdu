"use client";

import React, { useState } from "react";
import {
  Box,
  Card,
  CardHeader,
  CardContent,
  Typography,
  TextField,
  Button,
  Divider,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  IconButton,
  Tooltip,
} from "@mui/material";
import Autocomplete from "@mui/material/Autocomplete";
import { IconTrash, IconPlus } from "@tabler/icons-react";

import { crearPack, eliminarPack } from "./actions";

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

type ProductoResumen = {
  id: number;
  internal_id: string;
  descripcion: string;
};

type PackProductoRelacionado = {
  productos: {
    internal_id: string;
    descripcion: string;
  };
};

type PackRow = {
  id: number;
  codigo: string;
  nombre: string;
  descripcion?: string | null;
  items?: PackProductoRelacionado[];
};

type PackItemDraft = {
  producto_id: number;
  internal_id: string;
  descripcion: string;
};

type PackClientProps = {
  initialPacks: PackRow[];
  productos: ProductoResumen[];
};

// -----------------------------------------------------------------------------

export default function PackClient({
  initialPacks,
  productos,
}: PackClientProps) {
  const [packs, setPacks] = useState<PackRow[]>(initialPacks);

  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");

  const [items, setItems] = useState<PackItemDraft[]>([]);

  // Autocomplete: producto seleccionado + texto que escribes
  const [selectedProduct, setSelectedProduct] =
    useState<ProductoResumen | null>(null);
  const [productoInput, setProductoInput] = useState("");

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleAdd = () => {
    if (!selectedProduct) return;

    // Evitar duplicados
    if (items.some((i) => i.producto_id === selectedProduct.id)) return;

    setItems((prev) => [
      ...prev,
      {
        producto_id: selectedProduct.id,
        internal_id: selectedProduct.internal_id,
        descripcion: selectedProduct.descripcion,
      },
    ]);

    // Limpiar selección e input del Autocomplete
    setSelectedProduct(null);
    setProductoInput("");
  };

  const handleCrearPack = async () => {
    if (!nombre.trim() || items.length === 0) {
      alert("Debes ingresar un nombre y agregar al menos 1 producto.");
      return;
    }

    const datos = {
      nombre,
      descripcion,
      items: items.map((i) => ({
        producto_id: i.producto_id,
        cantidad: 1, // 1 unidad por producto dentro del pack
      })),
    };

    const nuevoPack = await crearPack(datos);

    setPacks((prev) => [nuevoPack, ...prev]);
    setNombre("");
    setDescripcion("");
    setItems([]);
  };

  const handleDelete = async (id: number) => {
    const ok = confirm("¿Seguro que deseas eliminar este pack?");
    if (!ok) return;

    await eliminarPack(id);
    setPacks((prev) => prev.filter((p) => p.id !== id));
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <Box sx={{ p: 4 }}>
      {/* Título principal */}
      <Typography variant="h4" fontWeight={700} mb={3}>
        Packs
      </Typography>

      {/* =================== CREACIÓN DE PACK =================== */}
      <Card sx={{ mb: 4, borderRadius: 3, boxShadow: 2 }}>
        <CardHeader title="Crear Pack" />
        <CardContent>
          {/* Nombre y descripción */}
          <Box
            sx={{
              display: "grid",
              gap: 2,
              gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
            }}
          >
            <TextField
              label="Nombre del pack"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              fullWidth
            />

            <TextField
              label="Descripción"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              fullWidth
            />
          </Box>

          <Divider sx={{ my: 3 }} />

          <Typography variant="subtitle1" fontWeight={600} mb={1}>
            Productos del Pack
          </Typography>

          {/* Autocomplete: buscar + seleccionar en un solo control */}
          <Box
            sx={{
              display: "flex",
              flexDirection: { xs: "column", md: "row" },
              gap: 2,
              alignItems: { xs: "stretch", md: "flex-end" },
            }}
          >
            <Autocomplete
              fullWidth
              size="small"
              options={productos}
              value={selectedProduct}
              inputValue={productoInput}
              onChange={(_, newValue) => setSelectedProduct(newValue)}
              onInputChange={(_, newInput) => setProductoInput(newInput)}
              getOptionLabel={(option) =>
                `${option.internal_id} — ${option.descripcion}`
              }
              ListboxProps={{
                style: { maxHeight: 360 },
              }}
              renderOption={(props, option) => (
                <li {...props} key={option.id}>
                  <Box>
                    <Typography variant="body2" fontWeight={500}>
                      {option.internal_id}
                    </Typography>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ display: "block" }}
                    >
                      {option.descripcion}
                    </Typography>
                  </Box>
                </li>
              )}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Buscar y seleccionar producto"
                  placeholder="Código o nombre"
                />
              )}
            />

            <Button
              variant="contained"
              startIcon={<IconPlus size={18} />}
              onClick={handleAdd}
              sx={{
                height: 40,
                alignSelf: { xs: "stretch", md: "center" },
                whiteSpace: "nowrap",
              }}
            >
              Agregar
            </Button>
          </Box>

          {/* Lista de productos agregados */}
          <Box mt={2}>
            {items.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                Todavía no has agregado productos al pack.
              </Typography>
            ) : (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>
                      <b>Código</b>
                    </TableCell>
                    <TableCell>
                      <b>Producto</b>
                    </TableCell>
                    <TableCell width={80}>
                      <b>Cant.</b>
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {items.map((i) => (
                    <TableRow key={i.producto_id}>
                      <TableCell>{i.internal_id}</TableCell>
                      <TableCell>{i.descripcion}</TableCell>
                      <TableCell>1</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Box>

          <Button
            variant="contained"
            color="primary"
            sx={{ mt: 3 }}
            onClick={handleCrearPack}
          >
            Crear Pack
          </Button>
        </CardContent>
      </Card>

      {/* =================== TABLA DE PACKS =================== */}
      <Card sx={{ borderRadius: 3, boxShadow: 2 }}>
        <CardHeader title="Packs Registrados" />
        <CardContent>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>
                  <b>Código</b>
                </TableCell>
                <TableCell>
                  <b>Nombre</b>
                </TableCell>
                <TableCell>
                  <b>Productos</b>
                </TableCell>
                <TableCell>
                  <b>Descripción</b>
                </TableCell>
                <TableCell>
                  <b>Acciones</b>
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {packs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center">
                    No hay packs registrados
                  </TableCell>
                </TableRow>
              ) : (
                packs.map((pack) => (
                  <TableRow key={pack.id} hover>
                    <TableCell>{pack.codigo}</TableCell>
                    <TableCell>{pack.nombre}</TableCell>
                    <TableCell>
                      {pack.items?.map((i, idx) => (
                        <div key={`${pack.id}-${idx}`}>
                          {i.productos.internal_id} — {i.productos.descripcion} × 1
                        </div>
                      ))}
                    </TableCell>
                    <TableCell>{pack.descripcion}</TableCell>
                    <TableCell>
                      <Tooltip title="Eliminar">
                        <IconButton
                          color="error"
                          onClick={() => handleDelete(pack.id)}
                        >
                          <IconTrash size={20} />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </Box>
  );
}
