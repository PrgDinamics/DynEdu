"use client";

import {
  Box,
  Typography,
  Paper,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  TextField,
  Tabs,
  Tab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Tooltip,
  IconButton,
  Stack,
  TablePagination,
  Button,
} from "@mui/material";

import { useState, useTransition } from "react";

import SaveOutlinedIcon from "@mui/icons-material/SaveOutlined";
import { IconEdit } from "@tabler/icons-react";

import { useSearchAndPagination } from "@/modules/dynedu/hooks/useSearchAndPagination";

import { upsertPrecioProducto, upsertPrecioPack } from "./actions";

type ProductoConPrecio = {
  producto_id: number;
  internal_id: string;
  descripcion: string;
  precio: number | null;
};

type PackItemResumen = {
  internal_id: string;
  descripcion: string;
  cantidad: number;
};

type PackConPrecio = {
  pack_id: number;
  internal_id: string;
  nombre: string;
  descripcion: string | null;
  precio: number | null;
  items: PackItemResumen[];
};

type ListaInfo = {
  internal_id: string | null;
  nombre: string | null;
  descripcion: string | null;
  moneda: string | null;
};

type Props = {
  priceListId: number;
  listaInfo: ListaInfo;
  initialProductos: ProductoConPrecio[];
  initialPacks: PackConPrecio[];
};

type InfoDialogState = {
  open: boolean;
  title: string;
  message: string;
  kind: "info" | "success" | "warning" | "error";
};

