"use client";

import React, { useMemo, useState, FormEvent, useEffect } from "react";
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
  TablePagination,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
} from "@mui/material";
import Autocomplete from "@mui/material/Autocomplete";
import { IconPlus, IconTrash } from "@tabler/icons-react";

import NoAccess from "../components/error/NoAccess";
import ErrorDialog from "../components/error/ErrorDialog";
import { crearPack, eliminarPack } from "./actions";

type ProductoResumen = {
  id: string; // UUID
  internal_id: string;
  descripcion: string;
};

type PackItemDraft = {
  producto_id: string; // UUID
  internal_id: string;
  descripcion: string;
};

// ✅ Normaliza: a veces Supabase devuelve objeto, a veces array
type PackItemProduct = {
  internal_id: string;
  descripcion: string;
};

type PackItemRow = {
  id?: string;
  cantidad?: number | null;
  producto_id?: string | null;
  productos: PackItemProduct | PackItemProduct[] | null;
};

type PackRow = {
  id: string; // UUID
  codigo?: string | null;
  internal_id?: string | null;
  nombre: string;
  descripcion?: string | null;
  items?: PackItemRow[] | null;
};

type PackClientProps = {
  initialPacks: PackRow[];
  productos: ProductoResumen[];
};

type DyneduMe = {
  ok: boolean;
  user?: { permissions?: Record<string, boolean> };
};

