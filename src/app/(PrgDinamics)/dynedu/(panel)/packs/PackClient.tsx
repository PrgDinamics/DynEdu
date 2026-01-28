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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  Chip,
  Switch,
  FormControlLabel,
} from "@mui/material";
import Autocomplete from "@mui/material/Autocomplete";
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

import {
  crearPack,
  actualizarPack,
  eliminarPack,
  generarCodigoPack,
  setPackPublicado,
} from "./actions";

type ProductoResumen = {
  id: number;
  internal_id: string;
  codigo_venta?: string | null;
  descripcion: string;
};

type PackItemRow = {
  id?: number;
  cantidad?: number | null;
  producto_id?: number | null;
  productos: {
    id: number;
    internal_id: string;
    codigo_venta?: string | null;
    descripcion: string;
  } | null;
};

type PackRow = {
  id: number;
  internal_id?: string | null;
  codigo?: string | null;
  codigo_venta?: string | null;
  nombre: string;
  descripcion?: string | null;
  is_public?: boolean | null;
  foto_url?: string | null;
  items?: PackItemRow[] | null;
};

type Props = {
  initialPacks: PackRow[];
  productos: ProductoResumen[];
};

type DyneduMe = {
  ok: boolean;
  user?: {
    permissions?: Record<string, boolean>;
  };
};

const STORAGE_BUCKET = "pack-images";

function sanitizeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

