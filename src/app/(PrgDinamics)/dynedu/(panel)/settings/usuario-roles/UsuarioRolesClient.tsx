"use client";

import React, { useState } from "react";

import {
  Box,
  Card,
  CardContent,
  Typography,
  Stack,
  TextField,
  Button,
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
  Chip,
  MenuItem
  
} from "@mui/material";

import { IconEye, IconEdit, IconTrash } from "@tabler/icons-react";
import type { AppRole, AppUser } from "@/modules/settings/users/types";


import { createUser, updateUser, deactivateUser } from "./actions";

type Props = {
  initialRoles: AppRole[];
  initialUsers: AppUser[];
};

type UserFormState = {
  fullName: string;
  email: string;
  roleId: number | "";
  isActive: boolean;
};

const emptyForm: UserFormState = {
  fullName: "",
  email: "",
  roleId: "",
  isActive: true,
};

const UsuarioRolesClient: React.FC<Props> = ({ initialRoles, initialUsers }) => {
  const [roles] = useState<AppRole[]>(initialRoles);
  const [users, setUsers] = useState<AppUser[]>(initialUsers);

  // creación
  const [createForm, setCreateForm] = useState<UserFormState>(emptyForm);
  const [creating, setCreating] = useState(false);

  // modal ver
  const [viewOpen, setViewOpen] = useState(false);
  const [viewUser, setViewUser] = useState<AppUser | null>(null);

  // modal editar
  const [editOpen, setEditOpen] = useState(false);
  const [editUser, setEditUser] = useState<AppUser | null>(null);
  const [editForm, setEditForm] = useState<UserFormState>(emptyForm);
  const [savingEdit, setSavingEdit] = useState(false);

  const getRoleById = (roleId: number) =>
    roles.find((r) => r.id === roleId) || null;

  const handleCreateChange = (
    field: keyof UserFormState,
    value: string | boolean | number | "",
  ) => {
    setCreateForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleEditChange = (
    field: keyof UserFormState,
    value: string | boolean | number | "",
  ) => {
    setEditForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const openViewModal = (user: AppUser) => {
    setViewUser(user);
    setViewOpen(true);
  };

  const openEditModal = (user: AppUser) => {
    setEditUser(user);
    setEditForm({
      fullName: user.fullName,
      email: user.email,
      roleId: user.roleId,
      isActive: user.isActive,
    });
    setEditOpen(true);
  };

  const handleCreateUser = async () => {
    if (
      !createForm.fullName.trim() ||
      !createForm.email.trim() ||
      createForm.roleId === ""
    ) {
      alert("Completa nombre, correo y rol para crear un usuario.");
      return;
    }

    try {
      setCreating(true);

      const created = await createUser({
        fullName: createForm.fullName,
        email: createForm.email,
        roleId: Number(createForm.roleId),
        isActive: createForm.isActive,
      });

      if (created) {
        setUsers((prev) => [...prev, created]);
        setCreateForm(emptyForm);
      }
    } catch (error) {
      console.error(error);
      alert("Hubo un problema al crear el usuario.");
    } finally {
      setCreating(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!editUser) return;

    if (
      !editForm.fullName.trim() ||
      !editForm.email.trim() ||
      editForm.roleId === ""
    ) {
      alert("Completa nombre, correo y rol para actualizar el usuario.");
      return;
    }

    try {
      setSavingEdit(true);

      const updated = await updateUser(editUser.id, {
        fullName: editForm.fullName,
        email: editForm.email,
        roleId: Number(editForm.roleId),
        isActive: editForm.isActive,
      });

      if (updated) {
        setUsers((prev) =>
          prev.map((u) => (u.id === updated.id ? updated : u)),
        );
        setEditOpen(false);
        setEditUser(null);
      }
    } catch (error) {
      console.error(error);
      alert("Hubo un problema al actualizar el usuario.");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeactivateUser = async (user: AppUser) => {
    const ok = window.confirm(
      `¿Desactivar al usuario "${user.fullName}" (${user.email})?`,
    );
    if (!ok) return;

    try {
      await deactivateUser(user.id);
      setUsers((prev) =>
        prev.map((u) =>
          u.id === user.id ? { ...u, isActive: false } : u,
        ),
      );
    } catch (error) {
      console.error(error);
      alert("Hubo un problema al desactivar el usuario.");
    }
  };

  return (
    <Box>
      <Typography variant="h4" fontWeight={600} mb={0.5}>
        Usuarios y roles
      </Typography>
      <Typography variant="body2" color="text.secondary" mb={3}>
        Gestiona los usuarios internos de PRG Dinamics y asigna su rol:
        SuperAdmin, Administrador u Operador.
      </Typography>

      {/* CREAR USUARIO */}
      <Card
        elevation={0}
        sx={{
          mb: 3,
          borderRadius: 3,
          border: "1px solid",
          borderColor: "divider",
        }}
      >
        <CardContent>
          <Typography variant="h6" fontWeight={600} mb={1}>
            Crear usuario interno
          </Typography>
          <Typography variant="body2" color="text.secondary" mb={2}>
            Registra un nuevo usuario del equipo y define su nivel de acceso al
            sistema.
          </Typography>

          <Stack spacing={2}>
            <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
              <TextField
                label="Nombre completo"
                fullWidth
                size="small"
                value={createForm.fullName}
                onChange={(e) =>
                  handleCreateChange("fullName", e.target.value)
                }
              />
              <TextField
                label="Correo"
                type="email"
                fullWidth
                size="small"
                value={createForm.email}
                onChange={(e) =>
                  handleCreateChange("email", e.target.value)
                }
              />
            </Stack>

            <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
              <TextField
                select
                label="Rol"
                fullWidth
                size="small"
                value={createForm.roleId}
                onChange={(e) =>
                  handleCreateChange("roleId", Number(e.target.value))
                }
              >
                {roles.map((role) => (
                  <MenuItem key={role.id} value={role.id}>
                    {role.name}
                  </MenuItem>
                ))}
              </TextField>

              <FormControlLabel
                control={
                  <Switch
                    checked={createForm.isActive}
                    onChange={(_, checked) =>
                      handleCreateChange("isActive", checked)
                    }
                  />
                }
                label="Usuario activo"
              />
            </Stack>

            <Stack direction="row" justifyContent="flex-end">
              <Button
                variant="contained"
                sx={{ minWidth: 180 }}
                onClick={handleCreateUser}
                disabled={creating}
              >
                {creating ? "Creando..." : "Crear usuario"}
              </Button>
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      {/* LISTA DE USUARIOS */}
      <Card
        elevation={0}
        sx={{
          mb: 3,
          borderRadius: 3,
          border: "1px solid",
          borderColor: "divider",
        }}
      >
        <CardContent>
          <Typography variant="h6" fontWeight={600} mb={2}>
            Usuarios internos
          </Typography>

          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Nombre</TableCell>
                <TableCell>Correo</TableCell>
                <TableCell>Rol</TableCell>
                <TableCell>Estado</TableCell>
                <TableCell>Último acceso</TableCell>
                <TableCell align="center">Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {users.map((u) => {
                const role = getRoleById(u.roleId);
                return (
                  <TableRow key={u.id} hover>
                    <TableCell>{u.fullName}</TableCell>
                    <TableCell>{u.email}</TableCell>
                    <TableCell>{role ? role.name : "—"}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={u.isActive ? "Activo" : "Inactivo"}
                        color={u.isActive ? "success" : "default"}
                        variant={u.isActive ? "filled" : "outlined"}
                      />
                    </TableCell>
                    <TableCell>
                      {u.lastLoginAt
                        ? new Date(u.lastLoginAt).toLocaleString()
                        : "—"}
                    </TableCell>
                    <TableCell align="center">
                      <Stack
                        direction="row"
                        spacing={1}
                        justifyContent="center"
                      >
                        <Tooltip title="Ver detalle">
                          <IconButton
                            size="small"
                            sx={{ color: "primary.main" }}
                            onClick={() => openViewModal(u)}
                          >
                            <IconEye size={18} stroke={1.8} />
                          </IconButton>
                        </Tooltip>

                        <Tooltip title="Editar usuario">
                          <IconButton
                            size="small"
                            sx={{ color: "warning.main" }}
                            onClick={() => openEditModal(u)}
                          >
                            <IconEdit size={18} stroke={1.8} />
                          </IconButton>
                        </Tooltip>

                        <Tooltip title="Desactivar usuario">
                          <IconButton
                            size="small"
                            sx={{ color: "error.main" }}
                            onClick={() => handleDeactivateUser(u)}
                          >
                            <IconTrash size={18} stroke={1.8} />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* LISTA DE ROLES */}
      <Card
        elevation={0}
        sx={{
          mb: 4,
          borderRadius: 3,
          border: "1px solid",
          borderColor: "divider",
        }}
      >
        <CardContent>
          <Typography variant="h6" fontWeight={600} mb={1}>
            Roles del sistema
          </Typography>
          <Typography variant="body2" color="text.secondary" mb={2}>
            Estos son los roles disponibles y su función general:
            SuperAdmin, Administrador y Operador.
          </Typography>

          <Stack spacing={1.5}>
            {roles.map((role) => (
              <Box
                key={role.id}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  borderRadius: 2,
                  border: "1px solid",
                  borderColor: "divider",
                  px: 2,
                  py: 1,
                }}
              >
                <Box>
                  <Typography variant="subtitle2">{role.name}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {role.description || ""}
                  </Typography>
                </Box>
                {role.isDefault && (
                  <Chip size="small" label="Rol por defecto" color="primary" />
                )}
              </Box>
            ))}
          </Stack>
        </CardContent>
      </Card>

      {/* MODAL VER DETALLE */}
      <Dialog
        open={viewOpen}
        onClose={() => setViewOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Detalle del usuario</DialogTitle>
        <DialogContent dividers>
          {viewUser && (
            <Stack spacing={1.5}>
              <Stack spacing={0.3}>
                <Typography variant="body2" color="text.secondary">
                  Nombre completo:
                </Typography>
                <Typography variant="subtitle2">
                  {viewUser.fullName}
                </Typography>
              </Stack>

              <Stack spacing={0.3}>
                <Typography variant="body2" color="text.secondary">
                  Correo:
                </Typography>
                <Typography variant="subtitle2">{viewUser.email}</Typography>
              </Stack>

              <Stack spacing={0.3}>
                <Typography variant="body2" color="text.secondary">
                  Rol:
                </Typography>
                <Typography variant="subtitle2">
                  {getRoleById(viewUser.roleId)?.name ?? "—"}
                </Typography>
              </Stack>

              <Stack spacing={0.3}>
                <Typography variant="body2" color="text.secondary">
                  Estado:
                </Typography>
                <Typography
                  variant="subtitle2"
                  color={viewUser.isActive ? "success.main" : "text.secondary"}
                >
                  {viewUser.isActive ? "Activo" : "Inactivo"}
                </Typography>
              </Stack>

              <Stack spacing={0.3}>
                <Typography variant="body2" color="text.secondary">
                  Último acceso:
                </Typography>
                <Typography variant="subtitle2">
                  {viewUser.lastLoginAt
                    ? new Date(viewUser.lastLoginAt).toLocaleString()
                    : "—"}
                </Typography>
              </Stack>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setViewOpen(false)}>Cerrar</Button>
        </DialogActions>
      </Dialog>

      {/* MODAL EDITAR USUARIO */}
      <Dialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Editar usuario</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} mt={1}>
            <TextField
              label="Nombre completo"
              fullWidth
              size="small"
              value={editForm.fullName}
              onChange={(e) =>
                handleEditChange("fullName", e.target.value)
              }
            />
            <TextField
              label="Correo"
              type="email"
              fullWidth
              size="small"
              value={editForm.email}
              onChange={(e) => handleEditChange("email", e.target.value)}
            />
            <TextField
              select
              label="Rol"
              fullWidth
              size="small"
              value={editForm.roleId}
              onChange={(e) =>
                handleEditChange("roleId", Number(e.target.value))
              }
            >
              {roles.map((role) => (
                <MenuItem key={role.id} value={role.id}>
                  {role.name}
                </MenuItem>
              ))}
            </TextField>

            <FormControlLabel
              control={
                <Switch
                  checked={editForm.isActive}
                  onChange={(_, checked) =>
                    handleEditChange("isActive", checked)
                  }
                />
              }
              label="Usuario activo"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditOpen(false)}>Cancelar</Button>
          <Button
            variant="contained"
            onClick={handleSaveEdit}
            disabled={savingEdit}
          >
            {savingEdit ? "Guardando..." : "Guardar cambios"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default UsuarioRolesClient;
