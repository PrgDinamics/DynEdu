// src/app/(PrgDinamics)/settings/general/GeneralSettingsClient.tsx
"use client";

import React, { useState } from "react";
import {
  Box,
  Card,
  CardContent,
  Typography,
  Stack,
  TextField,
  Switch,
  FormControlLabel,
  Button,
  MenuItem,
  Divider,
} from "@mui/material";

import type { GeneralSettings } from "@/modules/settings/types";
import { saveGeneralSettings } from "./actions";

type Props = {
  initialSettings: GeneralSettings;
};

const GeneralSettingsClient: React.FC<Props> = ({ initialSettings }) => {
  const [settings, setSettings] = useState<GeneralSettings>(initialSettings);
  const [saving, setSaving] = useState(false);

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

  // --- Campaña / año académico ---
  const handleCampaignChange = (
    field: keyof GeneralSettings["campaign"],
    value: string,
  ) => {
    setSettings((prev) => ({
      ...prev,
      campaign: {
        ...prev.campaign,
        [field]:
          field === "year"
            ? Number(value) || new Date().getFullYear()
            : value,
      },
    }));
  };

  // --- Notificaciones ---
  const handleNotificationsChange = (
    field: keyof GeneralSettings["notifications"],
    value: string | boolean,
  ) => {
    setSettings((prev) => ({
      ...prev,
      notifications: {
        ...prev.notifications,
        [field]: value,
      },
    }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await saveGeneralSettings(settings);
      alert("Configuración guardada correctamente.");
    } catch (error) {
      console.error(error);
      alert("Hubo un problema al guardar la configuración.");
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
        Ajusta la información general de PRG Dinamics, la campaña actual y las
        notificaciones del sistema.
      </Typography>

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
                onChange={(e) =>
                  handleCompanyChange("name", e.target.value)
                }
              />
              <TextField
                label="Nombre comercial"
                fullWidth
                size="small"
                value={settings.company.tradeName}
                onChange={(e) =>
                  handleCompanyChange("tradeName", e.target.value)
                }
              />
            </Stack>

            <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
              <TextField
                label="RUC"
                fullWidth
                size="small"
                value={settings.company.ruc}
                onChange={(e) =>
                  handleCompanyChange("ruc", e.target.value)
                }
              />
              <TextField
                label="Teléfono"
                fullWidth
                size="small"
                value={settings.company.phone}
                onChange={(e) =>
                  handleCompanyChange("phone", e.target.value)
                }
              />
              <TextField
                label="Correo de soporte"
                fullWidth
                size="small"
                value={settings.company.email}
                onChange={(e) =>
                  handleCompanyChange("email", e.target.value)
                }
              />
            </Stack>

            <TextField
              label="Dirección"
              fullWidth
              size="small"
              value={settings.company.address}
              onChange={(e) =>
                handleCompanyChange("address", e.target.value)
              }
            />
          </Stack>
        </CardContent>
      </Card>

      {/* CAMPAÑA / AÑO ACADÉMICO */}
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
            Campaña / año académico
          </Typography>
          <Typography variant="body2" color="text.secondary" mb={2}>
            Configura el año académico actual y el estado de la campaña.
          </Typography>

          <Stack spacing={2}>
            <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
              <TextField
                label="Año académico"
                type="number"
                fullWidth
                size="small"
                value={settings.campaign.year}
                onChange={(e) =>
                  handleCampaignChange("year", e.target.value)
                }
              />
              <TextField
                label="Fecha inicio campaña"
                type="date"
                fullWidth
                size="small"
                InputLabelProps={{ shrink: true }}
                value={settings.campaign.startDate ?? ""}
                onChange={(e) =>
                  handleCampaignChange("startDate", e.target.value)
                }
              />
              <TextField
                label="Fecha fin campaña"
                type="date"
                fullWidth
                size="small"
                InputLabelProps={{ shrink: true }}
                value={settings.campaign.endDate ?? ""}
                onChange={(e) =>
                  handleCampaignChange("endDate", e.target.value)
                }
              />
            </Stack>

            <TextField
              select
              label="Estado de la campaña"
              fullWidth
              size="small"
              value={settings.campaign.status}
              onChange={(e) =>
                handleCampaignChange("status", e.target.value)
              }
            >
              <MenuItem value="planning">Planificación</MenuItem>
              <MenuItem value="active">Activa</MenuItem>
              <MenuItem value="closed">Cerrada</MenuItem>
            </TextField>
          </Stack>
        </CardContent>
      </Card>

      {/* NOTIFICACIONES */}
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
            Notificaciones
          </Typography>
          <Typography variant="body2" color="text.secondary" mb={2}>
            Correos y eventos para los que se enviarán notificaciones.
          </Typography>

          <Stack spacing={2}>
            <TextField
              label="Correo(s) interno(s) de alerta"
              helperText="Puedes ingresar varios correos separados por coma."
              fullWidth
              size="small"
              value={settings.notifications.internalEmail}
              onChange={(e) =>
                handleNotificationsChange(
                  "internalEmail",
                  e.target.value,
                )
              }
            />

            <Divider />

            <FormControlLabel
              control={
                <Switch
                  checked={settings.notifications.notifyOnOrderCompleted}
                  onChange={(_, checked) =>
                    handleNotificationsChange(
                      "notifyOnOrderCompleted",
                      checked,
                    )
                  }
                />
              }
              label="Avisar cuando un pedido pase a COMPLETO"
            />

            <FormControlLabel
              control={
                <Switch
                  checked={settings.notifications.notifyOnStockLow}
                  onChange={(_, checked) =>
                    handleNotificationsChange(
                      "notifyOnStockLow",
                      checked,
                    )
                  }
                />
              }
              label="Avisar cuando el stock esté bajo (futuro)"
            />

            <FormControlLabel
              control={
                <Switch
                  checked={settings.notifications.notifyOnConsignCreated}
                  onChange={(_, checked) =>
                    handleNotificationsChange(
                      "notifyOnConsignCreated",
                      checked,
                    )
                  }
                />
              }
              label="Avisar cuando se registre una consignación"
            />

            <FormControlLabel
              control={
                <Switch
                  checked={
                    settings.notifications.notifySchoolOnConsignApproved
                  }
                  onChange={(_, checked) =>
                    handleNotificationsChange(
                      "notifySchoolOnConsignApproved",
                      checked,
                    )
                  }
                />
              }
              label="Enviar correo al colegio cuando se apruebe una consignación"
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
    </Box>
  );
};

export default GeneralSettingsClient;