async function uploadPackImage(packId: number, file: File) {
  const nameLower = file.name.toLowerCase();
  const isWebpByExt = nameLower.endsWith(".webp");
  const isWebpByMime = file.type === "image/webp";

  if (!isWebpByExt && !isWebpByMime) {
    throw new Error("Only WEBP files are allowed.");
  }

  const supabase = createSupabaseBrowserClient();

  const safeName = sanitizeFileName(file.name);
  const path = `packs/${packId}/${Date.now()}_${safeName}`;

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

export default function PackClient({ initialPacks, productos }: Props) {
  const [packs, setPacks] = useState<PackRow[]>(initialPacks || []);
  const [loading, setLoading] = useState(false);

  // auth/permissions
  const [me, setMe] = useState<DyneduMe | null>(null);
  const permissions = me?.user?.permissions ?? {};
  const canManagePacks = permissions?.canManagePacks === true;

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

  // error dialog
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
      "No tienes permiso para gestionar packs. Solo puedes visualizar."
    );
  };

  // form fields (like products)
  const [codigo, setCodigo] = useState("");
  const [codigoVenta, setCodigoVenta] = useState("");
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [isPublic, setIsPublic] = useState(false);

  // items (create only; edit keeps items read-only)
  const [itemsDraft, setItemsDraft] = useState<Array<{ producto_id: number; cantidad: number }>>(
    []
  );
  const [selectedProduct, setSelectedProduct] = useState<ProductoResumen | null>(null);
  const [productoInput, setProductoInput] = useState("");

  // photo (same UX as products)
  const [fotoFile, setFotoFile] = useState<File | null>(null);
  const [fotoNombre, setFotoNombre] = useState<string>("");

  // search + pagination
  const [busquedaGlobal, setBusquedaGlobal] = useState("");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(5);

  // edit
  const [editingId, setEditingId] = useState<number | null>(null);
  const isEditing = editingId !== null;

  // details modal
  const [openDetalle, setOpenDetalle] = useState(false);
  const [packDetalle, setPackDetalle] = useState<PackRow | null>(null);

  const cargarSiguienteCodigo = async () => {
    try {
      const next = await generarCodigoPack();
      if (next) {
        setCodigo(next);
        // default codigo venta like products UX (user can override)
        setCodigoVenta(next);
      }
    } catch (err) {
      console.error("Error generating pack code", err);
    }
  };

  useEffect(() => {
    cargarSiguienteCodigo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const limpiarFormulario = () => {
    setNombre("");
    setDescripcion("");
    setIsPublic(false);
    setCodigoVenta(codigo); // keep default aligned
    setItemsDraft([]);
    setSelectedProduct(null);
    setProductoInput("");

    setFotoFile(null);
    setFotoNombre("");

    setEditingId(null);
  };

  const manejarCambioArchivo = (e: ChangeEvent<HTMLInputElement>) => {
    if (!canManagePacks) {
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

  // items
  const handleAddProduct = () => {
    if (!canManagePacks) return showNoAccess();
    if (isEditing) return; // keep items read-only in edit for now

    if (!selectedProduct) return;

    if (itemsDraft.some((i) => i.producto_id === selectedProduct.id)) return;

    setItemsDraft((prev) => [...prev, { producto_id: selectedProduct.id, cantidad: 1 }]);
    setSelectedProduct(null);
    setProductoInput("");
  };

  const handleRemoveItem = (producto_id: number) => {
    if (!canManagePacks) return showNoAccess();
    if (isEditing) return;

    setItemsDraft((prev) => prev.filter((i) => i.producto_id !== producto_id));
  };

  // filtering
  const packsFiltrados = useMemo(() => {
    const q = busquedaGlobal.trim().toLowerCase();
    if (!q) return packs;

    return (packs || []).filter((p) => {
      const cod = (p.internal_id ?? p.codigo ?? "").toLowerCase();
      const codVenta = (p.codigo_venta ?? "").toLowerCase();
      const nom = (p.nombre ?? "").toLowerCase();
      const desc = (p.descripcion ?? "").toLowerCase();
      const blob = `${cod} ${codVenta} ${nom} ${desc}`;
      return blob.includes(q);
    });
  }, [packs, busquedaGlobal]);

  const paginaPacks = useMemo(() => {
    const start = page * rowsPerPage;
    const end = start + rowsPerPage;
    return packsFiltrados.slice(start, end);
  }, [packsFiltrados, page, rowsPerPage]);

  const handleChangePage = (_: unknown, newPage: number) => setPage(newPage);

  const handleChangeRowsPerPage = (
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setRowsPerPage(parseInt(e.target.value, 10));
    setPage(0);
  };

  // submit (create/update)
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();

    if (!canManagePacks) return showNoAccess();

    const nombreFinal = nombre.trim();
    if (!nombreFinal) {
      showError("Campos incompletos", "El nombre del pack es obligatorio.");
      return;
    }

    if (!isEditing && itemsDraft.length === 0) {
      showError("Campos incompletos", "Debes agregar al menos un producto al pack.");
      return;
    }

    const accion = async () => {
      try {
        setLoading(true);

        // CREATE
        if (!isEditing) {
          const creado = (await crearPack({
            nombre: nombreFinal,
            descripcion: descripcion.trim() || null,
            codigo_venta: codigoVenta.trim() ? codigoVenta.trim() : null,
            is_public: isPublic,
            items: itemsDraft,
          })) as PackRow;

          let creadoFinal: PackRow = creado;

          if (fotoFile) {
            const publicUrl = await uploadPackImage(creado.id, fotoFile);

            await actualizarPack(creado.id, {
              foto_url: publicUrl,
              // keep safe fields
              nombre: creado.nombre ?? nombreFinal,
              codigo_venta: (creado as any).codigo_venta ?? (codigoVenta.trim() || null),
              is_public: Boolean((creado as any).is_public),
            } as any);

            creadoFinal = { ...(creado as any), foto_url: publicUrl } as any;
          }

          setPacks((prev) => [creadoFinal, ...prev]);
          limpiarFormulario();
          await cargarSiguienteCodigo();
          return;
        }

        // UPDATE
        if (editingId !== null) {
          let fotoUrlToSet: string | null | undefined = undefined;

          if (fotoFile) {
            fotoUrlToSet = await uploadPackImage(editingId, fotoFile);
          }

          const payload = {
            nombre: nombreFinal,
            descripcion: descripcion.trim() || null,
            codigo_venta: codigoVenta.trim() ? codigoVenta.trim() : null,
            is_public: isPublic,
            ...(fotoUrlToSet ? { foto_url: fotoUrlToSet } : {}),
          };

          await actualizarPack(editingId, payload as any);

          setPacks((prev) =>
            prev.map((p) =>
              p.id === editingId
                ? ({
                    ...p,
                    ...payload,
                    foto_url: fotoUrlToSet ? fotoUrlToSet : p.foto_url,
                  } as any)
                : p
            )
          );

          limpiarFormulario();
          await cargarSiguienteCodigo();
        }
      } catch (err: any) {
        console.error("Error saving pack", err);

        const raw =
          err?.message ||
          err?.error_description ||
          err?.details ||
          "Ocurrió un error al guardar el pack.";

        const rawStr = String(raw).toLowerCase();
        let friendly = String(raw);

        if (rawStr.includes("not authorized")) {
          friendly = "No tienes permiso para gestionar packs.";
        } else if (
          rawStr.includes("storage.objects") ||
          rawStr.includes("bucket") ||
          rawStr.includes("object") ||
          rawStr.includes("storage")
        ) {
          friendly =
            "No se pudo subir la imagen (Storage RLS). Revisa policies del bucket pack-images y asegúrate de estar logueado.";
        } else if (rawStr.includes("row-level security")) {
          friendly =
            "No tienes permisos para guardar (RLS). Revisa policies de INSERT/UPDATE en Supabase para la tabla packs.";
        }

        showError("No se pudo guardar el pack", friendly);
      } finally {
        setLoading(false);
      }
    };

    // simple confirm like products (direct run)
    accion();
  };

  // row actions
  const handleClickVerDetalles = (p: PackRow) => {
    setPackDetalle(p);
    setOpenDetalle(true);
  };

  const cerrarDetalle = () => {
    setOpenDetalle(false);
    setPackDetalle(null);
  };

  const handleClickEditar = (p: PackRow) => {
    if (!canManagePacks) return showNoAccess();

    setEditingId(p.id);
    setCodigo(p.internal_id ?? p.codigo ?? "");
    setCodigoVenta(p.codigo_venta ?? (p.internal_id ?? p.codigo ?? ""));
    setNombre(p.nombre ?? "");
    setDescripcion(p.descripcion ?? "");
    setIsPublic(Boolean(p.is_public));

    // items read-only in edit
    setItemsDraft([]);
    setSelectedProduct(null);
    setProductoInput("");

    setFotoFile(null);
    setFotoNombre("");

    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleClickEliminar = async (p: PackRow) => {
    if (!canManagePacks) return showNoAccess();

    const resumen = `${p.internal_id ?? p.codigo ?? ""} – ${p.nombre ?? ""}`;

    const ok = confirm(`¿Confirmas eliminar el pack ${resumen}?`);
    if (!ok) return;

    try {
      setLoading(true);
      await eliminarPack(p.id);
      setPacks((prev) => prev.filter((x) => x.id !== p.id));
    } catch (err: any) {
      console.error("Error deleting pack", err);
      const msg = String(err?.message || "No se pudo eliminar el pack.");
      showError(
        "No se pudo eliminar",
        msg.includes("not authorized")
          ? "No tienes permiso para gestionar packs."
          : msg
      );
    } finally {
      setLoading(false);
    }
  };

  const handleTogglePublicado = async (p: PackRow) => {
    if (!canManagePacks) return showNoAccess();

    try {
      setLoading(true);
      const nuevoEstado = !Boolean(p.is_public);
      await setPackPublicado(p.id, nuevoEstado);

      setPacks((prev) =>
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
          ? "No tienes permiso para gestionar packs."
          : msg
      );
    } finally {
      setLoading(false);
    }
  };

  const cancelarEdicion = async () => {
    limpiarFormulario();
    await cargarSiguienteCodigo();
  };

  const renderPackItems = (p: PackRow) => {
    const list = p.items ?? [];
    if (!list.length) return "—";

    return list.map((it, idx) => {
      const prod = it.productos;
      const qty = it.cantidad ?? 1;

      if (!prod) return <div key={idx}>Producto no encontrado × {qty}</div>;

      const cv = prod.codigo_venta ? `(${prod.codigo_venta})` : "";
      return (
        <div key={idx}>
          {prod.internal_id}{cv} — {prod.descripcion} × {qty}
        </div>
      );
    });
  };

  return (
    <>
      <Card sx={{ borderRadius: 3 }}>
        <CardHeader
          title="Packs"
          subheader="Agrupa varios libros en un pack para asignarlos a colegios y pedidos."
        />

        <CardContent>
          {!canManagePacks && (
            <Box sx={{ mb: 2 }}>
              <Chip label="Modo solo lectura." variant="outlined" color="warning" />
            </Box>
          )}

          <form onSubmit={handleSubmit}>
            <Stack spacing={2}>
              <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                <TextField
                  label="Código Interno"
                  value={codigo}
                  inputProps={{ readOnly: true }}
                  size="small"
                  fullWidth
                  disabled={!canManagePacks || loading}
                />
                <TextField
                  label="Código de Venta"
                  value={codigoVenta}
                  onChange={(e) => setCodigoVenta(e.target.value)}
                  size="small"
                  fullWidth
                  disabled={!canManagePacks || loading}
                />
              </Stack>

              <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                <TextField
                  label="Nombre del pack"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  size="small"
                  fullWidth
                  disabled={!canManagePacks || loading}
                />
                <TextField
                  label="Descripción"
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  size="small"
                  fullWidth
                  disabled={!canManagePacks || loading}
                />
              </Stack>

              <FormControlLabel
                control={
                  <Switch
                    checked={isPublic}
                    onChange={(e) => setIsPublic(e.target.checked)}
                    disabled={!canManagePacks || loading}
                  />
                }
                label="Publicar en catálogo"
              />

              <Stack direction={{ xs: "column", md: "row" }} spacing={1} alignItems="center">
                <Button
                  component="label"
                  variant="outlined"
                  startIcon={<IconUpload size={18} />}
                  disabled={!canManagePacks || loading}
                >
                  Seleccionar imagen
                  <input
                    id="foto-pack-input"
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
                      if (!canManagePacks) return showNoAccess();

                      setFotoFile(null);
                      setFotoNombre("");
                      const input = document.getElementById(
                        "foto-pack-input"
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

              <Divider sx={{ my: 2 }} />

              <Typography variant="body2" fontWeight={600}>
                Productos del pack
              </Typography>

              {isEditing && (
                <Typography variant="caption" color="text.secondary">
                  En edición: por ahora los productos del pack se mantienen (solo lectura).
                </Typography>
              )}

              <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems="flex-end">
                <Autocomplete
                  size="small"
                  fullWidth
                  options={productos}
                  value={selectedProduct}
                  inputValue={productoInput}
                  onChange={(_, v) => setSelectedProduct(v)}
                  onInputChange={(_, v) => setProductoInput(v)}
                  getOptionLabel={(o) =>
                    `${o.internal_id}${o.codigo_venta ? ` (${o.codigo_venta})` : ""} — ${o.descripcion}`
                  }
                  disabled={!canManagePacks || loading || isEditing}
                  renderInput={(params) => (
                    <TextField {...params} label="Buscar producto" placeholder="Código o nombre" />
                  )}
                />

                <Button
                  type="button"
                  variant="contained"
                  startIcon={<IconPlus size={18} />}
                  onClick={handleAddProduct}
                  disabled={!canManagePacks || loading || isEditing}
                >
                  Agregar producto
                </Button>
              </Stack>

              {!isEditing && itemsDraft.length > 0 && (
                <Box>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Producto</TableCell>
                        <TableCell width={90}>Cant.</TableCell>
                        <TableCell width={90} />
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {itemsDraft.map((it) => {
                        const prod = productos.find((p) => p.id === it.producto_id);
                        return (
                          <TableRow key={it.producto_id}>
                            <TableCell>
                              {prod
                                ? `${prod.internal_id}${prod.codigo_venta ? ` (${prod.codigo_venta})` : ""} — ${prod.descripcion}`
                                : `ID ${it.producto_id}`}
                            </TableCell>
                            <TableCell>{it.cantidad}</TableCell>
                            <TableCell align="right">
                              <IconButton
                                size="small"
                                sx={{ color: "error.main" }}
                                onClick={() => handleRemoveItem(it.producto_id)}
                                disabled={!canManagePacks || loading}
                              >
                                <IconTrash size={18} />
                              </IconButton>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </Box>
              )}

              <Stack direction="row" spacing={1} justifyContent="flex-end">
                {isEditing && (
                  <Button onClick={cancelarEdicion} disabled={loading} variant="outlined">
                    Cancelar
                  </Button>
                )}

                <Button
                  type="submit"
                  variant="contained"
                  disabled={!canManagePacks || loading}
                  startIcon={isEditing ? <IconEdit size={18} /> : <IconPlus size={18} />}
                >
                  {isEditing ? "Actualizar" : "Registrar Pack"}
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
              {packsFiltrados.length} pack(s)
            </Typography>

            <TextField
              size="small"
              label="Buscar"
              placeholder="Código, código venta, nombre, descripción..."
              value={busquedaGlobal}
              onChange={(e) => setBusquedaGlobal(e.target.value)}
              sx={{ maxWidth: 360 }}
            />
          </Stack>

          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Código</TableCell>
                <TableCell>Código de Venta</TableCell>
                <TableCell>Nombre</TableCell>
                <TableCell>Productos</TableCell>
                <TableCell>Descripción</TableCell>
                <TableCell align="center">Catálogo</TableCell>
                <TableCell align="center">Acciones</TableCell>
              </TableRow>
            </TableHead>

            <TableBody>
              {paginaPacks.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center">
                    <Typography variant="body2" color="text.secondary">
                      No hay packs para mostrar.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                paginaPacks.map((p) => (
                  <TableRow key={p.id} hover>
                    <TableCell>{p.internal_id ?? p.codigo ?? "—"}</TableCell>
                    <TableCell>{p.codigo_venta ?? "—"}</TableCell>
                    <TableCell>{p.nombre}</TableCell>
                    <TableCell>{renderPackItems(p)}</TableCell>
                    <TableCell>{p.descripcion ?? ""}</TableCell>

                    <TableCell align="center">
                      <IconButton
                        size="small"
                        onClick={() => handleTogglePublicado(p)}
                        disabled={!canManagePacks || loading}
                        sx={{
                          color: Boolean(p.is_public) ? "success.main" : "text.secondary",
                        }}
                        title={
                          Boolean(p.is_public)
                            ? "Publicado (click para ocultar)"
                            : "Oculto (click para publicar)"
                        }
                      >
                        {Boolean(p.is_public) ? <IconEye size={18} /> : <IconEyeOff size={18} />}
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
                          disabled={!canManagePacks || loading}
                        >
                          <IconEdit size={18} />
                        </IconButton>

                        <IconButton
                          size="small"
                          sx={{ color: "error.main" }}
                          onClick={() => handleClickEliminar(p)}
                          disabled={!canManagePacks || loading}
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

      {/* Details modal (like products) */}
      <Dialog open={openDetalle} onClose={cerrarDetalle} maxWidth="sm" fullWidth>
        <DialogTitle>Detalle del pack</DialogTitle>
        <DialogContent dividers>
          {packDetalle && (
            <Stack spacing={2}>
              <Stack direction="row" spacing={1} alignItems="center">
                <Chip
                  label={packDetalle.internal_id ?? packDetalle.codigo ?? "—"}
                  size="small"
                  color="primary"
                  variant="outlined"
                />
                {Boolean(packDetalle.is_public) ? (
                  <Chip label="Publicado" size="small" color="success" variant="outlined" />
                ) : (
                  <Chip label="Oculto" size="small" color="default" variant="outlined" />
                )}
              </Stack>

              <Divider />

              <Stack spacing={1}>
                <Typography variant="body2">
                  <strong>Código venta:</strong> {packDetalle.codigo_venta ?? "—"}
                </Typography>
                <Typography variant="body2">
                  <strong>Nombre:</strong> {packDetalle.nombre ?? "—"}
                </Typography>
                <Typography variant="body2">
                  <strong>Descripción:</strong> {packDetalle.descripcion ?? "—"}
                </Typography>

                <Divider />

                <Typography variant="body2" fontWeight={600}>
                  Productos
                </Typography>

                <Box>
                  {packDetalle.items?.length ? (
                    packDetalle.items.map((it, idx) => {
                      const prod = it.productos;
                      const qty = it.cantidad ?? 1;

                      if (!prod) return <div key={idx}>Producto no encontrado × {qty}</div>;

                      return (
                        <div key={idx}>
                          {prod.internal_id}
                          {prod.codigo_venta ? ` (${prod.codigo_venta})` : ""} — {prod.descripcion} × {qty}
                        </div>
                      );
                    })
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      Sin productos.
                    </Typography>
                  )}
                </Box>
              </Stack>

              {packDetalle.foto_url && (
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
                      src={packDetalle.foto_url}
                      alt={packDetalle.nombre}
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