export default function PricesClient({
  priceListId,
  listaInfo,
  initialProductos,
  initialPacks,
}: Props) {
  const [tab, setTab] = useState<"productos" | "packs">("productos");

  const [productos, setProductos] =
    useState<ProductoConPrecio[]>(initialProductos);

  const [packs, setPacks] = useState<PackConPrecio[]>(initialPacks);

  const [isPending, startTransition] = useTransition();

  // Estado de edición
  const [editandoProductos, setEditandoProductos] = useState<
    Record<number, boolean>
  >({});

  const [editandoPacks, setEditandoPacks] = useState<
    Record<number, boolean>
  >({});

  // Valores temporales
  const [preciosProductos, setPreciosProductos] = useState<
    Record<number, string>
  >(() => {
    const obj: Record<number, string> = {};
    for (const p of initialProductos) {
      obj[p.producto_id] = p.precio != null ? String(p.precio) : "";
    }
    return obj;
  });

  const [preciosPacks, setPreciosPacks] = useState<Record<number, string>>(
    () => {
      const obj: Record<number, string> = {};
      for (const p of initialPacks) {
        obj[p.pack_id] = p.precio != null ? String(p.precio) : "";
      }
      return obj;
    }
  );

  // -----------------------------
  // HOOKS: búsqueda + paginación
  // -----------------------------

  const {
    searchTerm: productosSearch,
    setSearchTerm: setProductosSearch,
    page: productosPage,
    setPage: setProductosPage,
    rowsPerPage: productosRowsPerPage,
    filteredData: productosFiltrados,
    paginatedData: productosPaginados,
  } = useSearchAndPagination<ProductoConPrecio>({
    data: productos,
    rowsPerPage: 10,
    sortFn: (a, b) => a.internal_id.localeCompare(b.internal_id),
    filterFn: (p, q) =>
      p.internal_id.toLowerCase().includes(q) ||
      p.descripcion.toLowerCase().includes(q),
  });

  const {
    searchTerm: packsSearch,
    setSearchTerm: setPacksSearch,
    page: packsPage,
    setPage: setPacksPage,
    rowsPerPage: packsRowsPerPage,
    filteredData: packsFiltrados,
    paginatedData: packsPaginados,
  } = useSearchAndPagination<PackConPrecio>({
    data: packs,
    rowsPerPage: 10,
    sortFn: (a, b) =>
      (a.internal_id ?? a.nombre).localeCompare(b.internal_id ?? b.nombre),
    filterFn: (p, q) =>
      (p.internal_id ?? "").toLowerCase().includes(q) ||
      (p.nombre ?? "").toLowerCase().includes(q) ||
      (p.descripcion ?? "").toLowerCase().includes(q),
  });

  // -----------------------------
  // MODAL DE CONFIRMACIÓN
  // -----------------------------
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMessage, setModalMessage] = useState("");
  const [modalAction, setModalAction] = useState<
    (() => void | Promise<void>) | null
  >(null);

  const abrirModal = (msg: string, action: () => void | Promise<void>) => {
    setModalMessage(msg);
    setModalAction(() => action);
    setModalOpen(true);
  };

  const cerrarModal = () => {
    setModalOpen(false);
    setModalMessage("");
    setModalAction(null);
  };

  const confirmarModal = async () => {
    try {
      if (modalAction) await modalAction();
    } finally {
      cerrarModal();
    }
  };

  // -----------------------------
  // MODAL INFO (reemplaza alert)
  // -----------------------------
  const [infoDialog, setInfoDialog] = useState<InfoDialogState>({
    open: false,
    title: "Aviso",
    message: "",
    kind: "info",
  });

  const openInfo = (
    message: string,
    kind: InfoDialogState["kind"] = "info",
    title?: string
  ) => {
    const titles: Record<InfoDialogState["kind"], string> = {
      info: "Aviso",
      success: "Listo",
      warning: "Atención",
      error: "Error",
    };

    setInfoDialog({
      open: true,
      title: title ?? titles[kind],
      message,
      kind,
    });
  };

  const closeInfo = () => setInfoDialog((p) => ({ ...p, open: false }));

  const monedaLabel = listaInfo.moneda ?? "PEN";

  // --------------------------------------------
  //  PRODUCTOS
  // --------------------------------------------
  const handleChangePrecioProducto = (productoId: number, value: string) => {
    setPreciosProductos((prev) => ({
      ...prev,
      [productoId]: value,
    }));
  };

  const guardarPrecioProducto = async (productoId: number) => {
    const raw = preciosProductos[productoId] ?? "";
    const precio = Number(raw.replace(",", "."));

    if (Number.isNaN(precio) || precio < 0) {
      openInfo("Ingresa un precio válido.", "warning");
      return;
    }

    const prod = productos.find((p) => p.producto_id === productoId);
    const nombre = prod?.descripcion ?? "";
    const codigo = prod?.internal_id ?? "";
    const texto = `¿Deseas actualizar el precio de ${codigo} – ${nombre} a ${monedaLabel} ${precio.toFixed(
      2
    )}?`;

    abrirModal(texto, async () => {
      startTransition(async () => {
        try {
          await upsertPrecioProducto(priceListId, productoId, precio);

          setProductos((prev) =>
            prev.map((p) =>
              p.producto_id === productoId ? { ...p, precio } : p
            )
          );

          setEditandoProductos((prev) => ({
            ...prev,
            [productoId]: false,
          }));
        } catch (e) {
          console.error("[PricesClient] upsertPrecioProducto error", e);
          openInfo("No se pudo guardar el precio del producto.", "error");
        }
      });
    });
  };

  const toggleEditarProducto = (productoId: number) => {
    setEditandoProductos((prev) => ({
      ...prev,
      [productoId]: !prev[productoId],
    }));
  };

  // --------------------------------------------
  //  PACKS
  // --------------------------------------------
  const handleChangePrecioPack = (packId: number, value: string) => {
    setPreciosPacks((prev) => ({
      ...prev,
      [packId]: value,
    }));
  };

  const guardarPrecioPack = async (packId: number) => {
    const raw = preciosPacks[packId] ?? "";
    const precio = Number(raw.replace(",", "."));

    if (Number.isNaN(precio) || precio < 0) {
      openInfo("Ingresa un precio válido.", "warning");
      return;
    }

    const pack = packs.find((p) => p.pack_id === packId);
    const codigo = pack?.internal_id ?? "";
    const nombre = pack?.nombre ?? "";

    const texto = `¿Deseas actualizar el precio del pack ${codigo} – ${nombre} a ${monedaLabel} ${precio.toFixed(
      2
    )}?`;

    abrirModal(texto, async () => {
      startTransition(async () => {
        try {
          await upsertPrecioPack(priceListId, packId, precio);

          setPacks((prev) =>
            prev.map((p) => (p.pack_id === packId ? { ...p, precio } : p))
          );

          setEditandoPacks((prev) => ({
            ...prev,
            [packId]: false,
          }));
        } catch (e) {
          console.error("[PricesClient] upsertPrecioPack error", e);
          openInfo("No se pudo guardar el precio del pack.", "error");
        }
      });
    });
  };

  const toggleEditarPack = (packId: number) => {
    setEditandoPacks((prev) => ({
      ...prev,
      [packId]: !prev[packId],
    }));
  };

  // --------------------------------------------
  // RENDER TABLAS
  // --------------------------------------------

  const renderTablaProductos = () => (
    <Paper elevation={1} sx={{ p: 2 }}>
      <Typography variant="subtitle1" fontWeight={600} mb={2}>
        Precios por producto
      </Typography>

      {/* Buscador + resumen */}
      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={2}
        mb={2}
        justifyContent="space-between"
        alignItems={{ xs: "stretch", md: "center" }}
      >
        <Typography variant="body2" color="text.secondary">
          {productosFiltrados.length} producto(s) encontrados
        </Typography>

        <TextField
          size="small"
          label="Buscar"
          placeholder="Código, nombre..."
          value={productosSearch}
          onChange={(e) => setProductosSearch(e.target.value)}
          sx={{ maxWidth: 360 }}
        />
      </Stack>

      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell width={120}>Código</TableCell>
            <TableCell>Nombre</TableCell>
            <TableCell width={160}>Precio ({monedaLabel})</TableCell>
            <TableCell width={150} align="center">
              Acciones
            </TableCell>
          </TableRow>
        </TableHead>

        <TableBody>
          {productosPaginados.map((p) => {
            const hasPrecio = p.precio != null;
            const isEditing = editandoProductos[p.producto_id] ?? !hasPrecio;

            return (
              <TableRow key={p.producto_id}>
                <TableCell>{p.internal_id}</TableCell>
                <TableCell>{p.descripcion}</TableCell>

                <TableCell>
                  <TextField
                    size="small"
                    fullWidth
                    type="number"
                    value={preciosProductos[p.producto_id] ?? ""}
                    onChange={(e) =>
                      handleChangePrecioProducto(p.producto_id, e.target.value)
                    }
                    disabled={!isEditing || isPending}
                  />
                </TableCell>

                <TableCell align="center">
                  <Tooltip
                    title={isEditing ? "Guardar precio" : "Editar precio"}
                  >
                    <span>
                      <IconButton
                        sx={{ color: "warning.main" }}
                        disabled={isPending}
                        onClick={() => {
                          if (isEditing) {
                            guardarPrecioProducto(p.producto_id);
                          } else {
                            toggleEditarProducto(p.producto_id);
                          }
                        }}
                      >
                        {isEditing ? (
                          <SaveOutlinedIcon />
                        ) : (
                          <IconEdit size={18} />
                        )}
                      </IconButton>
                    </span>
                  </Tooltip>
                </TableCell>
              </TableRow>
            );
          })}

          {productosFiltrados.length === 0 && (
            <TableRow>
              <TableCell colSpan={4} align="center">
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ py: 2 }}
                >
                  No se encontraron productos para la búsqueda.
                </Typography>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      {productosFiltrados.length > productosRowsPerPage && (
        <TablePagination
          component="div"
          count={productosFiltrados.length}
          page={productosPage}
          onPageChange={(_, newPage) => setProductosPage(newPage)}
          rowsPerPage={productosRowsPerPage}
          rowsPerPageOptions={[productosRowsPerPage]}
          labelRowsPerPage="Filas por página"
          labelDisplayedRows={({ from, to, count }) =>
            `${from}-${to} de ${count !== -1 ? count : `más de ${to}`}`
          }
        />
      )}
    </Paper>
  );

  const renderTablaPacks = () => (
    <Paper elevation={1} sx={{ p: 2 }}>
      <Typography variant="subtitle1" fontWeight={600} mb={2}>
        Precios por pack
      </Typography>

      {/* Buscador + resumen */}
      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={2}
        mb={2}
        justifyContent="space-between"
        alignItems={{ xs: "stretch", md: "center" }}
      >
        <Typography variant="body2" color="text.secondary">
          {packsFiltrados.length} pack(s) encontrados
        </Typography>

        <TextField
          size="small"
          label="Buscar"
          placeholder="Código, nombre, descripción..."
          value={packsSearch}
          onChange={(e) => setPacksSearch(e.target.value)}
          sx={{ maxWidth: 360 }}
        />
      </Stack>

      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell width={120}>Código</TableCell>
            <TableCell>Nombre del pack</TableCell>
            <TableCell>Descripción</TableCell>
            <TableCell>Productos</TableCell>
            <TableCell width={160}>Precio ({monedaLabel})</TableCell>
            <TableCell width={150} align="center">
              Acciones
            </TableCell>
          </TableRow>
        </TableHead>

        <TableBody>
          {packsPaginados.map((p) => {
            const hasPrecio = p.precio != null;
            const isEditing = editandoPacks[p.pack_id] ?? !hasPrecio;

            return (
              <TableRow key={p.pack_id}>
                <TableCell>{p.internal_id || p.nombre}</TableCell>
                <TableCell>{p.nombre}</TableCell>
                <TableCell>{p.descripcion ?? "—"}</TableCell>

                <TableCell>
                  {p.items.map((i, idx) => (
                    <div key={`${i.internal_id}-${idx}`}>
                      {i.descripcion} × {i.cantidad}
                    </div>
                  ))}
                </TableCell>

                <TableCell>
                  <TextField
                    size="small"
                    fullWidth
                    type="number"
                    value={preciosPacks[p.pack_id] ?? ""}
                    onChange={(e) =>
                      handleChangePrecioPack(p.pack_id, e.target.value)
                    }
                    disabled={!isEditing || isPending}
                  />
                </TableCell>

                <TableCell align="center">
                  <Tooltip title={isEditing ? "Guardar precio" : "Editar precio"}>
                    <span>
                      <IconButton
                        sx={{ color: "warning.main" }}
                        disabled={isPending}
                        onClick={() => {
                          if (isEditing) {
                            guardarPrecioPack(p.pack_id);
                          } else {
                            toggleEditarPack(p.pack_id);
                          }
                        }}
                      >
                        {isEditing ? (
                          <SaveOutlinedIcon />
                        ) : (
                          <IconEdit size={18} />
                        )}
                      </IconButton>
                    </span>
                  </Tooltip>
                </TableCell>
              </TableRow>
            );
          })}

          {packsFiltrados.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} align="center">
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ py: 2 }}
                >
                  No se encontraron packs para la búsqueda.
                </Typography>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      {packsFiltrados.length > packsRowsPerPage && (
        <TablePagination
          component="div"
          count={packsFiltrados.length}
          page={packsPage}
          onPageChange={(_, newPage) => setPacksPage(newPage)}
          rowsPerPage={packsRowsPerPage}
          rowsPerPageOptions={[packsRowsPerPage]}
          labelRowsPerPage="Filas por página"
          labelDisplayedRows={({ from, to, count }) =>
            `${from}-${to} de ${count !== -1 ? count : `más de ${to}`}`
          }
        />
      )}
    </Paper>
  );

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" fontWeight={600} mb={1}>
        Lista de precios
      </Typography>

      <Typography variant="body2" mb={3}>
        {listaInfo.internal_id} – {listaInfo.nombre}
      </Typography>

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: "divider", mb: 2 }}>
        <Tabs value={tab} onChange={(_, x) => setTab(x)}>
          <Tab label="Productos" value="productos" />
          <Tab label="Packs" value="packs" />
        </Tabs>
      </Box>

      {tab === "productos" && renderTablaProductos()}
      {tab === "packs" && renderTablaPacks()}

      {/* MODAL CONFIRMACIÓN */}
      <Dialog open={modalOpen} onClose={cerrarModal}>
        <DialogTitle>Confirmar actualización</DialogTitle>

        <DialogContent>
          <DialogContentText>{modalMessage}</DialogContentText>
        </DialogContent>

        <DialogActions>
          <Button onClick={cerrarModal}>Cancelar</Button>
          <Button onClick={confirmarModal} color="success" variant="contained">
            Aceptar
          </Button>
        </DialogActions>
      </Dialog>

      {/* ✅ MODAL INFO (reemplaza alert) */}
      <Dialog open={infoDialog.open} onClose={closeInfo} maxWidth="xs" fullWidth>
        <DialogTitle>{infoDialog.title}</DialogTitle>
        <DialogContent>
          <Typography>{infoDialog.message}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeInfo} autoFocus variant="contained">
            OK
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
