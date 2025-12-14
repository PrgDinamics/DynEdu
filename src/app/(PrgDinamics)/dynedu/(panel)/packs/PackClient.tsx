"use client";

import React, { useMemo, useState, FormEvent } from "react";
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
  Stack,
  IconButton,
  Tooltip,
  InputAdornment,
  TablePagination,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from "@mui/material";
import Autocomplete from "@mui/material/Autocomplete";
import SearchIcon from "@mui/icons-material/Search";
import { IconPlus, IconTrash } from "@tabler/icons-react";

import { crearPack, eliminarPack } from "./actions";

type ProductoResumen = {
  id: number;
  internal_id: string;
  descripcion: string;
};

type PackItem = {
  producto_id: number;
  internal_id: string;
  descripcion: string;
};

type PackRow = {
  id: number;
  codigo?: string | null;
  internal_id?: string | null;
  nombre: string;
  descripcion?: string | null;
  items?: {
    productos: {
      internal_id: string;
      descripcion: string;
    };
  }[];
};

type PackClientProps = {
  initialPacks: PackRow[];
  productos: ProductoResumen[];
};

const PackClient: React.FC<PackClientProps> = ({
  initialPacks,
  productos,
}) => {
  const [packs, setPacks] = useState<PackRow[]>(initialPacks || []);

  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");

  // productos del pack (draft)
  const [items, setItems] = useState<PackItem[]>([]);

  // Autocomplete interno
  const [selectedProduct, setSelectedProduct] =
    useState<ProductoResumen | null>(null);
  const [productoInput, setProductoInput] = useState("");

  // búsqueda + paginación de packs registrados
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(5);

  // modal de confirmación (compartido crear / eliminar)
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState("");
  const [pendingAction, setPendingAction] = useState<() => Promise<void>>(
    () => async () => {}
  );
  const [loading, setLoading] = useState(false);

  // ---------------------------------------------------------------------------
  // Handlers productos del pack
  // ---------------------------------------------------------------------------

  const handleAddProduct = () => {
    if (!selectedProduct) return;

    // evita duplicados
    if (items.some((i) => i.producto_id === selectedProduct.id)) return;

    setItems((prev) => [
      ...prev,
      {
        producto_id: selectedProduct.id,
        internal_id: selectedProduct.internal_id,
        descripcion: selectedProduct.descripcion,
      },
    ]);

    // limpiar selector
    setSelectedProduct(null);
    setProductoInput("");
  };

  const handleRemoveItem = (producto_id: number) => {
    setItems((prev) => prev.filter((i) => i.producto_id !== producto_id));
  };

  // ---------------------------------------------------------------------------
  // Crear pack (lanza modal)
  // ---------------------------------------------------------------------------

  const prepareCrearPack = (e: FormEvent) => {
    e.preventDefault();

    if (!nombre.trim()) {
      alert("El nombre del pack es obligatorio.");
      return;
    }
    if (items.length === 0) {
      alert("Debes agregar al menos un producto al pack.");
      return;
    }

    const resumen = `${nombre.trim()} (${items.length} producto${
      items.length > 1 ? "s" : ""
    })`;

    const action = async () => {
      try {
        setLoading(true);

        const payload = {
          nombre: nombre.trim(),
          descripcion: descripcion.trim() || null,
          items: items.map((i) => ({
            producto_id: i.producto_id,
            cantidad: 1,
          })),
        };

        const nuevoPack: PackRow | null = await crearPack(payload);

        if (nuevoPack) {
          setPacks((prev) => [nuevoPack, ...prev]);
          setNombre("");
          setDescripcion("");
          setItems([]);
        }
      } catch (err) {
        console.error("[PackClient] error al crear pack", err);
        alert("Ocurrió un error al registrar el pack.");
      } finally {
        setLoading(false);
      }
    };

    setConfirmMessage(`¿Confirmas registrar el pack "${resumen}"?`);
    setPendingAction(() => action);
    setConfirmOpen(true);
  };

  // ---------------------------------------------------------------------------
  // Eliminar pack (también con modal)
  // ---------------------------------------------------------------------------

  const handleDeletePack = (pack: PackRow) => {
    const resumen = pack.codigo || pack.internal_id || pack.nombre;

    const action = async () => {
      try {
        setLoading(true);
        await eliminarPack(pack.id);
        setPacks((prev) => prev.filter((p) => p.id !== pack.id));
      } catch (err) {
        console.error("[PackClient] error al eliminar pack", err);
        alert("No se pudo eliminar el pack.");
      } finally {
        setLoading(false);
      }
    };

    setConfirmMessage(
      `¿Eliminar el pack "${resumen}"? Esta acción no se puede deshacer.`
    );
    setPendingAction(() => action);
    setConfirmOpen(true);
  };

  // ---------------------------------------------------------------------------
  // Confirm dialog handlers
  // ---------------------------------------------------------------------------

  const confirmarAccion = async () => {
    setConfirmOpen(false);
    await pendingAction();
  };

  const cancelarAccion = () => {
    setConfirmOpen(false);
  };

  const esEliminar = confirmMessage.toLowerCase().includes("eliminar");

  // ---------------------------------------------------------------------------
  // filtro + paginación packs
  // ---------------------------------------------------------------------------

  const packsFiltrados = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return packs;

    return packs.filter((p) => {
      const cod = (p.codigo ?? p.internal_id ?? "").toLowerCase();
      const nombrePack = p.nombre.toLowerCase();
      const desc = (p.descripcion ?? "").toLowerCase();

      return cod.includes(q) || nombrePack.includes(q) || desc.includes(q);
    });
  }, [packs, search]);

  const handleChangePage = (_: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setRowsPerPage(parseInt(e.target.value, 10));
    setPage(0);
  };

  const sliceStart = page * rowsPerPage;
  const sliceEnd = sliceStart + rowsPerPage;
  const paginaPacks = packsFiltrados.slice(sliceStart, sliceEnd);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <>
      {/* FORMULARIO DE PACK */}
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
          title={
            <Stack direction="row" alignItems="center" spacing={1}>
              <IconPlus size={18} />
              <Typography variant="subtitle1" fontWeight={600}>
                Registrar pack
              </Typography>
            </Stack>
          }
          subheader="Agrupa varios libros en un pack para asignarlos a colegios y pedidos."
        />

        <CardContent>
          <Box
            component="form"
            onSubmit={prepareCrearPack}
            sx={{ display: "flex", flexDirection: "column", gap: 2 }}
          >
            {/* Datos generales */}
            <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
              <TextField
                label="Nombre del pack"
                size="small"
                fullWidth
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
              />
              <TextField
                label="Descripción"
                size="small"
                fullWidth
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
              />
            </Stack>

            <Divider sx={{ my: 2 }} />

            {/* Productos del pack */}
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ fontWeight: 600 }}
            >
              Productos del pack
            </Typography>

            <Stack
              direction={{ xs: "column", md: "row" }}
              spacing={2}
              alignItems={{ xs: "stretch", md: "flex-end" }}
            >
              <Autocomplete
                size="small"
                fullWidth
                options={productos}
                value={selectedProduct}
                inputValue={productoInput}
                onChange={(_, newValue) => setSelectedProduct(newValue)}
                onInputChange={(_, newInput) => setProductoInput(newInput)}
                getOptionLabel={(option) =>
                  `${option.internal_id} — ${option.descripcion}`
                }
                ListboxProps={{ style: { maxHeight: 360 } }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Buscar producto"
                    placeholder="Código o nombre"
                  />
                )}
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
              />

              <Button
                type="button"
                variant="contained"
                startIcon={<IconPlus size={18} />}
                onClick={handleAddProduct}
                sx={{ height: 40, whiteSpace: "nowrap" }}
              >
                Agregar producto
              </Button>
            </Stack>

            {/* Tabla de productos agregados */}
            <Box mt={2}>
              {items.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  Aún no has agregado productos al pack.
                </Typography>
              ) : (
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Código</TableCell>
                      <TableCell>Producto</TableCell>
                      <TableCell width={80}>Cant.</TableCell>
                      <TableCell width={80} />
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {items.map((i) => (
                      <TableRow key={i.producto_id}>
                        <TableCell>{i.internal_id}</TableCell>
                        <TableCell>{i.descripcion}</TableCell>
                        <TableCell>1</TableCell>
                        <TableCell align="right">
                          <Tooltip title="Quitar del pack">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => handleRemoveItem(i.producto_id)}
                            >
                              <IconTrash size={16} />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </Box>

            {/* Botones alineados a la derecha */}
            <Stack
              direction="row"
              justifyContent="flex-end"
              spacing={1.5}
              mt={3}
            >
              <Button
                type="submit"
                variant="contained"
                startIcon={<IconPlus size={18} />}
                disabled={loading}
              >
                Registrar pack
              </Button>
            </Stack>
          </Box>
        </CardContent>
      </Card>

      {/* LISTA DE PACKS */}
      <Card
        elevation={0}
        sx={{
          borderRadius: 3,
          border: "1px solid",
          borderColor: "divider",
        }}
      >
        <CardHeader
          title={
            <Typography variant="subtitle1" fontWeight={600}>
              Packs registrados
            </Typography>
          }
          action={
            <TextField
              size="small"
              placeholder="Buscar por código o nombre..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
              }}
            />
          }
        />
        <CardContent>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Código</TableCell>
                <TableCell>Nombre</TableCell>
                <TableCell>Productos</TableCell>
                <TableCell>Descripción</TableCell>
                <TableCell align="center">Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {paginaPacks.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5}>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      align="center"
                    >
                      No hay packs registrados todavía.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                paginaPacks.map((pack) => (
                  <TableRow key={pack.id} hover>
                    <TableCell sx={{ fontWeight: 500 }}>
                      {pack.codigo ?? pack.internal_id ?? "—"}
                    </TableCell>
                    <TableCell>{pack.nombre}</TableCell>
                    <TableCell>
                      {pack.items && pack.items.length > 0 ? (
                        pack.items.map((i, idx) => (
                          <div key={`${pack.id}-${idx}`}>
                            {i.productos.internal_id} —{" "}
                            {i.productos.descripcion} × 1
                          </div>
                        ))
                      ) : (
                        <Typography
                          variant="body2"
                          color="text.secondary"
                        >
                          Sin productos
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>{pack.descripcion ?? ""}</TableCell>
                    <TableCell align="center">
                      <Tooltip title="Eliminar pack">
                        <IconButton
                          size="small"
                          sx={{ color: "error.main" }}
                          onClick={() => handleDeletePack(pack)}
                        >
                          <IconTrash size={18} />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          <TablePagination
            component="div"
            count={packsFiltrados.length}
            page={page}
            rowsPerPage={rowsPerPage}
            onPageChange={handleChangePage}
            onRowsPerPageChange={handleChangeRowsPerPage}
            labelRowsPerPage="Filas por página"
            labelDisplayedRows={({ from, to, count }) =>
              `${from}-${to} de ${count}`
            }
          />
        </CardContent>
      </Card>

      {/* MODAL CONFIRMACIÓN (CREAR / ELIMINAR) */}
      <Dialog open={confirmOpen} onClose={cancelarAccion}>
        <DialogTitle>
          {esEliminar ? "Confirmar eliminación" : "Confirmar acción"}
        </DialogTitle>
        <DialogContent>
          <Typography>{confirmMessage}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={cancelarAccion}>Cancelar</Button>
          <Button
            onClick={confirmarAccion}
            variant="contained"
            color={esEliminar ? "error" : "primary"}
            autoFocus
          >
            Aceptar
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default PackClient;
