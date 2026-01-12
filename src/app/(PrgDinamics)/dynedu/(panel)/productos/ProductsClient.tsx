"use client";

import { useEffect, useMemo, useState, ChangeEvent, FormEvent } from "react";
import {
  Box,
  Card,
  CardHeader,
  CardContent,
  TextField,
  Button,
  Stack,
  Typography,
  IconButton,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  TablePagination,
  InputAdornment,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  Chip,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import {
  IconPlus,
  IconEdit,
  IconTrash,
  IconEye,
  IconEyeOff,
  IconUpload,
} from "@tabler/icons-react";

import type {
  Producto,
  ProductoCreateInput,
  ProductoUpdateInput,
} from "@/modules/dynedu/types";
import {
  crearProducto,
  actualizarProducto,
  eliminarProducto,
  generarCodigoProducto,
  setProductoPublicado,
} from "./actions";

type Props = {
  initialProductos: Producto[];
};

export default function ProductsClient({ initialProductos }: Props) {
  // -----------------------------
  // Estado base
  // -----------------------------
  const [productos, setProductos] = useState<Producto[]>(initialProductos || []);
  const [loading, setLoading] = useState(false);

  // formulario
  const [codigo, setCodigo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [editorial, setEditorial] = useState("");
  const [isbn, setIsbn] = useState("");
  const [autor, setAutor] = useState("");
  const [anioPublicacion, setAnioPublicacion] = useState<string>("");
  const [edicion, setEdicion] = useState("");

  // publish flag (public catalog)
  const [isPublic, setIsPublic] = useState<boolean>(false);

  // foto
  const [fotoFile, setFotoFile] = useState<File | null>(null);
  const [fotoNombre, setFotoNombre] = useState<string>("");

  // filtros / búsqueda
  const [busquedaGlobal, setBusquedaGlobal] = useState("");
  const [filtroCodigo, setFiltroCodigo] = useState("");
  const [filtroIsbn, setFiltroIsbn] = useState("");
  const [filtroNombre, setFiltroNombre] = useState("");
  const [filtroEditorial, setFiltroEditorial] = useState("");
  const [filtroAutor, setFiltroAutor] = useState("");
  const [filtroAnio, setFiltroAnio] = useState("");

  // paginación
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(5);

  // edición
  const [editingId, setEditingId] = useState<number | null>(null);

  // modal de DETALLES
  const [openDetalle, setOpenDetalle] = useState(false);
  const [productoDetalle, setProductoDetalle] = useState<Producto | null>(null);

  // modal de confirmación (guardar / actualizar / eliminar)
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmMensaje, setConfirmMensaje] = useState("");
  const [confirmType, setConfirmType] = useState<"save" | "delete">("save");
  const [pendienteAccion, setPendienteAccion] = useState<() => Promise<void>>(
    async () => {}
  );

  // -----------------------------
  // Helpers
  // -----------------------------

  // genera el siguiente código PRO000X
  const cargarSiguienteCodigo = async () => {
    try {
      const nuevo = await generarCodigoProducto();
      if (nuevo) setCodigo(nuevo);
    } catch (err) {
      console.error("Error generando código de producto", err);
    }
  };

  useEffect(() => {
    cargarSiguienteCodigo();
  }, []);

  const limpiarFormulario = () => {
    setDescripcion("");
    setEditorial("");
    setIsbn("");
    setAutor("");
    setAnioPublicacion("");
    setEdicion("");
    setIsPublic(false);
    setFotoFile(null);
    setFotoNombre("");
    setEditingId(null);
  };

  const manejarCambioArchivo = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!["image/jpeg", "image/png"].includes(file.type)) {
      alert("Solo se permiten imágenes JPG o PNG.");
      e.target.value = "";
      return;
    }

    setFotoFile(file);
    setFotoNombre(file.name);
  };

  // -----------------------------
  // Filtro de productos
  // -----------------------------
  const productosFiltrados = useMemo(() => {
    const lista = productos || [];

    return lista.filter((p) => {
      const cod = p.internal_id?.toLowerCase() ?? "";
      const desc = p.descripcion?.toLowerCase() ?? "";
      const edt = p.editorial?.toLowerCase() ?? "";
      const isbnVal = (p as any).isbn?.toLowerCase?.() ?? "";
      const autorVal = (p as any).autor?.toLowerCase?.() ?? "";
      const anioVal =
        (p as any).anio_publicacion != null
          ? String((p as any).anio_publicacion)
          : "";

      const global = busquedaGlobal.trim().toLowerCase();
      if (global) {
        if (
          !(
            cod.includes(global) ||
            desc.includes(global) ||
            edt.includes(global) ||
            isbnVal.includes(global) ||
            autorVal.includes(global)
          )
        ) {
          return false;
        }
      }

      if (filtroCodigo && !cod.includes(filtroCodigo.toLowerCase())) {
        return false;
      }
      if (filtroIsbn && !isbnVal.includes(filtroIsbn.toLowerCase())) {
        return false;
      }
      if (filtroNombre && !desc.includes(filtroNombre.toLowerCase())) {
        return false;
      }
      if (filtroEditorial && !edt.includes(filtroEditorial.toLowerCase())) {
        return false;
      }
      if (filtroAutor && !autorVal.includes(filtroAutor.toLowerCase())) {
        return false;
      }
      if (filtroAnio && !anioVal.includes(filtroAnio.toLowerCase())) {
        return false;
      }

      return true;
    });
  }, [
    productos,
    busquedaGlobal,
    filtroCodigo,
    filtroIsbn,
    filtroNombre,
    filtroEditorial,
    filtroAutor,
    filtroAnio,
  ]);

  const handleChangePage = (_: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setRowsPerPage(parseInt(e.target.value, 10));
    setPage(0);
  };

  // -----------------------------
  // Submit (crear / actualizar)
  // -----------------------------
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();

    if (!descripcion.trim()) {
      alert("La descripción / nombre es obligatoria.");
      return;
    }

    const esEdicion = editingId !== null;

    const accion = async () => {
      try {
        setLoading(true);

        const payloadBase: Omit<
          ProductoCreateInput,
          "id" | "created_at" | "updated_at"
        > & { is_public: boolean } = {
          internal_id: codigo,
          descripcion: descripcion.trim(),
          editorial: editorial.trim() || null,
          isbn: isbn.trim() || null,
          autor: autor.trim() || null,
          anio_publicacion: anioPublicacion
            ? Number(anioPublicacion)
            : (null as any),
          edicion: edicion.trim() || null,
          is_public: isPublic,
          // foto_url la dejamos para cuando integremos Storage
        };

        if (!esEdicion) {
          // CREAR
          const creado = (await crearProducto(
            payloadBase as ProductoCreateInput
          )) as Producto;

          setProductos((prev) => [creado, ...prev]);
          limpiarFormulario();
          await cargarSiguienteCodigo();
        } else if (editingId !== null) {
          // ACTUALIZAR
          await actualizarProducto(
            editingId,
            payloadBase as ProductoUpdateInput
          );

          setProductos((prev) =>
            prev.map((p) =>
              p.id === editingId ? { ...p, ...payloadBase } : p
            )
          );
          limpiarFormulario();
          await cargarSiguienteCodigo();
        }
      } catch (err) {
        console.error("Error al guardar producto", err);
        alert("Ocurrió un error al guardar el producto.");
      } finally {
        setLoading(false);
      }
    };

    const resumen = `${codigo} – ${descripcion || "(sin nombre)"}`;
    setConfirmMensaje(
      editingId
        ? `¿Confirmas actualizar el producto ${resumen}?`
        : `¿Confirmas registrar el producto ${resumen}?`
    );
    setPendienteAccion(() => accion);
    setConfirmType("save");
    setConfirmOpen(true);
  };

  const confirmarAccion = async () => {
    setConfirmOpen(false);
    await pendienteAccion();
  };

  const cancelarEdicion = () => {
    limpiarFormulario();
    cargarSiguienteCodigo();
  };

  // -----------------------------
  // Acciones fila (editar / eliminar / ver)
  // -----------------------------
  const handleClickEditar = (p: Producto) => {
    setEditingId(p.id);
    setCodigo(p.internal_id);
    setDescripcion(p.descripcion ?? "");
    setEditorial((p as any).editorial ?? "");
    setIsbn((p as any).isbn ?? "");
    setAutor((p as any).autor ?? "");
    setAnioPublicacion(
      (p as any).anio_publicacion ? String((p as any).anio_publicacion) : ""
    );
    setEdicion((p as any).edicion ?? "");
    setIsPublic(Boolean((p as any).is_public));
    setFotoFile(null);
    setFotoNombre("");

    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  // AHORA: eliminar con modal MUI, sin window.confirm
  const handleClickEliminar = (p: Producto) => {
    const resumen = `${p.internal_id} – ${p.descripcion ?? ""}`;

    const accion = async () => {
      try {
        setLoading(true);
        await eliminarProducto(p.id);
        setProductos((prev) => prev.filter((x) => x.id !== p.id));
      } catch (err) {
        console.error("Error al eliminar producto", err);
        alert("No se pudo eliminar el producto.");
      } finally {
        setLoading(false);
      }
    };

    setConfirmMensaje(
      `¿Seguro que deseas eliminar el producto ${resumen}? Esta acción no se puede deshacer.`
    );
    setPendienteAccion(() => accion);
    setConfirmType("delete");
    setConfirmOpen(true);
  };

  const handleClickVerDetalles = (p: Producto) => {
    setProductoDetalle(p);
    setOpenDetalle(true);
  };

  // -----------------------------
  // Publish toggle (table)
  // -----------------------------
  const handleTogglePublicado = async (p: Producto) => {
    const next = !Boolean((p as any).is_public);
    try {
      setLoading(true);
      await setProductoPublicado(p.id, next);
      setProductos((prev) =>
        prev.map((x) => (x.id === p.id ? { ...(x as any), is_public: next } : x))
      );
    } catch (err) {
      console.error("Error updating published flag", err);
      alert("No se pudo actualizar el estado de publicación.");
    } finally {
      setLoading(false);
    }
  };

  const cerrarDetalle = () => {
    setOpenDetalle(false);
    setProductoDetalle(null);
  };

  // -----------------------------
  // Render
  // -----------------------------
  const sliceInicio = page * rowsPerPage;
  const sliceFin = sliceInicio + rowsPerPage;
  const paginaProductos = productosFiltrados.slice(sliceInicio, sliceFin);

  const isDeleteConfirm = confirmType === "delete";

  return (
    <>
      {/* CARD 1: FORMULARIO DE PRODUCTO */}
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
              <Typography variant="h6" fontWeight={600}>
                Catálogo de productos
              </Typography>
            </Stack>
          }
          subheader="Completa los campos para registrar libros o packs en el almacén."
        />

        <CardContent>
          <Box component="form" onSubmit={handleSubmit}>
            <Stack spacing={2}>
              <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                <TextField label="Código" value={codigo} disabled fullWidth />
                <TextField
                  label="ISBN"
                  value={isbn}
                  onChange={(e) => setIsbn(e.target.value)}
                  fullWidth
                />
                <TextField
                  label="Edición"
                  value={edicion}
                  onChange={(e) => setEdicion(e.target.value)}
                  fullWidth
                />
              </Stack>

              <TextField
                label="Nombre"
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                fullWidth
              />

              {/* Public / hidden (affects website catalog) */}
              <Stack
                direction="row"
                spacing={1}
                alignItems="center"
                justifyContent="flex-end"
                sx={{ mt: -1 }}
              >
                <Typography variant="caption" color="text.secondary">
                  Mostrar en Web:
                </Typography>
                <Chip
                  size="small"
                  label={isPublic ? "PUBLISHED" : "HIDDEN"}
                  color={isPublic ? "success" : "default"}
                  variant={isPublic ? "filled" : "outlined"}
                />
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => setIsPublic((v) => !v)}
                  disabled={loading}
                >
                  {isPublic ? "Hide" : "Publish"}
                </Button>
              </Stack>

              <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                <TextField
                  label="Editorial"
                  value={editorial}
                  onChange={(e) => setEditorial(e.target.value)}
                  fullWidth
                />
                <TextField
                  label="Autor"
                  value={autor}
                  onChange={(e) => setAutor(e.target.value)}
                  fullWidth
                />
                <TextField
                  label="Año de publicación"
                  value={anioPublicacion}
                  onChange={(e) => setAnioPublicacion(e.target.value)}
                  fullWidth
                />
              </Stack>

              {/* Campo de archivo estilizado */}
              <Box>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: "block", mb: 0.5 }}
                >
                  Foto del libro
                </Typography>

                <Stack direction="row" spacing={2} alignItems="center">
                  <input
                    id="foto-libro-input"
                    type="file"
                    accept="image/png, image/jpeg"
                    style={{ display: "none" }}
                    onChange={manejarCambioArchivo}
                  />
                  <label htmlFor="foto-libro-input">
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<IconUpload size={18} />}
                      component="span"
                    >
                      Seleccionar archivo
                    </Button>
                  </label>

                  <Typography variant="body2" color="text.secondary">
                    {fotoNombre
                      ? fotoNombre
                      : "Ningún archivo seleccionado."}
                  </Typography>
                </Stack>
              </Box>

              {/* BOTONES DERECHA */}
              <Stack
                direction="row"
                spacing={2}
                justifyContent="flex-end"
                sx={{ pt: 1 }}
              >
                {editingId && (
                  <Button
                    variant="text"
                    color="inherit"
                    onClick={cancelarEdicion}
                  >
                    Cancelar
                  </Button>
                )}

                <Button
                  type="submit"
                  variant="contained"
                  startIcon={<IconPlus size={18} />}
                  disabled={loading}
                >
                  {editingId ? "Guardar cambios" : "Agregar Producto"}
                </Button>
              </Stack>
            </Stack>
          </Box>
        </CardContent>
      </Card>

      {/* CARD 2: TABLA DE PRODUCTOS */}
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
              Productos registrados
            </Typography>
          }
          action={
            <TextField
              size="small"
              placeholder="Buscar por código, nombre o ISBN..."
              value={busquedaGlobal}
              onChange={(e) => setBusquedaGlobal(e.target.value)}
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
          <Table size="small" className="tabla-products">
            <TableHead>
              <TableRow>
                <TableCell>Código</TableCell>
                <TableCell>Nombre</TableCell>
                <TableCell>Editorial</TableCell>
                <TableCell>ISBN</TableCell>
                <TableCell>Autor</TableCell>
                <TableCell>Año pub.</TableCell>
                <TableCell align="center">Publicado</TableCell>
                <TableCell align="center">Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {paginaProductos.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align="center">
                    No hay productos registrados.
                  </TableCell>
                </TableRow>
              ) : (
                paginaProductos.map((p) => (
                  <TableRow key={p.id} hover>
                    <TableCell>{p.internal_id}</TableCell>
                    <TableCell>{p.descripcion}</TableCell>
                    <TableCell>{(p as any).editorial ?? "—"}</TableCell>
                    <TableCell>{(p as any).isbn ?? "—"}</TableCell>
                    <TableCell>{(p as any).autor ?? "—"}</TableCell>
                    <TableCell>
                      {(p as any).anio_publicacion ?? "—"}
                    </TableCell>
                    <TableCell align="center">
                      <IconButton
                        size="small"
                        onClick={() => handleTogglePublicado(p)}
                        disabled={loading}
                        sx={{
                          color: Boolean((p as any).is_public)
                            ? "success.main"
                            : "text.secondary",
                        }}
                        title={
                          Boolean((p as any).is_public)
                            ? "Publicado (click para ocultar)"
                            : "Oculto (click para publicar)"
                        }
                      >
                        {Boolean((p as any).is_public) ? (
                          <IconEye size={18} />
                        ) : (
                          <IconEyeOff size={18} />
                        )}
                      </IconButton>
                    </TableCell>
                    <TableCell align="center">
                      <Stack
                        direction="row"
                        spacing={0.5}
                        justifyContent="center"
                      >
                        {/* Ver detalles */}
                        <IconButton
                          size="small"
                          sx={{ color: "info.main" }}
                          onClick={() => handleClickVerDetalles(p)}
                        >
                          <IconEye size={18} />
                        </IconButton>

                        {/* Editar */}
                        <IconButton
                          size="small"
                          sx={{ color: "warning.main" }}
                          onClick={() => handleClickEditar(p)}
                        >
                          <IconEdit size={18} />
                        </IconButton>

                        {/* Eliminar con modal de confirmación */}
                        <IconButton
                          size="small"
                          sx={{ color: "error.main" }}
                          onClick={() => handleClickEliminar(p)}
                        >
                          <IconTrash size={18} />
                        </IconButton>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          <TablePagination
            component="div"
            count={productosFiltrados.length}
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

      {/* MODAL CONFIRMACIÓN (guardar / actualizar / eliminar) */}
      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)}>
        <DialogTitle>
          {isDeleteConfirm ? "Confirmar eliminación" : "Confirmar acción"}
        </DialogTitle>
        <DialogContent>
          <Typography>{confirmMensaje}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)}>Cancelar</Button>
          <Button
            onClick={confirmarAccion}
            variant="contained"
            color={isDeleteConfirm ? "error" : "primary"}
            autoFocus
          >
            Aceptar
          </Button>
        </DialogActions>
      </Dialog>

      {/* MODAL DETALLES DEL PRODUCTO */}
      <Dialog open={openDetalle} onClose={cerrarDetalle} maxWidth="sm" fullWidth>
        <DialogTitle>Detalle del producto</DialogTitle>
        <DialogContent dividers>
          {productoDetalle && (
            <Stack spacing={2}>
              <Stack direction="row" spacing={1} alignItems="center">
                <Chip
                  label={productoDetalle.internal_id}
                  size="small"
                  color="primary"
                  variant="outlined"
                />
                <Typography variant="subtitle1" fontWeight={600}>
                  {productoDetalle.descripcion}
                </Typography>
              </Stack>

              <Divider />

              <Stack spacing={1}>
                <Typography variant="body2">
                  <strong>Editorial:</strong>{" "}
                  {(productoDetalle as any).editorial ?? "—"}
                </Typography>
                <Typography variant="body2">
                  <strong>ISBN:</strong> {(productoDetalle as any).isbn ?? "—"}
                </Typography>
                <Typography variant="body2">
                  <strong>Autor:</strong> {(productoDetalle as any).autor ?? "—"}
                </Typography>
                <Typography variant="body2">
                  <strong>Edición:</strong>{" "}
                  {(productoDetalle as any).edicion ?? "—"}
                </Typography>
                <Typography variant="body2">
                  <strong>Año de publicación:</strong>{" "}
                  {(productoDetalle as any).anio_publicacion ?? "—"}
                </Typography>
              </Stack>

              {(productoDetalle as any).foto_url && (
                <>
                  <Divider />
                  <Box
                    sx={{
                      borderRadius: 2,
                      overflow: "hidden",
                      border: "1px solid",
                      borderColor: "divider",
                      maxHeight: 260,
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={(productoDetalle as any).foto_url}
                      alt={productoDetalle.descripcion}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        display: "block",
                      }}
                    />
                  </Box>
                </>
              )}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={cerrarDetalle}>Cerrar</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
