"use client";

import React, { useMemo, useState } from "react";

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
  MenuItem,
  Divider,
} from "@mui/material";

import { IconEye, IconEdit, IconTrash, IconKey } from "@tabler/icons-react";
import type { AppRole, AppUser } from "@/modules/settings/users/types";

import {
  createUser,
  resetUserPassword,
  updateUser,
  deactivateUser,
  updateRolePermissions, // ✅ NEW
} from "./actions";

type Props = {
  initialRoles: AppRole[];
  initialUsers: AppUser[];
};

type PermissionMap = Record<string, boolean>;

type UserFormState = {
  username: string;
  fullName: string;
  email: string;
  roleId: number | "";
  isActive: boolean;
};

const emptyForm: UserFormState = {
  username: "",
  fullName: "",
  email: "",
  roleId: "",
  isActive: true,
};

type PermissionDef = { key: string; label: string };

const UsuarioRolesClient: React.FC<Props> = ({ initialRoles, initialUsers }) => {
  // ✅ antes: const [roles] = useState...
  const [roles, setRoles] = useState<AppRole[]>(initialRoles);
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

  // password modal
  const [passOpen, setPassOpen] = useState(false);
  const [passTitle, setPassTitle] = useState<string>("Contraseña generada");
  const [generatedPassword, setGeneratedPassword] = useState<string>("");

  // ✅ Permisos modal
  const [permOpen, setPermOpen] = useState(false);
  const [permRole, setPermRole] = useState<AppRole | null>(null);
  const [permDraft, setPermDraft] = useState<PermissionMap>({});
  const [savingPerms, setSavingPerms] = useState(false);

  const permissionGroups = useMemo(() => {
    const groups: { title: string; items: PermissionDef[] }[] = [
      { title: "GENERAL", items: [{ key: "canViewDashboard", label: "Ver dashboard" }] },

      {
        title: "CATÁLOGO",
        items: [
          { key: "canViewProducts", label: "Ver productos" },
          { key: "canManageProducts", label: "Gestionar productos" },
          { key: "canViewPacks", label: "Ver packs" },
          { key: "canManagePacks", label: "Gestionar packs" },
          { key: "canViewPriceCatalog", label: "Ver catálogo de precios" },
          { key: "canManagePriceCatalog", label: "Gestionar catálogo de precios" },
          { key: "canViewSuppliers", label: "Ver proveedores" },
          { key: "canManageSuppliers", label: "Gestionar proveedores" },
          { key: "canViewActivity", label: "Ver actividad" },
        ],
      },

      {
        title: "INVENTARIO",
        items: [
          { key: "canViewStock", label: "Ver stock" },
          { key: "canAdjustStock", label: "Ajustar stock (sensible)" },
          { key: "canViewInventoryMovements", label: "Ver movimientos" },
          { key: "canCreateInventoryMovements", label: "Crear movimientos" },
        ],
      },

      {
        title: "OPERACIONES",
        items: [
          { key: "canViewOrders", label: "Ver pedidos" },
          { key: "canCloseOrders", label: "Cerrar pedidos" },
          { key: "canViewConsignations", label: "Ver consignaciones" },
          { key: "canApproveConsign", label: "Aprobar/denegar consignaciones" },
          { key: "canCloseConsign", label: "Cerrar consignaciones" },
          { key: "canViewTracking", label: "Ver tracking" },
          { key: "canCommentTracking", label: "Comentar tracking" },
          { key: "canChangeTrackingStatus", label: "Cambiar estado tracking" },
        ],
      },

      {
        title: "ALMACÉN",
        items: [
          { key: "canViewKardex", label: "Ver kardex" },
          { key: "canExportKardex", label: "Exportar kardex" },
        ],
      },

      {
        title: "REPORTES",
        items: [
          { key: "canViewSalesCollections", label: "Ver ventas y cobranzas" },
          { key: "canExportSalesCollections", label: "Exportar ventas y cobranzas" },
        ],
      },

      {
        title: "CONFIGURACIÓN",
        items: [
          { key: "canManageGeneralSettings", label: "Gestionar configuración general" },
          { key: "canManageUsers", label: "Gestionar usuarios" },
          { key: "canManageRoles", label: "Gestionar roles" },
        ],
      },
    ];

    return groups;
  }, []);

  const getRoleById = (roleId: number) => roles.find((r) => r.id === roleId) || null;

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
      username: user.username,
      fullName: user.fullName,
      email: user.email,
      roleId: user.roleId,
      isActive: user.isActive,
    });
    setEditOpen(true);
  };

  // ✅ Abrir permisos
  const openPermsModal = (role: AppRole) => {
    setPermRole(role);

    // Si tu AppRole no incluye permissions, igual arranca vacío.
    const roleAny = role as any;
    const initialPerms: PermissionMap =
      roleAny?.permissions && typeof roleAny.permissions === "object"
        ? (roleAny.permissions as PermissionMap)
        : {};

    setPermDraft(initialPerms);
    setPermOpen(true);
  };

  const togglePerm = (key: string) => {
    setPermDraft((prev) => ({ ...prev, [key]: !(prev[key] === true) }));
  };

  const savePerms = async () => {
    if (!permRole) return;

    try {
      setSavingPerms(true);
      const updated = await updateRolePermissions(permRole.id, permDraft);

      if (updated) {
        // guardamos en estado para que al reabrir ya tenga lo nuevo
        setRoles((prev) =>
          prev.map((r) => (r.id === (updated as any).id ? (updated as any) : r)),
        );
      }

      setPermOpen(false);
      setPermRole(null);
    } catch (e) {
      console.error(e);
      alert("No se pudieron guardar los permisos del rol.");
    } finally {
      setSavingPerms(false);
    }
  };

  const handleCreateUser = async () => {
    if (
      !createForm.username.trim() ||
      !createForm.fullName.trim() ||
      !createForm.email.trim() ||
      createForm.roleId === ""
    ) {
      alert("Completa username, nombre, correo y rol para crear un usuario.");
      return;
    }

    try {
      setCreating(true);

      const result = await createUser({
        username: createForm.username,
        fullName: createForm.fullName,
        email: createForm.email,
        roleId: Number(createForm.roleId),
        isActive: createForm.isActive,
      });

      if (result?.user) {
        setUsers((prev) => [...prev, result.user]);
        setCreateForm(emptyForm);

        setPassTitle("Contraseña generada");
        setGeneratedPassword((result as any).generatedPassword ?? (result as any).password ?? "");
        setPassOpen(true);
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

    if (!editForm.fullName.trim() || !editForm.email.trim() || editForm.roleId === "") {
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
        setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
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

  const handleResetPassword = async (user: AppUser) => {
    const ok = window.confirm(
      `¿Generar una nueva contraseña para "${user.username}"? (La anterior dejará de funcionar)`,
    );
    if (!ok) return;

    try {
      const res = await resetUserPassword(user.id);
      setPassTitle(`Nueva contraseña • ${user.username}`);
      setGeneratedPassword((res as any).generatedPassword ?? (res as any).password ?? "");
      setPassOpen(true);
    } catch (error) {
      console.error(error);
      alert("No se pudo resetear la contraseña.");
    }
  };

  const handleDeactivateUser = async (user: AppUser) => {
    const ok = window.confirm(`¿Desactivar al usuario "${user.fullName}" (${user.email})?`);
    if (!ok) return;

    try {
      await deactivateUser(user.id);
      setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, isActive: false } : u)));
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
        Gestiona los usuarios internos de PRG Dinamics y asigna su rol: SuperAdmin, Administrador u Operador.
      </Typography>

      {/* CREAR USUARIO */}
      <Card elevation={0} sx={{ mb: 3, borderRadius: 3, border: "1px solid", borderColor: "divider" }}>
        <CardContent>
          <Typography variant="h6" fontWeight={600} mb={1}>
            Crear usuario interno
          </Typography>
          <Typography variant="body2" color="text.secondary" mb={2}>
            Registra un nuevo usuario del equipo y define su nivel de acceso al sistema.
          </Typography>

          <Stack spacing={2}>
            <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
              <TextField
                label="Username (no cambia)"
                fullWidth
                size="small"
                value={createForm.username}
                onChange={(e) => handleCreateChange("username", e.target.value)}
              />
              <TextField
                label="Nombre completo"
                fullWidth
                size="small"
                value={createForm.fullName}
                onChange={(e) => handleCreateChange("fullName", e.target.value)}
              />
            </Stack>

            <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
              <TextField
                label="Correo"
                type="email"
                fullWidth
                size="small"
                value={createForm.email}
                onChange={(e) => handleCreateChange("email", e.target.value)}
              />
              <TextField
                select
                label="Rol"
                fullWidth
                size="small"
                value={createForm.roleId}
                onChange={(e) => handleCreateChange("roleId", Number(e.target.value))}
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
                    onChange={(_, checked) => handleCreateChange("isActive", checked)}
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
      <Card elevation={0} sx={{ mb: 3, borderRadius: 3, border: "1px solid", borderColor: "divider" }}>
        <CardContent>
          <Typography variant="h6" fontWeight={600} mb={2}>
            Usuarios internos
          </Typography>

          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Username</TableCell>
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
                    <TableCell sx={{ fontWeight: 600 }}>{u.username}</TableCell>
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
                      {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : "—"}
                    </TableCell>
                    <TableCell align="center">
                      <Stack direction="row" spacing={1} justifyContent="center">
                        <Tooltip title="Ver detalle">
                          <IconButton size="small" sx={{ color: "primary.main" }} onClick={() => openViewModal(u)}>
                            <IconEye size={18} stroke={1.8} />
                          </IconButton>
                        </Tooltip>

                        <Tooltip title="Editar usuario">
                          <IconButton size="small" sx={{ color: "warning.main" }} onClick={() => openEditModal(u)}>
                            <IconEdit size={18} stroke={1.8} />
                          </IconButton>
                        </Tooltip>

                        <Tooltip title="Resetear contraseña">
                          <IconButton size="small" sx={{ color: "info.main" }} onClick={() => handleResetPassword(u)}>
                            <IconKey size={18} stroke={1.8} />
                          </IconButton>
                        </Tooltip>

                        <Tooltip title="Desactivar usuario">
                          <IconButton size="small" sx={{ color: "error.main" }} onClick={() => handleDeactivateUser(u)}>
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
      <Card elevation={0} sx={{ mb: 4, borderRadius: 3, border: "1px solid", borderColor: "divider" }}>
        <CardContent>
          <Typography variant="h6" fontWeight={600} mb={1}>
            Roles del sistema
          </Typography>
          <Typography variant="body2" color="text.secondary" mb={2}>
            Estos son los roles disponibles y su función general: SuperAdmin, Administrador y Operador.
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
                  gap: 2,
                }}
              >
                <Box>
                  <Typography variant="subtitle2">{role.name}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {role.description || ""}
                  </Typography>
                </Box>

                <Stack direction="row" spacing={1} alignItems="center">
                  {role.isDefault && <Chip size="small" label="Rol por defecto" color="primary" />}

                  {/* ✅ BOTÓN QUE FALTABA */}
                  <Button variant="outlined" size="small" onClick={() => openPermsModal(role)}>
                    Permisos
                  </Button>
                </Stack>
              </Box>
            ))}
          </Stack>
        </CardContent>
      </Card>

      {/* ✅ MODAL PERMISOS */}
      <Dialog open={permOpen} onClose={() => setPermOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Permisos del rol: {permRole?.name ?? ""}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            {permissionGroups.map((g) => (
              <Box key={g.title}>
                <Typography variant="subtitle2" fontWeight={700} mb={1}>
                  {g.title}
                </Typography>

                <Stack spacing={0.5}>
                  {g.items.map((p) => (
                    <FormControlLabel
                      key={p.key}
                      control={
                        <Switch
                          checked={permDraft[p.key] === true}
                          onChange={() => togglePerm(p.key)}
                        />
                      }
                      label={p.label}
                    />
                  ))}
                </Stack>

                <Divider sx={{ mt: 2 }} />
              </Box>
            ))}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPermOpen(false)}>Cancelar</Button>
          <Button variant="contained" onClick={savePerms} disabled={savingPerms}>
            {savingPerms ? "Guardando..." : "Guardar permisos"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* MODAL VER DETALLE */}
      <Dialog open={viewOpen} onClose={() => setViewOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Detalle del usuario</DialogTitle>
        <DialogContent dividers>
          {viewUser && (
            <Stack spacing={1.5}>
              <Stack spacing={0.3}>
                <Typography variant="body2" color="text.secondary">
                  Nombre completo:
                </Typography>
                <Typography variant="subtitle2">{viewUser.fullName}</Typography>
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
                  {viewUser.lastLoginAt ? new Date(viewUser.lastLoginAt).toLocaleString() : "—"}
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
      <Dialog open={editOpen} onClose={() => setEditOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Editar usuario</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} mt={1}>
            <TextField
              label="Username"
              fullWidth
              size="small"
              value={editForm.username}
              disabled
              helperText="El username no se puede cambiar"
            />
            <TextField
              label="Nombre completo"
              fullWidth
              size="small"
              value={editForm.fullName}
              onChange={(e) => handleEditChange("fullName", e.target.value)}
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
              onChange={(e) => handleEditChange("roleId", Number(e.target.value))}
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
                  onChange={(_, checked) => handleEditChange("isActive", checked)}
                />
              }
              label="Usuario activo"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditOpen(false)}>Cancelar</Button>
          <Button variant="contained" onClick={handleSaveEdit} disabled={savingEdit}>
            {savingEdit ? "Guardando..." : "Guardar cambios"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* MODAL CONTRASEÑA GENERADA */}
      <Dialog open={passOpen} onClose={() => setPassOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{passTitle}</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" color="text.secondary" mb={1}>
            Copia y comparte esta contraseña. Por seguridad, no se vuelve a mostrar automáticamente.
          </Typography>
          <Box
            sx={{
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 2,
              p: 1.5,
              fontFamily: "monospace",
              fontSize: 16,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 2,
            }}
          >
            <span>{generatedPassword || "—"}</span>
            <Button
              size="small"
              variant="outlined"
              onClick={() => {
                if (!generatedPassword) return;
                navigator.clipboard.writeText(generatedPassword);
              }}
            >
              Copiar
            </Button>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPassOpen(false)}>Cerrar</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default UsuarioRolesClient;
