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
  Switch,
  FormControlLabel,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import {
  IconPlus,
  IconEdit,
  IconTrash,
  IconEye,
  IconEyeOff,
  IconUpload,
  IconX,
} from "@tabler/icons-react";

import { createSupabaseBrowserClient } from "@/lib/supabaseBrowserClient";
import ErrorDialog from "../components/error/ErrorDialog";

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

type DyneduMe = {
  ok: boolean;
  user?: {
    id: string;
    email?: string;
    roleId?: number;
    permissions?: Record<string, boolean>;
  };
};

const STORAGE_BUCKET = "product-images";

function sanitizeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

async function uploadProductImage(productId: number, file: File) {
  const nameLower = file.name.toLowerCase();
  const isWebpByExt = nameLower.endsWith(".webp");
  const isWebpByMime = file.type === "image/webp";

  if (!isWebpByExt && !isWebpByMime) {
    throw new Error("Only WEBP files are allowed.");
  }

  const supabase = createSupabaseBrowserClient();

  const safeName = sanitizeFileName(file.name);
  const path = `products/${productId}/${Date.now()}_${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(path, file, {
      upsert: true,
      contentType: "image/webp",
    });

  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export default function ProductsClient({ initialProductos }: Props) {
  const [productos, setProductos] = useState<Producto[]>(initialProductos || []);
  const [loading, setLoading] = useState(false);

  // Auth/permissions
  const [me, setMe] = useState<DyneduMe | null>(null);
  const permissions = me?.user?.permissions ?? {};
  const canManageProducts = permissions?.canManageProducts === true;

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

  // Error dialog
  const [errorOpen, setErrorOpen] = useState(false);
  const [errorTitle, setErrorTitle] = useState("Ocurrió un error");
  const [errorMessage, setErrorMessage] = useState("");

  const showError = (title: string, message: string) => {
    setErrorTitle(title);
    setErrorMessage(message);
    setErrorOpen(true);
  };

  const showNoAccess = () => {
    showError(
      "No autorizado",
      "No tienes permiso para gestionar productos. Solo puedes visualizar."
    );
  };

  // form fields
  const [codigo, setCodigo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [editorial, setEditorial] = useState("");
  const [isbn, setIsbn] = useState("");
  const [codigoVenta, setCodigoVenta] = useState("");
  const [autor, setAutor] = useState("");
  const [anioPublicacion, setAnioPublicacion] = useState<string>("");
  const [edicion, setEdicion] = useState("");

  const [isPublic, setIsPublic] = useState<boolean>(false);

  // photo
  const [fotoFile, setFotoFile] = useState<File | null>(null);
  const [fotoNombre, setFotoNombre] = useState<string>("");

  // search
  const [busquedaGlobal, setBusquedaGlobal] = useState("");

  // pagination
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(5);

  // edit
  const [editingId, setEditingId] = useState<number | null>(null);

  // details modal
  const [openDetalle, setOpenDetalle] = useState(false);
  const [productoDetalle, setProductoDetalle] = useState<Producto | null>(null);

  // confirm modal
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmMensaje, setConfirmMensaje] = useState("");
  const [confirmType, setConfirmType] = useState<"save" | "delete">("save");
  const [pendienteAccion, setPendienteAccion] = useState<() => Promise<void>>(
    async () => {}
  );

  const isDeleteConfirm = confirmType === "delete";

  // -----------------------------
  // Helpers
  // -----------------------------
  const cargarSiguienteCodigo = async () => {
    try {
      const nuevo = await generarCodigoProducto();
      if (nuevo) setCodigo(nuevo);
    } catch (err) {
      console.error("Error generating product code", err);
    }
  };

  useEffect(() => {
    cargarSiguienteCodigo();
  }, []);

  const limpiarFormulario = () => {
    setDescripcion("");
    setEditorial("");
    setCodigoVenta("");
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
    if (!canManageProducts) {
      e.target.value = "";
      showNoAccess();
      return;
    }

    const input = e.target;
    const file = input.files?.[0];
    if (!file) return;

    const nameLower = file.name.toLowerCase();
    const isWebpByExt = nameLower.endsWith(".webp");
    const isWebpByMime = file.type === "image/webp";

    if (!isWebpByExt && !isWebpByMime) {
      showError(
        "Formato no permitido",
        "Solo se permiten imágenes en formato WEBP (.webp)."
      );
      input.value = "";
      setFotoFile(null);
      setFotoNombre("");
      return;
    }

    setFotoFile(file);
    setFotoNombre(file.name);
  };

  // -----------------------------
  // Filtering
  // -----------------------------
  const productosFiltrados = useMemo(() => {
    const lista = productos || [];

    return lista.filter((p) => {
      const cod = p.internal_id?.toLowerCase() ?? "";
      const codVenta = ((p as any).codigo_venta ?? "").toString().toLowerCase();
      const desc = p.descripcion?.toLowerCase() ?? "";
      const edt = (p as any).editorial?.toLowerCase?.() ?? "";
      const isb = (p as any).isbn?.toLowerCase?.() ?? "";
      const aut = (p as any).autor?.toLowerCase?.() ?? "";
      const anioVal = ((p as any).anio_publicacion ?? "").toString().toLowerCase();

      const blob = `${cod} ${codVenta} ${desc} ${edt} ${isb} ${aut} ${anioVal}`;
      if (busquedaGlobal && !blob.includes(busquedaGlobal.toLowerCase())) return false;
      return true;
    });
  }, [productos, busquedaGlobal]);

  const paginaProductos = useMemo(() => {
    const start = page * rowsPerPage;
    const end = start + rowsPerPage;
    return productosFiltrados.slice(start, end);
  }, [productosFiltrados, page, rowsPerPage]);

  const handleChangePage = (_: unknown, newPage: number) => setPage(newPage);

  const handleChangeRowsPerPage = (
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setRowsPerPage(parseInt(e.target.value, 10));
    setPage(0);
  };

  // -----------------------------
  // Submit (create / update)
  // -----------------------------
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();

    if (!canManageProducts) {
      showNoAccess();
      return;
    }

    const descFinal = descripcion.trim();

    if (!descFinal) {
      showError("Campos incompletos", "La descripción / nombre es obligatoria.");
      return;
    }

    const esEdicion = editingId !== null;

    const accion = async () => {
      try {
        setLoading(true);

        const payloadBase: (Omit<
          ProductoCreateInput,
          "id" | "created_at" | "updated_at"
        > & { is_public: boolean } & { codigo_venta?: string | null }) = {
          internal_id: codigo,
          codigo_venta: codigoVenta.trim() ? codigoVenta.trim() : null,
          descripcion: descFinal,
          editorial: editorial.trim() || null,
          isbn: isbn.trim() || null,
          autor: autor.trim() || null,
          anio_publicacion: anioPublicacion ? Number(anioPublicacion) : (null as any),
          edicion: edicion.trim() || null,
          is_public: isPublic,
        };

        // -------- CREATE --------
        if (!esEdicion) {
          const creado = (await crearProducto(
            payloadBase as ProductoCreateInput
          )) as Producto;

          let creadoFinal: Producto = creado;

          if (fotoFile) {
            const publicUrl = await uploadProductImage(creado.id, fotoFile);

            // ✅ FIX: some updates require descripcion too
            await actualizarProducto(creado.id, {
              foto_url: publicUrl,
              descripcion: creado.descripcion ?? descFinal,
            } as any);

            creadoFinal = { ...(creado as any), foto_url: publicUrl } as any;
          }

          setProductos((prev) => [creadoFinal, ...prev]);
          limpiarFormulario();
          await cargarSiguienteCodigo();
          return;
        }

        // -------- UPDATE --------
        if (editingId !== null) {
          // if there is an image, upload first then do ONE update with all fields
          if (fotoFile) {
            const publicUrl = await uploadProductImage(editingId, fotoFile);

            const updatePayload = {
              ...(payloadBase as any),
              foto_url: publicUrl,
              // ✅ FIX: always send descripcion to satisfy validation
              descripcion: descFinal,
            };

            await actualizarProducto(editingId, updatePayload as ProductoUpdateInput);

            setProductos((prev) =>
              prev.map((p) =>
                p.id === editingId
                  ? ({
                      ...p,
                      ...payloadBase,
                      foto_url: publicUrl,
                      descripcion: descFinal,
                    } as any)
                  : p
              )
            );
          } else {
            // no image, normal update
            await actualizarProducto(editingId, payloadBase as ProductoUpdateInput);

            setProductos((prev) =>
              prev.map((p) =>
                p.id === editingId
                  ? ({
                      ...p,
                      ...payloadBase,
                      descripcion: descFinal,
                    } as any)
                  : p
              )
            );
          }

          limpiarFormulario();
          await cargarSiguienteCodigo();
        }
      } catch (err: any) {
        console.error("Error saving product", err);

        const raw =
          err?.message ||
          err?.error_description ||
          err?.details ||
          "Ocurrió un error al guardar el producto.";

        const rawStr = String(raw).toLowerCase();
        let friendly = String(raw);

        if (rawStr.includes("not authorized")) {
          friendly = "No tienes permiso para gestionar productos.";
        } else if (
          rawStr.includes("storage.objects") ||
          rawStr.includes("bucket") ||
          rawStr.includes("object") ||
          rawStr.includes("storage")
        ) {
          friendly =
            "No se pudo subir la imagen (Storage RLS). Revisa policies del bucket product-images y asegúrate de estar logueado.";
        } else if (rawStr.includes("row-level security")) {
          friendly =
            "No tienes permisos para guardar (RLS). Revisa policies de INSERT/UPDATE en Supabase para la tabla productos.";
        }

        showError("No se pudo guardar el producto", friendly);
      } finally {
        setLoading(false);
      }
    };

    const resumen = `${codigo} – ${descFinal || "(sin nombre)"}`;
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
  // Row actions
  // -----------------------------
  const handleClickEditar = (p: Producto) => {
    if (!canManageProducts) return showNoAccess();

    setEditingId(p.id);
    setCodigo(p.internal_id);
    setCodigoVenta(((p as any).codigo_venta ?? "") as string);
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

  const handleClickEliminar = (p: Producto) => {
    if (!canManageProducts) return showNoAccess();

    const resumen = `${p.internal_id} – ${p.descripcion ?? ""}`;

    const accion = async () => {
      try {
        setLoading(true);
        await eliminarProducto(p.id);
        setProductos((prev) => prev.filter((x) => x.id !== p.id));
      } catch (err: any) {
        console.error("Error deleting product", err);
        const msg = String(err?.message || "No se pudo eliminar el producto.");
        showError(
          "No se pudo eliminar",
          msg.includes("not authorized")
            ? "No tienes permiso para gestionar productos."
            : msg
        );
      } finally {
        setLoading(false);
      }
    };

    setConfirmMensaje(`¿Confirmas eliminar el producto ${resumen}?`);
    setPendienteAccion(() => accion);
    setConfirmType("delete");
    setConfirmOpen(true);
  };

  const handleClickVerDetalles = (p: Producto) => {
    setProductoDetalle(p);
    setOpenDetalle(true);
  };

  const cerrarDetalle = () => {
    setOpenDetalle(false);
    setProductoDetalle(null);
  };

  const handleTogglePublicado = async (p: Producto) => {
    if (!canManageProducts) return showNoAccess();

    try {
      setLoading(true);
      const nuevoEstado = !Boolean((p as any).is_public);
      await setProductoPublicado(p.id, nuevoEstado);

      setProductos((prev) =>
        prev.map((x) =>
          x.id === p.id ? ({ ...x, is_public: nuevoEstado } as any) : x
        )
      );
    } catch (err: any) {
      console.error("Error toggling public flag", err);
      const msg = String(err?.message || "No se pudo actualizar.");
      showError(
        "No se pudo actualizar",
        msg.includes("not authorized")
          ? "No tienes permiso para gestionar productos."
          : msg
      );
    } finally {
      setLoading(false);
    }
  };

  const total = productosFiltrados.length;

  return (
    <>
      <Card sx={{ borderRadius: 3 }}>
        <CardHeader
          title="Productos"
          subheader="Gestiona tus libros para el catálogo público"
        />

        <CardContent>
          {!canManageProducts && (
            <Box sx={{ mb: 2 }}>
              <Chip label="Modo solo lectura." variant="outlined" color="warning" />
            </Box>
          )}

          <form onSubmit={handleSubmit}>
            <Stack spacing={2}>
              <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                <TextField
                  label="Código interno"
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value)}
                  size="small"
                  fullWidth
                  disabled={!canManageProducts || loading}
                />
                <TextField
                  label="Código de Venta"
                  value={codigoVenta}
                  onChange={(e) => setCodigoVenta(e.target.value)}
                  size="small"
                  fullWidth
                  disabled={!canManageProducts || loading}
                />
              </Stack>

              <TextField
                label="Nombre"
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                size="small"
                fullWidth
                disabled={!canManageProducts || loading}
              />

              <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                <TextField
                  label="Editorial"
                  value={editorial}
                  onChange={(e) => setEditorial(e.target.value)}
                  size="small"
                  fullWidth
                  disabled={!canManageProducts || loading}
                />
                <TextField
                  label="ISBN"
                  value={isbn}
                  onChange={(e) => setIsbn(e.target.value)}
                  size="small"
                  fullWidth
                  disabled={!canManageProducts || loading}
                />
              </Stack>

              <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                <TextField
                  label="Autor"
                  value={autor}
                  onChange={(e) => setAutor(e.target.value)}
                  size="small"
                  fullWidth
                  disabled={!canManageProducts || loading}
                />
                <TextField
                  label="Año de publicación"
                  value={anioPublicacion}
                  onChange={(e) => setAnioPublicacion(e.target.value)}
                  size="small"
                  fullWidth
                  disabled={!canManageProducts || loading}
                />
                <TextField
                  label="Edición"
                  value={edicion}
                  onChange={(e) => setEdicion(e.target.value)}
                  size="small"
                  fullWidth
                  disabled={!canManageProducts || loading}
                />
              </Stack>

              <FormControlLabel
                control={
                  <Switch
                    checked={isPublic}
                    onChange={(e) => setIsPublic(e.target.checked)}
                    disabled={!canManageProducts || loading}
                  />
                }
                label="Publicar en catálogo"
              />

              <Stack
                direction={{ xs: "column", md: "row" }}
                spacing={1}
                alignItems="center"
              >
                <Button
                  component="label"
                  variant="outlined"
                  startIcon={<IconUpload size={18} />}
                  disabled={!canManageProducts || loading}
                >
                  Seleccionar imagen
                  <input
                    id="foto-libro-input"
                    type="file"
                    hidden
                    accept="image/webp,.webp"
                    onChange={manejarCambioArchivo}
                  />
                </Button>

                {fotoNombre ? (
                  <Chip
                    label={fotoNombre}
                    onDelete={() => {
                      if (!canManageProducts) return showNoAccess();

                      setFotoFile(null);
                      setFotoNombre("");
                      const input = document.getElementById(
                        "foto-libro-input"
                      ) as HTMLInputElement | null;
                      if (input) input.value = "";
                    }}
                    deleteIcon={<IconX size={14} />}
                    variant="outlined"
                  />
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    Solo WEBP (.webp). Si tu imagen está en JPG/PNG, conviértela antes.
                  </Typography>
                )}
              </Stack>

              <Stack direction="row" spacing={1} justifyContent="flex-end">
                {editingId !== null && (
                  <Button onClick={cancelarEdicion} disabled={loading} variant="outlined">
                    Cancelar
                  </Button>
                )}

                <Button
                  type="submit"
                  variant="contained"
                  disabled={!canManageProducts || loading}
                  startIcon={
                    editingId !== null ? <IconEdit size={18} /> : <IconPlus size={18} />
                  }
                >
                  {editingId !== null ? "Actualizar" : "Registrar"}
                </Button>
              </Stack>
            </Stack>
          </form>

          <Divider sx={{ my: 3 }} />

          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={2}
            mb={2}
            justifyContent="space-between"
            alignItems={{ xs: "stretch", md: "center" }}
          >
            <Typography variant="body2" color="text.secondary">
              {total} producto(s)
            </Typography>

            <TextField
              size="small"
              label="Buscar"
              placeholder="Código, descripción, editorial, autor, ISBN..."
              value={busquedaGlobal}
              onChange={(e) => setBusquedaGlobal(e.target.value)}
              sx={{ maxWidth: 360 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
              }}
            />
          </Stack>

          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Código</TableCell>
                <TableCell>Código venta</TableCell>
                <TableCell>Descripción</TableCell>
                <TableCell>Editorial</TableCell>
                <TableCell>ISBN</TableCell>
                <TableCell>Autor</TableCell>
                <TableCell>Año</TableCell>
                <TableCell align="center">Catálogo</TableCell>
                <TableCell align="center">Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {paginaProductos.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} align="center">
                    <Typography variant="body2" color="text.secondary">
                      No hay productos para mostrar.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                paginaProductos.map((p) => (
                  <TableRow key={p.id} hover>
                    <TableCell>{p.internal_id}</TableCell>
                    <TableCell>{((p as any).codigo_venta ?? "—") as any}</TableCell>
                    <TableCell>{p.descripcion}</TableCell>
                    <TableCell>{(p as any).editorial ?? "—"}</TableCell>
                    <TableCell>{(p as any).isbn ?? "—"}</TableCell>
                    <TableCell>{(p as any).autor ?? "—"}</TableCell>
                    <TableCell>{(p as any).anio_publicacion ?? "—"}</TableCell>

                    <TableCell align="center">
                      <IconButton
                        size="small"
                        onClick={() => handleTogglePublicado(p)}
                        disabled={!canManageProducts || loading}
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
                      <Stack direction="row" spacing={0.5} justifyContent="center">
                        <IconButton
                          size="small"
                          sx={{ color: "info.main" }}
                          onClick={() => handleClickVerDetalles(p)}
                        >
                          <IconEye size={18} />
                        </IconButton>

                        <IconButton
                          size="small"
                          sx={{ color: "warning.main" }}
                          onClick={() => handleClickEditar(p)}
                          disabled={!canManageProducts || loading}
                        >
                          <IconEdit size={18} />
                        </IconButton>

                        <IconButton
                          size="small"
                          sx={{ color: "error.main" }}
                          onClick={() => handleClickEliminar(p)}
                          disabled={!canManageProducts || loading}
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
            labelDisplayedRows={({ from, to, count }) => `${from}-${to} de ${count}`}
          />
        </CardContent>
      </Card>

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
              </Stack>

              <Divider />

              <Stack spacing={1}>
                <Typography variant="body2">
                  <strong>Código venta:</strong>{" "}
                  {((productoDetalle as any).codigo_venta ?? "—") as any}
                </Typography>
                <Typography variant="body2">
                  <strong>Editorial:</strong> {(productoDetalle as any).editorial ?? "—"}
                </Typography>
                <Typography variant="body2">
                  <strong>ISBN:</strong> {(productoDetalle as any).isbn ?? "—"}
                </Typography>
                <Typography variant="body2">
                  <strong>Autor:</strong> {(productoDetalle as any).autor ?? "—"}
                </Typography>
                <Typography variant="body2">
                  <strong>Edición:</strong> {(productoDetalle as any).edicion ?? "—"}
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

      <ErrorDialog
        open={errorOpen}
        title={errorTitle}
        message={errorMessage}
        onClose={() => setErrorOpen(false)}
      />
    </>
  );
}
