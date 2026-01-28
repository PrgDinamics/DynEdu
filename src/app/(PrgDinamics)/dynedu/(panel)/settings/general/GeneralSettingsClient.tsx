// src/app/(PrgDinamics)/settings/general/GeneralSettingsClient.tsx
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
  Divider,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Chip,
  Snackbar,
  Alert,
} from "@mui/material";

import type { GeneralSettings } from "@/modules/settings/types";
import {
  activateCampaign,
  closeCampaign,
  createCampaign,
  getActiveCampaign,
  listCampaigns,
  saveGeneralSettings,
  type ActiveCampaignViewRow,
  type CampaignRow,
} from "./actions";

type Props = {
  initialSettings: GeneralSettings;
  initialCampaigns: CampaignRow[];
  initialActiveCampaign: ActiveCampaignViewRow | null;
};

const GeneralSettingsClient: React.FC<Props> = ({
  initialSettings,
  initialCampaigns,
  initialActiveCampaign,
}) => {
  const [settings, setSettings] = useState<GeneralSettings>(initialSettings);
  const [saving, setSaving] = useState(false);

  const [campaigns, setCampaigns] = useState<CampaignRow[]>(initialCampaigns);
  const [activeCampaign, setActiveCampaign] =
    useState<ActiveCampaignViewRow | null>(initialActiveCampaign);
  const [campaignBusyId, setCampaignBusyId] = useState<string | null>(null);

  const [toast, setToast] = useState<{
    open: boolean;
    message: string;
    severity: "success" | "error" | "warning" | "info";
  }>({ open: false, message: "", severity: "info" });

  const showToast = (
    message: string,
    severity: "success" | "error" | "warning" | "info" = "info",
  ) => setToast({ open: true, message, severity });

  const closeToast = () => setToast((t) => ({ ...t, open: false }));

  const nextDefault = useMemo(() => {
    const fallbackYear = new Date().getFullYear();
    const latest = campaigns?.[0];

    const yearFromLatest = latest?.start_date
      ? Number(String(latest.start_date).slice(0, 4))
      : fallbackYear;

    const year = Number.isFinite(yearFromLatest)
      ? yearFromLatest + 1
      : fallbackYear;

    const start = `${year}-01-01`;
    const end = `${year}-12-31`;

    return {
      name: `Campaña ${year}`,
      start_date: start,
      end_date: end,
      timezone: "America/Lima",
    };
  }, [campaigns]);

  const [newCampaign, setNewCampaign] = useState({
    name: nextDefault.name,
    start_date: nextDefault.start_date,
    end_date: nextDefault.end_date,
    timezone: nextDefault.timezone,
  });

  React.useEffect(() => {
    setNewCampaign({
      name: nextDefault.name,
      start_date: nextDefault.start_date,
      end_date: nextDefault.end_date,
      timezone: nextDefault.timezone,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nextDefault.name, nextDefault.start_date, nextDefault.end_date]);

  // --- Empresa ---
  const handleCompanyChange = (
    field: keyof GeneralSettings["company"],
    value: string,
  ) => {
    setSettings((prev) => ({
      ...prev,
      company: {
        ...prev.company,
        [field]: value,
      },
    }));
  };

  const refreshCampaigns = async () => {
    const [freshCampaigns, freshActive] = await Promise.all([
      listCampaigns(),
      getActiveCampaign(),
    ]);
    setCampaigns(freshCampaigns);
    setActiveCampaign(freshActive);
  };

  const handleCreateCampaign = async () => {
    try {
      setCampaignBusyId("__create__");
      await createCampaign({
        name: newCampaign.name.trim(),
        start_date: newCampaign.start_date,
        end_date: newCampaign.end_date,
        timezone: newCampaign.timezone,
      });
      await refreshCampaigns();
      showToast("Campaña creada.", "success");
    } catch (e) {
      console.error(e);
      showToast("No se pudo crear la campaña.", "error");
    } finally {
      setCampaignBusyId(null);
    }
  };

  const handleActivate = async (id: string) => {
    try {
      setCampaignBusyId(id);
      await activateCampaign(id);
      await refreshCampaigns();
    } catch (e) {
      console.error(e);
      showToast("No se pudo activar la campaña.", "error");
    } finally {
      setCampaignBusyId(null);
    }
  };

  const handleClose = async (id: string) => {
    try {
      setCampaignBusyId(id);
      await closeCampaign(id);
      await refreshCampaigns();
    } catch (e) {
      console.error(e);
      showToast("No se pudo cerrar la campaña.", "error");
    } finally {
      setCampaignBusyId(null);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await saveGeneralSettings(settings);
      showToast("Configuración guardada correctamente.", "success");
    } catch (error) {
      console.error(error);
      showToast("Hubo un problema al guardar la configuración.", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box>
      <Typography variant="h4" fontWeight={600} mb={0.5}>
        Configuración general
      </Typography>
      <Typography variant="body2" color="text.secondary" mb={3}>
        Ajusta la información general de PRG Dinamics y gestiona campañas (año
        académico).
      </Typography>

      {/* CAMPAÑAS */}
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
          <Box
            display="flex"
            alignItems="flex-start"
            justifyContent="space-between"
            gap={2}
            mb={1}
          >
            <Box>
              <Typography variant="h6" fontWeight={600}>
                Campañas
              </Typography>
              <Typography variant="body2" color="text.secondary">
                El Dashboard se filtra por la campaña <b>ACTIVA</b>. Solo puede
                existir 1 activa a la vez.
              </Typography>
            </Box>

            <Box textAlign="right">
              <Typography variant="caption" color="text.secondary">
                Campaña activa
              </Typography>
              <Typography variant="body2" fontWeight={700}>
                {activeCampaign ? activeCampaign.name : "—"}
              </Typography>
              {activeCampaign ? (
                <Typography variant="caption" color="text.secondary">
                  {activeCampaign.start_date} → {activeCampaign.end_date} (
                  {activeCampaign.timezone})
                </Typography>
              ) : (
                <Typography variant="caption" color="warning.main">
                  No hay campaña activa. Activa una para que el Dashboard filtre
                  correctamente.
                </Typography>
              )}
            </Box>
          </Box>

          <Divider sx={{ my: 2 }} />

          <Typography variant="subtitle2" fontWeight={700} mb={1}>
            Crear nueva campaña
          </Typography>

          <Stack spacing={2}>
            <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
              <TextField
                label="Nombre"
                fullWidth
                size="small"
                value={newCampaign.name}
                onChange={(e) =>
                  setNewCampaign((p) => ({ ...p, name: e.target.value }))
                }
              />
              <TextField
                label="Inicio"
                type="date"
                fullWidth
                size="small"
                InputLabelProps={{ shrink: true }}
                value={newCampaign.start_date}
                onChange={(e) =>
                  setNewCampaign((p) => ({ ...p, start_date: e.target.value }))
                }
              />
              <TextField
                label="Fin"
                type="date"
                fullWidth
                size="small"
                InputLabelProps={{ shrink: true }}
                value={newCampaign.end_date}
                onChange={(e) =>
                  setNewCampaign((p) => ({ ...p, end_date: e.target.value }))
                }
              />
            </Stack>

            <Stack
              direction={{ xs: "column", md: "row" }}
              spacing={2}
              alignItems={{ xs: "stretch", md: "center" }}
            >
              <TextField
                label="Timezone"
                fullWidth
                size="small"
                value={newCampaign.timezone}
                onChange={(e) =>
                  setNewCampaign((p) => ({ ...p, timezone: e.target.value }))
                }
              />

              <Box flex={1} />

              <Button
                variant="contained"
                onClick={handleCreateCampaign}
                disabled={
                  campaignBusyId === "__create__" ||
                  !newCampaign.name.trim() ||
                  !newCampaign.start_date ||
                  !newCampaign.end_date
                }
                sx={{ minWidth: 220 }}
              >
                {campaignBusyId === "__create__" ? "Creando..." : "Crear campaña"}
              </Button>
            </Stack>
          </Stack>

          <Divider sx={{ my: 2 }} />

          <Typography variant="subtitle2" fontWeight={700} mb={1}>
            Historial
          </Typography>

          {campaigns.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              Aún no hay campañas registradas.
            </Typography>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Nombre</TableCell>
                  <TableCell>Rango</TableCell>
                  <TableCell>Estado</TableCell>
                  <TableCell align="right">Acciones</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {campaigns.map((c) => {
                  const isBusy = campaignBusyId === c.id;
                  const isActive = c.status === "ACTIVE";
                  const isClosed = c.status === "CLOSED";
                  return (
                    <TableRow key={c.id} hover>
                      <TableCell>
                        <Typography fontWeight={700} variant="body2">
                          {c.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {c.timezone}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {c.start_date} → {c.end_date}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={c.status}
                          variant={isActive ? "filled" : "outlined"}
                          color={isActive ? "success" : isClosed ? "default" : "warning"}
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={1} justifyContent="flex-end">
                          <Button
                            size="small"
                            variant="outlined"
                            disabled={isBusy || isActive || isClosed}
                            onClick={() => handleActivate(c.id)}
                          >
                            {isBusy ? "..." : "Activar"}
                          </Button>
                          <Button
                            size="small"
                            variant="outlined"
                            color="inherit"
                            disabled={isBusy || !isActive}
                            onClick={() => handleClose(c.id)}
                          >
                            {isBusy ? "..." : "Cerrar"}
                          </Button>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* DATOS DE LA EMPRESA */}
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
            Datos de la empresa
          </Typography>
          <Typography variant="body2" color="text.secondary" mb={2}>
            Información básica de PRG Dinamics que puede aparecer en reportes y
            documentos.
          </Typography>

          <Stack spacing={2}>
            <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
              <TextField
                label="Razón social"
                fullWidth
                size="small"
                value={settings.company.name}
                onChange={(e) => handleCompanyChange("name", e.target.value)}
              />
              <TextField
                label="Nombre comercial"
                fullWidth
                size="small"
                value={settings.company.tradeName}
                onChange={(e) => handleCompanyChange("tradeName", e.target.value)}
              />
            </Stack>

            <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
              <TextField
                label="RUC"
                fullWidth
                size="small"
                value={settings.company.ruc}
                onChange={(e) => handleCompanyChange("ruc", e.target.value)}
              />
              <TextField
                label="Teléfono"
                fullWidth
                size="small"
                value={settings.company.phone}
                onChange={(e) => handleCompanyChange("phone", e.target.value)}
              />
              <TextField
                label="Correo de soporte"
                fullWidth
                size="small"
                value={settings.company.email}
                onChange={(e) => handleCompanyChange("email", e.target.value)}
              />
            </Stack>

            <TextField
              label="Dirección"
              fullWidth
              size="small"
              value={settings.company.address}
              onChange={(e) => handleCompanyChange("address", e.target.value)}
            />
          </Stack>
        </CardContent>
      </Card>

      {/* BOTÓN GUARDAR */}
      <Stack direction="row" justifyContent="flex-end" mb={4}>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={saving}
          sx={{ minWidth: 180 }}
        >
          {saving ? "Guardando..." : "Guardar cambios"}
        </Button>
      </Stack>

      <Snackbar
        open={toast.open}
        autoHideDuration={2500}
        onClose={closeToast}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert
          onClose={closeToast}
          severity={toast.severity}
          variant="filled"
          sx={{ width: "100%" }}
        >
          {toast.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default GeneralSettingsClient;
