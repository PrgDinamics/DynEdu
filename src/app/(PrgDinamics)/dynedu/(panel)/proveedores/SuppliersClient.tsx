"use client";

import React, {
  useEffect,
  useMemo,
  useState,
  ChangeEvent,
  FormEvent,
} from "react";
import {
  Box,
  Card,
  CardHeader,
  CardContent,
  Typography,
  TextField,
  Button,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Stack,
  IconButton,
  Divider,
  Tooltip,
  InputAdornment,
  TablePagination,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import { IconPlus, IconEdit, IconTrash, IconEye } from "@tabler/icons-react";

import type {
  Proveedor,
  ProveedorCreateInput,
  ProveedorContactoInput,
  ProveedorContacto,
} from "@/modules/dynedu/types";
import {
  createProveedor,
  updateProveedor,
  deleteProveedor,
  getProveedorContactos,
} from "./actions";

type SuppliersClientProps = {
  initialRows: Proveedor[];
};

type FormState = {
  razon_social: string;
  nombre_comercial: string;
  ruc: string;
  direccion: string;
  referencia: string;
  contacto_nombre: string;
  contacto_celular: string;
  contacto_correo: string;
};

const emptyForm: FormState = {
  razon_social: "",
  nombre_comercial: "",
  ruc: "",
  direccion: "",
  referencia: "",
  contacto_nombre: "",
  contacto_celular: "",
  contacto_correo: "",
};

// Contactos adicionales (sin cargo)
type ExtraContactForm = {
  nombre: string;
  celular: string;
  correo: string;
};

const SuppliersClient: React.FC<SuppliersClientProps> = ({ initialRows }) => {
  const [proveedores, setProveedores] = useState<Proveedor[]>(initialRows || []);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(5);

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailProveedor, setDetailProveedor] = useState<Proveedor | null>(null);
  const [detailContacts, setDetailContacts] = useState<ProveedorContacto[]>([]);
  const [detailLoadingContacts, setDetailLoadingContacts] = useState(false);

  // Modal genérico de confirmación (crear / editar / eliminar)
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState("");
  const [pendingAction, setPendingAction] = useState<() => Promise<void>>(
    () => async () => {}
  );

  const [extraContacts, setExtraContacts] = useState<ExtraContactForm[]>([]);

  useEffect(() => {
    setProveedores(initialRows || []);
  }, [initialRows]);

  const proveedorEnEdicion = useMemo(
    () => proveedores.find((p) => p.id === editingId) ?? null,
    [proveedores, editingId]
  );

  const codigoActual = useMemo(() => {
    if (proveedorEnEdicion) return proveedorEnEdicion.internal_id;

    if (proveedores.length === 0) return "PRV0001";

    const maxNum = Math.max(
      ...proveedores.map((p) => {
        const match = p.internal_id.match(/(\d+)$/);
        return match ? parseInt(match[1], 10) : 0;
      })
    );

    const next = maxNum + 1;
    return `PRV${String(next).padStart(4, "0")}`;
  }, [proveedores, proveedorEnEdicion]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  // -------- contactos adicionales (sin cargo) --------

  const handleExtraContactChange = (
    index: number,
    field: keyof ExtraContactForm,
    value: string
  ) => {
    setExtraContacts((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const addExtraContact = () => {
    setExtraContacts((prev) => [
      ...prev,
      { nombre: "", celular: "", correo: "" },
    ]);
  };

  const removeExtraContact = (index: number) => {
    setExtraContacts((prev) => prev.filter((_, i) => i !== index));
  };

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
    setExtraContacts([]);
  };

  const mapExtraContactsToPayload = (): ProveedorContactoInput[] => {
    return extraContacts
      .map((c) => ({
        nombre: c.nombre.trim(),
        celular: c.celular.trim(),
        correo: c.correo.trim(),
        es_principal: false,
      }))
      .filter((c) => c.nombre || c.celular || c.correo);
  };

  // -------- submit (crear / editar) --------

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();

    if (!form.razon_social.trim() || !form.ruc.trim()) {
      alert("Razón social y RUC son obligatorios.");
      return;
    }

    const isEdit = editingId !== null;

    const action = async () => {
      setLoading(true);
      try {
        const baseProveedor: ProveedorCreateInput = {
          internal_id: codigoActual,
          razon_social: form.razon_social.trim(),
          nombre_comercial:
            form.nombre_comercial.trim() === ""
              ? null
              : form.nombre_comercial.trim(),
          ruc: form.ruc.trim(),
          direccion:
            form.direccion.trim() === "" ? null : form.direccion.trim(),
          referencia:
            form.referencia.trim() === "" ? null : form.referencia.trim(),
          contacto_nombre: form.contacto_nombre.trim(),
          contacto_celular: form.contacto_celular.trim(),
          contacto_correo:
            form.contacto_correo.trim() === ""
              ? null
              : form.contacto_correo.trim(),
        };

        const contactosAdicionales = mapExtraContactsToPayload();

        if (isEdit && editingId) {
          const updated = await updateProveedor(editingId, {
            proveedor: baseProveedor,
            contactos: contactosAdicionales,
          });
          if (updated) {
            setProveedores((prev) =>
              prev.map((p) => (p.id === updated.id ? updated : p))
            );
          }
        } else {
          const created = await createProveedor({
            proveedor: baseProveedor,
            contactos: contactosAdicionales,
          });
          if (created) {
            setProveedores((prev) => [created, ...prev]);
          }
        }
      } catch (err) {
        console.error("[SuppliersClient] error al guardar proveedor", err);
        alert("Ocurrió un error al guardar el proveedor.");
      } finally {
        setLoading(false);
        resetForm();
      }
    };

    const resumen = `${codigoActual} – ${form.razon_social || "(sin nombre)"}`;
    setConfirmMessage(
      isEdit
        ? `¿Confirmas actualizar el proveedor ${resumen}?`
        : `¿Confirmas registrar el proveedor ${resumen}?`
    );
    setPendingAction(() => action);
    setConfirmOpen(true);
  };

  const confirmarAccion = async () => {
    setConfirmOpen(false);
    await pendingAction();
  };

  // -------- editar / eliminar / detalle --------

  const handleEdit = async (prov: Proveedor) => {
    setEditingId(prov.id);
    setForm({
      razon_social: prov.razon_social,
      nombre_comercial: prov.nombre_comercial ?? "",
      ruc: prov.ruc,
      direccion: prov.direccion ?? "",
      referencia: prov.referencia ?? "",
      contacto_nombre: prov.contacto_nombre,
      contacto_celular: prov.contacto_celular,
      contacto_correo: prov.contacto_correo ?? "",
    });

    try {
      const contactos = await getProveedorContactos(prov.id);
      setExtraContacts(
        (contactos || [])
          .filter((c) => !c.es_principal)
          .map((c) => ({
            nombre: c.nombre,
            celular: c.celular,
            correo: c.correo,
          }))
      );
    } catch (err) {
      console.error("[SuppliersClient] error al cargar contactos", err);
      setExtraContacts([]);
    }

    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  // AHORA ELIMINAMOS CON MODAL, SIN window.confirm
  const handleDelete = (prov: Proveedor) => {
    const resumen = `${prov.internal_id} - ${prov.razon_social}`;

    const action = async () => {
      setLoading(true);
      try {
        const success = await deleteProveedor(prov.id);
        if (success) {
          setProveedores((prev) => prev.filter((p) => p.id !== prov.id));
          if (editingId === prov.id) resetForm();
        }
      } catch (err) {
        console.error("[SuppliersClient] error al eliminar proveedor", err);
        alert("No se pudo eliminar el proveedor.");
      } finally {
        setLoading(false);
      }
    };

    setConfirmMessage(
      `¿Eliminar al proveedor "${resumen}"? Esta acción no se puede deshacer.`
    );
    setPendingAction(() => action);
    setConfirmOpen(true);
  };

  const handleViewDetail = async (prov: Proveedor) => {
    setDetailProveedor(prov);
    setDetailOpen(true);
    setDetailContacts([]);
    setDetailLoadingContacts(true);

    try {
      const contactos = await getProveedorContactos(prov.id);
      setDetailContacts(
        (contactos || []).filter((c) => !c.es_principal) // solo adicionales
      );
    } catch (err) {
      console.error("[SuppliersClient] error al cargar contactos detalle", err);
      setDetailContacts([]);
    } finally {
      setDetailLoadingContacts(false);
    }
  };

  const closeDetail = () => {
    setDetailOpen(false);
    setDetailProveedor(null);
    setDetailContacts([]);
  };

  // -------- filtro + paginación --------

  const proveedoresFiltrados = useMemo(() => {
    const list = proveedores || [];
    const q = search.trim().toLowerCase();

    if (!q) return list;

    return list.filter((p) => {
      const cod = p.internal_id.toLowerCase();
      const rz = p.razon_social.toLowerCase();
      const nc = (p.nombre_comercial ?? "").toLowerCase();
      const ruc = p.ruc.toLowerCase();
      const contacto = p.contacto_nombre.toLowerCase();
      const correo = (p.contacto_correo ?? "").toLowerCase();

      return (
        cod.includes(q) ||
        rz.includes(q) ||
        nc.includes(q) ||
        ruc.includes(q) ||
        contacto.includes(q) ||
        correo.includes(q)
      );
    });
  }, [proveedores, search]);

  const handleChangePage = (_: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setRowsPerPage(parseInt(e.target.value, 10));
    setPage(0);
  };

  const sliceStart = page * rowsPerPage;
  const sliceEnd = sliceStart + rowsPerPage;
  const paginaProveedores = proveedoresFiltrados.slice(sliceStart, sliceEnd);

  const isDeleteConfirm = confirmMessage.toLowerCase().includes("eliminar");

  // -------- render --------

  return (
    <>
      {/* FORMULARIO */}
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
                {editingId ? "Editar proveedor" : "Registrar proveedor"}
              </Typography>
            </Stack>
          }
          subheader="Completa los datos del proveedor que abastece libros o packs al almacén."
        />
        <CardContent>
          <Box
            component="form"
            onSubmit={handleSubmit}
            sx={{ display: "flex", flexDirection: "column", gap: 2 }}
          >
            <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
              <TextField
                label="Código"
                size="small"
                value={codigoActual}
                InputProps={{ readOnly: true }}
                fullWidth
              />
              <TextField
                label="Razón social"
                name="razon_social"
                size="small"
                value={form.razon_social}
                onChange={handleChange}
                fullWidth
              />
            </Stack>

            <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
              <TextField
                label="Nombre comercial"
                name="nombre_comercial"
                size="small"
                value={form.nombre_comercial}
                onChange={handleChange}
                fullWidth
              />
              <TextField
                label="RUC"
                name="ruc"
                size="small"
                value={form.ruc}
                onChange={handleChange}
                fullWidth
              />
            </Stack>

            <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
              <TextField
                label="Dirección"
                name="direccion"
                size="small"
                value={form.direccion}
                onChange={handleChange}
                fullWidth
              />
              <TextField
                label="Referencia"
                name="referencia"
                size="small"
                value={form.referencia}
                onChange={handleChange}
                fullWidth
              />
            </Stack>

            <Divider sx={{ my: 1 }} />

            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ fontWeight: 600 }}
            >
              Contacto principal
            </Typography>

            <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
              <TextField
                label="Nombre de contacto"
                name="contacto_nombre"
                size="small"
                value={form.contacto_nombre}
                onChange={handleChange}
                fullWidth
              />
              <TextField
                label="Celular"
                name="contacto_celular"
                size="small"
                value={form.contacto_celular}
                onChange={handleChange}
                fullWidth
              />
              <TextField
                label="Correo"
                name="contacto_correo"
                size="small"
                value={form.contacto_correo}
                onChange={handleChange}
                fullWidth
              />
            </Stack>

            {/* CONTACTOS ADICIONALES */}
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ fontWeight: 600, mt: 2 }}
            >
              Contactos adicionales
            </Typography>

            {extraContacts.map((c, index) => (
              <Stack
                key={index}
                direction={{ xs: "column", md: "row" }}
                spacing={2}
                alignItems="center"
                sx={{ mt: 1 }}
              >
                <TextField
                  label="Nombre"
                  size="small"
                  value={c.nombre}
                  onChange={(e) =>
                    handleExtraContactChange(index, "nombre", e.target.value)
                  }
                  fullWidth
                />
                <TextField
                  label="Celular"
                  size="small"
                  value={c.celular}
                  onChange={(e) =>
                    handleExtraContactChange(index, "celular", e.target.value)
                  }
                  fullWidth
                />
                <TextField
                  label="Correo"
                  size="small"
                  value={c.correo}
                  onChange={(e) =>
                    handleExtraContactChange(index, "correo", e.target.value)
                  }
                  fullWidth
                />
                <Button
                  variant="text"
                  color="error"
                  onClick={() => removeExtraContact(index)}
                >
                  Quitar
                </Button>
              </Stack>
            ))}

            <Button
              variant="outlined"
              size="small"
              sx={{ mt: extraContacts.length ? 1 : 0, alignSelf: "flex-start" }}
              onClick={addExtraContact}
            >
              + Añadir contacto
            </Button>

            <Stack
              direction="row"
              justifyContent="flex-end"
              spacing={1.5}
              mt={1}
            >
              {editingId && (
                <Button variant="text" onClick={resetForm}>
                  Cancelar edición
                </Button>
              )}
              <Button
                type="submit"
                variant="contained"
                startIcon={<IconPlus size={18} />}
                disabled={loading}
              >
                {editingId ? "Guardar cambios" : "Agregar proveedor"}
              </Button>
            </Stack>
          </Box>
        </CardContent>
      </Card>

      {/* TABLA */}
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
              Proveedores registrados
            </Typography>
          }
          action={
            <TextField
              size="small"
              placeholder="Buscar por nombre, RUC o contacto..."
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
                <TableCell>Razón social</TableCell>
                <TableCell>Nombre comercial</TableCell>
                <TableCell>RUC</TableCell>
                <TableCell>Contacto</TableCell>
                <TableCell>Celular</TableCell>
                <TableCell>Correo</TableCell>
                <TableCell align="center">Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {paginaProveedores.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8}>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      align="center"
                    >
                      No hay proveedores registrados todavía.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                paginaProveedores.map((p) => (
                  <TableRow key={p.id} hover>
                    <TableCell sx={{ fontWeight: 500 }}>
                      {p.internal_id}
                    </TableCell>
                    <TableCell>{p.razon_social}</TableCell>
                    <TableCell>{p.nombre_comercial ?? ""}</TableCell>
                    <TableCell>{p.ruc}</TableCell>
                    <TableCell>{p.contacto_nombre}</TableCell>
                    <TableCell>{p.contacto_celular}</TableCell>
                    <TableCell>{p.contacto_correo ?? ""}</TableCell>
                    <TableCell align="center">
                      <Stack
                        direction="row"
                        spacing={0.5}
                        justifyContent="center"
                      >
                        <Tooltip title="Ver detalles">
                          <IconButton
                            size="small"
                            sx={{ color: "info.main" }}
                            onClick={() => handleViewDetail(p)}
                          >
                            <IconEye size={18} />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Editar">
                          <IconButton
                            size="small"
                            sx={{ color: "warning.main" }}
                            onClick={() => handleEdit(p)}
                          >
                            <IconEdit size={18} />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Eliminar">
                          <IconButton
                            size="small"
                            sx={{ color: "error.main" }}
                            onClick={() => handleDelete(p)}
                          >
                            <IconTrash size={18} />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          <TablePagination
            component="div"
            count={proveedoresFiltrados.length}
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

      {/* MODAL CONFIRMACIÓN (crear / editar / eliminar) */}
      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)}>
        <DialogTitle>
          {isDeleteConfirm ? "Confirmar eliminación" : "Confirmar acción"}
        </DialogTitle>
        <DialogContent>
          <Typography>{confirmMessage}</Typography>
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

      {/* MODAL DETALLE */}
      <Dialog open={detailOpen} onClose={closeDetail} maxWidth="sm" fullWidth>
        <DialogTitle>Detalle del proveedor</DialogTitle>
        <DialogContent dividers>
          {detailProveedor && (
            <Stack spacing={2}>
              <Stack direction="row" spacing={1} alignItems="center">
                <Chip
                  label={detailProveedor.internal_id}
                  size="small"
                  color="primary"
                  variant="outlined"
                />
                <Typography variant="subtitle1" fontWeight={600}>
                  {detailProveedor.razon_social}
                </Typography>
              </Stack>

              <Divider />

              <Stack spacing={1}>
                <Typography variant="body2">
                  <strong>Nombre comercial:</strong>{" "}
                  {detailProveedor.nombre_comercial ?? ""}
                </Typography>
                <Typography variant="body2">
                  <strong>RUC:</strong> {detailProveedor.ruc}
                </Typography>
                <Typography variant="body2">
                  <strong>Dirección:</strong>{" "}
                  {detailProveedor.direccion ?? ""}
                </Typography>
                <Typography variant="body2">
                  <strong>Referencia:</strong>{" "}
                  {detailProveedor.referencia ?? ""}
                </Typography>
              </Stack>

              <Divider />

              <Stack spacing={1}>
                <Typography variant="subtitle2" fontWeight={600}>
                  Contacto principal
                </Typography>
                <Typography variant="body2">
                  <strong>Nombre:</strong>{" "}
                  {detailProveedor.contacto_nombre || ""}
                </Typography>
                <Typography variant="body2">
                  <strong>Celular:</strong>{" "}
                  {detailProveedor.contacto_celular || ""}
                </Typography>
                <Typography variant="body2">
                  <strong>Correo:</strong>{" "}
                  {detailProveedor.contacto_correo ?? ""}
                </Typography>
              </Stack>

              <Divider />

              <Stack spacing={1}>
                <Typography variant="subtitle2" fontWeight={600}>
                  Contactos adicionales
                </Typography>

                {detailLoadingContacts ? (
                  <Typography variant="body2" color="text.secondary">
                    Cargando contactos...
                  </Typography>
                ) : detailContacts.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    No hay contactos adicionales registrados.
                  </Typography>
                ) : (
                  <Stack spacing={0.5}>
                    {detailContacts.map((c) => (
                      <Typography key={c.id} variant="body2">
                        • {c.nombre}
                        {c.celular ? ` – ${c.celular}` : ""}
                        {c.correo ? ` – ${c.correo}` : ""}
                      </Typography>
                    ))}
                  </Stack>
                )}
              </Stack>

              <Divider />

              <Stack spacing={1}>
                <Typography variant="subtitle2" fontWeight={600}>
                  Resumen de pedidos
                </Typography>
                <Typography variant="body2">
                  <strong>Total pedidos:</strong>{" "}
                  {detailProveedor.total_pedidos ?? 0}
                </Typography>
                <Typography variant="body2">
                  <strong>Total unidades:</strong>{" "}
                  {detailProveedor.total_unidades ?? 0}
                </Typography>
              </Stack>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDetail}>Cerrar</Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default SuppliersClient;
