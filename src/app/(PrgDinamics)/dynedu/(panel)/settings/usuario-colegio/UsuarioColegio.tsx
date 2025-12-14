"use client";

import React, { useState } from "react";
import {
  Box,
  Card,
  CardContent,
  Typography,
  Stack,
  Button,
  TextField,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Switch,
  FormControlLabel,
  Divider,
} from "@mui/material";

import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";

import { IconEdit, IconTrash, IconEye } from "@tabler/icons-react";

import type { Colegio } from "@/modules/dynedu/types";
import { createColegio, updateColegio, deleteColegio } from "./actions";

type Props = {
  initialColegios: Colegio[];
};

type ColegioFormState = {
  ruc: string;
  razon_social: string;
  nombre: string;
  direccion: string;
  referencia: string;
  contacto_nombre: string;
  contacto_email: string;
  contacto_celular: string;
  activo: boolean;
};

const emptyForm: ColegioFormState = {
  ruc: "",
  razon_social: "",
  nombre: "",
  direccion: "",
  referencia: "",
  contacto_nombre: "",
  contacto_email: "",
  contacto_celular: "",
  activo: true,
};

const UsuarioColegio: React.FC<Props> = ({ initialColegios }) => {
  const [colegios, setColegios] = useState<Colegio[]>(initialColegios);
  const [showKeys, setShowKeys] = useState<boolean>(false);

  // Form creación
  const [createForm, setCreateForm] = useState<ColegioFormState>(emptyForm);
  const [creating, setCreating] = useState(false);

  // Modal editar
  const [openEditModal, setOpenEditModal] = useState(false);
  const [selected, setSelected] = useState<Colegio | null>(null);
  const [modalForm, setModalForm] = useState<ColegioFormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  // Modal detalle (solo lectura)
  const [openViewModal, setOpenViewModal] = useState(false);
  const [viewColegio, setViewColegio] = useState<Colegio | null>(null);

  const handleChangeCreate = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = e.target;
    setCreateForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleChangeModal = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = e.target;
    setModalForm((prev) => ({ ...prev, [name]: value }));
  };

  const openEditForColegio = (c: Colegio) => {
    setSelected(c);
    setModalForm({
      ruc: c.ruc,
      razon_social: c.razon_social || "",
      nombre: c.nombre,
      direccion: c.direccion || "",
      referencia: c.referencia || "",
      contacto_nombre: c.contacto_nombre || "",
      contacto_email: c.contacto_email || "",
      contacto_celular: c.contacto_celular || "",
      activo: c.activo,
    });
    setOpenEditModal(true);
  };

  const openViewForColegio = (c: Colegio) => {
    setViewColegio(c);
    setOpenViewModal(true);
  };

  const handleCrearColegio = async () => {
    if (!createForm.nombre.trim() || !createForm.ruc.trim()) return;

    try {
      setCreating(true);
      const created = await createColegio({
        ruc: createForm.ruc.trim(),
        razon_social: createForm.razon_social.trim(),
        nombre: createForm.nombre.trim(),
        direccion: createForm.direccion.trim() || undefined,
        referencia: createForm.referencia.trim() || undefined,
        contacto_nombre: createForm.contacto_nombre.trim() || undefined,
        contacto_email: createForm.contacto_email.trim() || undefined,
        contacto_celular: createForm.contacto_celular.trim() || undefined,
      });

      if (created) {
        setColegios((prev) => [...prev, created]);
        setCreateForm(emptyForm);
      }
    } catch (error) {
      console.error(error);
      alert("Hubo un problema al crear el colegio.");
    } finally {
      setCreating(false);
    }
  };

  const handleGuardarModal = async () => {
    if (!selected) return;
    if (!modalForm.nombre.trim() || !modalForm.ruc.trim()) return;

    try {
      setSaving(true);
      const updated = await updateColegio(selected.id, {
        ruc: modalForm.ruc.trim(),
        razon_social: modalForm.razon_social.trim(),
        nombre: modalForm.nombre.trim(),
        direccion: modalForm.direccion.trim() || undefined,
        referencia: modalForm.referencia.trim() || undefined,
        contacto_nombre: modalForm.contacto_nombre.trim() || undefined,
        contacto_email: modalForm.contacto_email.trim() || undefined,
        contacto_celular: modalForm.contacto_celular.trim() || undefined,
        activo: modalForm.activo,
      });

      if (updated) {
        setColegios((prev) =>
          prev.map((c) => (c.id === updated.id ? updated : c)),
        );
        setOpenEditModal(false);
        setSelected(null);
      }
    } catch (error) {
      console.error(error);
      alert("Hubo un problema al actualizar el colegio.");
    } finally {
      setSaving(false);
    }
  };

  const handleEliminarColegio = async (c: Colegio) => {
    const ok = window.confirm(
      `¿Eliminar el colegio "${c.nombre}" (${c.ruc})? Esta acción no se puede deshacer.`,
    );
    if (!ok) return;

    try {
      await deleteColegio(c.id);
      setColegios((prev) => prev.filter((x) => x.id !== c.id));
      if (selected?.id === c.id) {
        setOpenEditModal(false);
        setSelected(null);
      }
      if (viewColegio?.id === c.id) {
        setOpenViewModal(false);
        setViewColegio(null);
      }
    } catch (error) {
      console.error(error);
      alert("Hubo un problema al eliminar el colegio.");
    }
  };

  const handleCopyKey = async (key: string | null) => {
    if (!key) return;
    try {
      await navigator.clipboard.writeText(key);
      alert("Clave copiada al portapapeles");
    } catch {
      alert("No se pudo copiar la clave");
    }
  };

  return (
    <Box>
      <Typography variant="h4" fontWeight={600} mb={0.5}>
        Colegios
      </Typography>
      <Typography variant="body2" color="text.secondary" mb={3}>
        Aquí registras los colegiosy se genera la
        clave de acceso que les vas a entregar para su portal.
      </Typography>

      {/* FORM CREACIÓN */}
      <Card
        elevation={0}
        sx={{
          borderRadius: 3,
          border: "1px solid",
          borderColor: "divider",
          mb: 3,
        }}
      >
        <CardContent>
          <Typography variant="h6" fontWeight={600} mb={2}>
            Crear colegio y clave de acceso
          </Typography>

          <Stack spacing={2}>
            <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
              <TextField
                label="RUC"
                name="ruc"
                fullWidth
                size="small"
                value={createForm.ruc}
                onChange={handleChangeCreate}
              />
              <TextField
                label="Razón social"
                name="razon_social"
                fullWidth
                size="small"
                value={createForm.razon_social}
                onChange={handleChangeCreate}
              />
              <TextField
                label="Nombre"
                name="nombre"
                fullWidth
                size="small"
                value={createForm.nombre}
                onChange={handleChangeCreate}
              />
            </Stack>

            <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
              <TextField
                label="Dirección"
                name="direccion"
                fullWidth
                size="small"
                value={createForm.direccion}
                onChange={handleChangeCreate}
              />
              <TextField
                label="Referencia"
                name="referencia"
                fullWidth
                size="small"
                value={createForm.referencia}
                onChange={handleChangeCreate}
              />
            </Stack>

            <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
              <TextField
                label="Contacto"
                name="contacto_nombre"
                fullWidth
                size="small"
                value={createForm.contacto_nombre}
                onChange={handleChangeCreate}
              />
              <TextField
                label="Contacto email"
                name="contacto_email"
                fullWidth
                size="small"
                value={createForm.contacto_email}
                onChange={handleChangeCreate}
              />
              <TextField
                label="Contacto celular"
                name="contacto_celular"
                fullWidth
                size="small"
                value={createForm.contacto_celular}
                onChange={handleChangeCreate}
              />
            </Stack>

            <Stack direction="row" justifyContent="flex-end">
              <Button
                variant="contained"
                sx={{ minWidth: 180 }}
                onClick={handleCrearColegio}
                disabled={creating}
              >
                {creating ? "Creando..." : "Crear colegio"}
              </Button>
            </Stack>
          </Stack>
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
        <CardContent>
          <Typography variant="h6" fontWeight={600} mb={2}>
            Colegios registrados
          </Typography>

          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Colegio</TableCell>
                <TableCell>RUC</TableCell>
                <TableCell>Contacto</TableCell>
                <TableCell>Contacto email</TableCell>
                <TableCell>Contacto celular</TableCell>
                <TableCell>Clave acceso</TableCell>
                <TableCell align="center">Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {colegios.map((c) => (
                <TableRow key={c.id} hover>
                  <TableCell>{c.nombre}</TableCell>
                  <TableCell>{c.ruc}</TableCell>
                  <TableCell>{c.contacto_nombre || "—"}</TableCell>
                  <TableCell>{c.contacto_email || "—"}</TableCell>
                  <TableCell>{c.contacto_celular || "—"}</TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography
                        variant="body2"
                        sx={{ fontFamily: "monospace" }}
                      >
                        {showKeys ? c.access_key || "—" : "••••••••••"}
                      </Typography>
                      {c.access_key && (
                        <Tooltip title="Copiar clave">
                          <IconButton
                            size="small"
                            onClick={() => handleCopyKey(c.access_key)}
                          >
                            <ContentCopyIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                    </Stack>
                  </TableCell>
                  <TableCell align="center">
                    <Stack
                      direction="row"
                      spacing={1}
                      justifyContent="center"
                    >
                      {/* Ver detalle (solo lectura) */}
                      <Tooltip title="Ver detalle">
                        <IconButton
                          size="small"
                          sx={{ color: "primary.main" }}
                          onClick={() => openViewForColegio(c)}
                        >
                          <IconEye size={18} stroke={1.8} />
                        </IconButton>
                      </Tooltip>

                      {/* Editar */}
                      <Tooltip title="Editar">
                        <IconButton
                          size="small"
                          sx={{ color: "warning.main" }}
                          onClick={() => openEditForColegio(c)}
                        >
                          <IconEdit size={18} stroke={1.8} />
                        </IconButton>
                      </Tooltip>

                      {/* Eliminar */}
                      <Tooltip title="Eliminar">
                        <IconButton
                          size="small"
                          sx={{ color: "error.main" }}
                          onClick={() => handleEliminarColegio(c)}
                        >
                          <IconTrash size={18} stroke={1.8} />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <Stack direction="row" justifyContent="flex-end" mt={1}>
            <Button
              size="small"
              startIcon={
                showKeys ? <VisibilityOffIcon /> : <VisibilityIcon />
              }
              onClick={() => setShowKeys((v) => !v)}
            >
              {showKeys ? "Ocultar claves" : "Mostrar claves"}
            </Button>
          </Stack>
        </CardContent>
      </Card>

      {/* MODAL DETALLE (solo lectura) */}
      <Dialog
        open={openViewModal}
        onClose={() => setOpenViewModal(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Detalle del colegio</DialogTitle>
        <DialogContent dividers>
          {viewColegio && (
            <Stack spacing={2}>
              <Stack spacing={0.5}>
                <Typography variant="body2" color="text.secondary">
                  RUC:
                </Typography>
                <Typography variant="subtitle2">
                  {viewColegio.ruc}
                </Typography>
              </Stack>

              <Stack spacing={0.5}>
                <Typography variant="body2" color="text.secondary">
                  Razón social:
                </Typography>
                <Typography variant="subtitle2">
                  {viewColegio.razon_social || "—"}
                </Typography>
              </Stack>

              <Stack spacing={0.5}>
                <Typography variant="body2" color="text.secondary">
                  Nombre:
                </Typography>
                <Typography variant="subtitle2">
                  {viewColegio.nombre}
                </Typography>
              </Stack>

              <Divider sx={{ my: 1 }} />

              <Stack spacing={0.5}>
                <Typography variant="body2" color="text.secondary">
                  Dirección:
                </Typography>
                <Typography variant="subtitle2">
                  {viewColegio.direccion || "—"}
                </Typography>
              </Stack>

              <Stack spacing={0.5}>
                <Typography variant="body2" color="text.secondary">
                  Referencia:
                </Typography>
                <Typography variant="subtitle2">
                  {viewColegio.referencia || "—"}
                </Typography>
              </Stack>

              <Divider sx={{ my: 1 }} />

              <Stack spacing={0.5}>
                <Typography variant="body2" color="text.secondary">
                  Contacto:
                </Typography>
                <Typography variant="subtitle2">
                  {viewColegio.contacto_nombre || "—"}
                </Typography>
              </Stack>

              <Stack spacing={0.5}>
                <Typography variant="body2" color="text.secondary">
                  Contacto email:
                </Typography>
                <Typography variant="subtitle2">
                  {viewColegio.contacto_email || "—"}
                </Typography>
              </Stack>

              <Stack spacing={0.5}>
                <Typography variant="body2" color="text.secondary">
                  Contacto celular:
                </Typography>
                <Typography variant="subtitle2">
                  {viewColegio.contacto_celular || "—"}
                </Typography>
              </Stack>

              <Divider sx={{ my: 1 }} />

              <Stack spacing={0.5}>
                <Typography variant="body2" color="text.secondary">
                  Estado:
                </Typography>
                <Typography
                  variant="subtitle2"
                  fontWeight={700}
                  color={viewColegio.activo ? "success.main" : "error.main"}
                >
                  {viewColegio.activo ? "ACTIVO" : "INACTIVO"}
                </Typography>
              </Stack>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenViewModal(false)}>Cerrar</Button>
        </DialogActions>
      </Dialog>

      {/* MODAL EDITAR (igual que antes) */}
      <Dialog
        open={openEditModal}
        onClose={() => setOpenEditModal(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Detalle del colegio</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} mt={1}>
            <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
              <TextField
                label="RUC"
                name="ruc"
                fullWidth
                size="small"
                value={modalForm.ruc}
                onChange={handleChangeModal}
              />
              <TextField
                label="Razón social"
                name="razon_social"
                fullWidth
                size="small"
                value={modalForm.razon_social}
                onChange={handleChangeModal}
              />
              <TextField
                label="Nombre (como lo conocemos)"
                name="nombre"
                fullWidth
                size="small"
                value={modalForm.nombre}
                onChange={handleChangeModal}
              />
            </Stack>

            <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
              <TextField
                label="Dirección"
                name="direccion"
                fullWidth
                size="small"
                value={modalForm.direccion}
                onChange={handleChangeModal}
              />
              <TextField
                label="Referencia"
                name="referencia"
                fullWidth
                size="small"
                value={modalForm.referencia}
                onChange={handleChangeModal}
              />
            </Stack>

            <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
              <TextField
                label="Contacto"
                name="contacto_nombre"
                fullWidth
                size="small"
                value={modalForm.contacto_nombre}
                onChange={handleChangeModal}
              />
              <TextField
                label="Contacto email"
                name="contacto_email"
                fullWidth
                size="small"
                value={modalForm.contacto_email}
                onChange={handleChangeModal}
              />
              <TextField
                label="Contacto celular"
                name="contacto_celular"
                fullWidth
                size="small"
                value={modalForm.contacto_celular}
                onChange={handleChangeModal}
              />
            </Stack>

            <FormControlLabel
              control={
                <Switch
                  checked={modalForm.activo}
                  onChange={(_, checked) =>
                    setModalForm((prev) => ({ ...prev, activo: checked }))
                  }
                />
              }
              label="Colegio activo"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenEditModal(false)}>Cerrar</Button>
          <Button
            variant="contained"
            onClick={handleGuardarModal}
            disabled={saving}
          >
            {saving ? "Guardando..." : "Guardar cambios"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default UsuarioColegio;