const PackClient: React.FC<PackClientProps> = ({ initialPacks, productos }) => {
  const [packs, setPacks] = useState<PackRow[]>(initialPacks || []);

  // auth/permissions
  const [me, setMe] = useState<DyneduMe | null>(null);
  const permissions = me?.user?.permissions ?? {};
  const canManagePacks = permissions?.canManagePacks === true;
  const canViewPacks = permissions?.canViewPacks === true;

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const res = await fetch("/api/dynedu/me", { cache: "no-store" });
        if (!alive) return;

        if (!res.ok) {
          setMe({ ok: false });
          return;
        }

        const json = (await res.json()) as DyneduMe;
        setMe(json);
      } catch {
        setMe({ ok: false });
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  // basic form
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");

  const [items, setItems] = useState<PackItemDraft[]>([]);

  const [selectedProduct, setSelectedProduct] = useState<ProductoResumen | null>(
    null
  );
  const [productoInput, setProductoInput] = useState("");

  // search + pagination
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(5);

  // confirm modal
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState("");
  const [pendingAction, setPendingAction] = useState<() => Promise<void>>(
    () => async () => {}
  );

  const [loading, setLoading] = useState(false);

  // error modal
  const [errorOpen, setErrorOpen] = useState(false);
  const [errorTitle, setErrorTitle] = useState("Error");
  const [errorMessage, setErrorMessage] = useState("");

  const showError = (title: string, message: string) => {
    setErrorTitle(title);
    setErrorMessage(message);
    setErrorOpen(true);
  };

  const showNoAccess = () => {
    showError(
      "No autorizado",
      "No tienes permiso para gestionar packs. Solo puedes visualizar."
    );
  };

  // ---------------------------------------------------------------------------
  // Handlers productos del pack
  // ---------------------------------------------------------------------------

  const handleAddProduct = () => {
    if (!canManagePacks) return showNoAccess();
    if (!selectedProduct) return;

    if (items.some((i) => i.producto_id === selectedProduct.id)) return;

    setItems((prev) => [
      ...prev,
      {
        producto_id: selectedProduct.id,
        internal_id: selectedProduct.internal_id,
        descripcion: selectedProduct.descripcion,
      },
    ]);

    setSelectedProduct(null);
    setProductoInput("");
  };

  const handleRemoveItem = (producto_id: string) => {
    if (!canManagePacks) return showNoAccess();
    setItems((prev) => prev.filter((i) => i.producto_id !== producto_id));
  };

  // ---------------------------------------------------------------------------
  // Crear pack (lanza modal)
  // ---------------------------------------------------------------------------

  const prepareCrearPack = (e: FormEvent) => {
    e.preventDefault();

    if (!canManagePacks) return showNoAccess();

    if (!nombre.trim()) {
      showError("Datos incompletos", "El nombre del pack es obligatorio.");
      return;
    }
    if (items.length === 0) {
      showError("Datos incompletos", "Debes agregar al menos un producto al pack.");
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
            producto_id: i.producto_id, // UUID
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
      } catch (err: any) {
        console.error("[PackClient] error al crear pack", err);

        const raw = String(err?.message ?? "Ocurrió un error al registrar el pack.");
        if (raw.toLowerCase().includes("not authorized")) {
          showError("No autorizado", "No tienes permiso para gestionar packs.");
        } else {
          showError("No se pudo registrar", raw);
        }
      } finally {
        setLoading(false);
      }
    };

    setConfirmMessage(`¿Confirmas registrar el pack "${resumen}"?`);
    setPendingAction(() => action);
    setConfirmOpen(true);
  };

  // ---------------------------------------------------------------------------
  // Eliminar pack (con modal)
  // ---------------------------------------------------------------------------

  const handleDeletePack = (pack: PackRow) => {
    if (!canManagePacks) return showNoAccess();

    const resumen = pack.codigo || pack.internal_id || pack.nombre;

    const action = async () => {
      try {
        setLoading(true);
        await eliminarPack(pack.id);
        setPacks((prev) => prev.filter((p) => p.id !== pack.id));
      } catch (err: any) {
        console.error("[PackClient] error al eliminar pack", err);

        const raw = String(err?.message ?? "No se pudo eliminar el pack.");
        if (raw.toLowerCase().includes("not authorized")) {
          showError("No autorizado", "No tienes permiso para gestionar packs.");
        } else {
          showError("No se pudo eliminar", raw);
        }
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

  const handleChangePage = (_: unknown, newPage: number) => setPage(newPage);

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
  // Helpers
  // ---------------------------------------------------------------------------

  const renderPackItems = (pack: PackRow) => {
    const list = pack.items ?? [];
    if (!list || list.length === 0) {
      return (
        <Typography variant="body2" color="text.secondary">
          Sin productos
        </Typography>
      );
    }

    return list.map((i, idx) => {
      const qty = i.cantidad ?? 1;

      // ✅ Normalizamos: si viene como array usamos el primero
      const prod = Array.isArray(i.productos) ? i.productos[0] : i.productos;

      if (!prod) {
        return (
          <Box
            key={`${pack.id}-${idx}`}
            sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}
          >
            <Chip
              size="small"
              color="warning"
              label="Producto no encontrado"
              sx={{ height: 22 }}
            />
            <Typography variant="body2" color="text.secondary">
              × {qty}
            </Typography>
          </Box>
        );
      }

      return (
        <div key={`${pack.id}-${idx}`}>
          {prod.internal_id} — {prod.descripcion} × {qty}
        </div>
      );
    });
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  // Si por algún motivo este módulo se monta sin permiso de ver packs,
  // devolvemos NoAccess (igual ya lo bloquea PanelShell, pero es extra-safe)
  if (me && !canViewPacks && !canManagePacks) {
    return <NoAccess />;
  }

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
          {!canManagePacks && (
            <Box sx={{ mb: 2 }}>
              <Chip
                label="Modo solo lectura (sin permiso para gestionar packs)"
                variant="outlined"
                color="warning"
              />
            </Box>
          )}

          <Box
            component="form"
            onSubmit={prepareCrearPack}
            sx={{ display: "flex", flexDirection: "column", gap: 2 }}
          >
            <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
              <TextField
                label="Nombre del pack"
                size="small"
                fullWidth
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                disabled={!canManagePacks || loading}
              />
              <TextField
                label="Descripción"
                size="small"
                fullWidth
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                disabled={!canManagePacks || loading}
              />
            </Stack>

            <Divider sx={{ my: 2 }} />

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
                disabled={!canManagePacks || loading}
              >
                Agregar producto
              </Button>
            </Stack>

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
                            <span>
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => handleRemoveItem(i.producto_id)}
                                disabled={!canManagePacks || loading}
                              >
                                <IconTrash size={16} />
                              </IconButton>
                            </span>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </Box>

            <Stack direction="row" justifyContent="flex-end" spacing={1.5} mt={3}>
              <Button
                type="submit"
                variant="contained"
                startIcon={<IconPlus size={18} />}
                disabled={!canManagePacks || loading}
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
              label="Buscar"
              placeholder="Código, nombre, descripción..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              sx={{ maxWidth: 360 }}
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
                    <TableCell>{renderPackItems(pack)}</TableCell>
                    <TableCell>{pack.descripcion ?? ""}</TableCell>
                    <TableCell align="center">
                      <Tooltip title="Eliminar pack">
                        <span>
                          <IconButton
                            size="small"
                            sx={{ color: "error.main" }}
                            onClick={() => handleDeletePack(pack)}
                            disabled={!canManagePacks || loading}
                          >
                            <IconTrash size={18} />
                          </IconButton>
                        </span>
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
            labelDisplayedRows={({ from, to, count }) => `${from}-${to} de ${count}`}
          />
        </CardContent>
      </Card>

      {/* MODAL CONFIRMACIÓN */}
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

      {/* MODAL ERROR */}
      <ErrorDialog
        open={errorOpen}
        title={errorTitle}
        message={errorMessage}
        onClose={() => setErrorOpen(false)}
      />
    </>
  );
};

export default PackClient;
