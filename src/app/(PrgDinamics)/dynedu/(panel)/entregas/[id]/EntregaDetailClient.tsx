"use client";

import Link from "next/link";
import React, { useMemo, useState, useTransition } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Chip,
  Divider,
  MenuItem,
  Stack,
  TextField,
  Typography,
  Stepper,
  Step,
  StepLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Checkbox,
  FormControlLabel,
} from "@mui/material";

import type { DeliveryOrderDetail } from "./actions";
import { updateDeliveryForOrderAction } from "./actions";

type Props = {
  order: DeliveryOrderDetail | null;
};

const STEPS = [
  { key: "REGISTERED", label: "Pedido registrado" },
  { key: "PACKING", label: "Empacando" },
  { key: "DELIVERY", label: "En reparto" },
  { key: "DELIVERED", label: "Entregado" },
] as const;

type StepKey = (typeof STEPS)[number]["key"];

function shortId(id: string) {
  return String(id ?? "").replaceAll("-", "").slice(0, 8).toUpperCase();
}

function stepIndex(status: string) {
  const idx = STEPS.findIndex((s) => s.key === status);
  return idx >= 0 ? idx : 0;
}

type InfoDialogState = {
  open: boolean;
  title: string;
  message: string;
  kind: "success" | "error" | "warning" | "info";
};

export default function EntregaDetailClient({ order }: Props) {
  const [isPending, startTransition] = useTransition();

  // ✅ Modal info (reemplaza alert)
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

  // ✅ Modal confirmación antes de guardar + checkbox enviar correo
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [sendEmail, setSendEmail] = useState(true);
  const [confirmText, setConfirmText] = useState("");

  if (!order) {
    return (
      <Box>
        <Typography variant="h5" fontWeight={700} mb={1}>
          Orden no encontrada
        </Typography>
        <Button component={Link} href="/dynedu/entregas" variant="outlined">
          Volver
        </Button>
      </Box>
    );
  }

  const [fulfillmentStatus, setFulfillmentStatus] = useState<StepKey>(order.fulfillment_status);
  const [deliveryDate, setDeliveryDate] = useState<string>(order.delivery_date ?? "");
  const [note, setNote] = useState<string>(order.fulfillment_note ?? "");

  const activeStep = useMemo(() => stepIndex(fulfillmentStatus), [fulfillmentStatus]);

  const buildChangeSummary = (statusChanged: boolean, dateChanged: boolean) => {
    const changes: string[] = [];
    if (statusChanged) changes.push(`• Estado: ${order.fulfillment_status} → ${fulfillmentStatus}`);
    if (dateChanged) changes.push(`• Fecha de entrega: ${(order.delivery_date ?? "—")} → ${(deliveryDate || "—")}`);
    if (changes.length === 0) return "No hay cambios detectados.";
    return ["Se detectaron cambios:", ...changes].join("\n");
  };

  const openConfirmBeforeSave = () => {
    const statusChanged = order.fulfillment_status !== fulfillmentStatus;
    const dateChanged = String(order.delivery_date ?? "") !== String(deliveryDate ?? "");

    if (!statusChanged && !dateChanged && String(order.fulfillment_note ?? "") === String(note ?? "")) {
      openInfo("No hay cambios para guardar.", "info");
      return;
    }

    // ✅ Por defecto, enviar correo si cambió estado o fecha
    setSendEmail(statusChanged || dateChanged);
    setConfirmText(buildChangeSummary(statusChanged, dateChanged));
    setConfirmOpen(true);
  };

  const doSave = () => {
    setConfirmOpen(false);

    startTransition(async () => {
      try {
        const res = await updateDeliveryForOrderAction({
          orderId: order.id,
          fulfillmentStatus,
          deliveryDate: deliveryDate ? deliveryDate : null,
          note: note ? note : null,

          // ✅ el usuario decide en el modal
          sendEmail,
        });

        if (!res.success) {
          openInfo(res.error ?? "No se pudo guardar", "error");
          return;
        }

        openInfo(
          sendEmail ? "Entrega actualizada ✅" : "Entrega actualizada ✅",
          "success"
        );
      } catch (e) {
        console.error("[EntregaDetailClient] save error", e);
        openInfo("Ocurrió un error al guardar la entrega.", "error");
      }
    });
  };

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Stack spacing={0.5}>
          <Typography variant="h4" fontWeight={700}>
            Entrega · Orden {shortId(order.id)}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Actualiza el estado y la fecha estimada de entrega.
          </Typography>
        </Stack>

        <Button component={Link} href="/dynedu/entregas" variant="outlined">
          Volver
        </Button>
      </Stack>

      <Card elevation={0} sx={{ borderRadius: 3, border: "1px solid", borderColor: "divider" }}>
        <CardHeader
          title="Estado de entrega"
          subheader={`Pago/Orden: ${order.status}`}
          action={<Chip label={order.customer_email ?? "—"} variant="outlined" />}
        />
        <CardContent>
          <Divider sx={{ mb: 2 }} />

          <Stepper activeStep={activeStep} alternativeLabel>
            {STEPS.map((s) => (
              <Step key={s.key}>
                <StepLabel>{s.label}</StepLabel>
              </Step>
            ))}
          </Stepper>

          <Stack direction={{ xs: "column", md: "row" }} spacing={2} mt={3}>
            <TextField
              select
              fullWidth
              label="Estado"
              value={fulfillmentStatus}
              onChange={(e) => setFulfillmentStatus(e.target.value as StepKey)}
            >
              {STEPS.map((s) => (
                <MenuItem key={s.key} value={s.key}>
                  {s.label}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              fullWidth
              type="date"
              label="Fecha de entrega"
              InputLabelProps={{ shrink: true }}
              value={deliveryDate}
              onChange={(e) => setDeliveryDate(e.target.value)}
              helperText={deliveryDate ? "" : "Por confirmar"}
            />
          </Stack>

          <TextField
            fullWidth
            label="Nota"
            placeholder="Ej: Sale hoy entre 3pm–6pm, te llamamos al llegar..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
            multiline
            minRows={3}
            sx={{ mt: 2 }}
          />

          <Stack direction={{ xs: "column", md: "row" }} spacing={2} mt={2}>
            <Button variant="contained" onClick={openConfirmBeforeSave} disabled={isPending}>
              {isPending ? "Guardando..." : "Guardar"}
            </Button>

            <Button
              variant="outlined"
              onClick={() => {
                setFulfillmentStatus(order.fulfillment_status);
                setDeliveryDate(order.delivery_date ?? "");
                setNote(order.fulfillment_note ?? "");
              }}
              disabled={isPending}
            >
              Reset
            </Button>
          </Stack>

          <Divider sx={{ my: 3 }} />

          <Typography variant="h6" fontWeight={700} mb={1}>
            Datos del cliente
          </Typography>

          <Stack spacing={0.5} mb={2}>
            <Typography variant="body2">
              <b>Nombre:</b> {order.customer_name ?? "—"}
            </Typography>
            <Typography variant="body2">
              <b>Teléfono:</b> {order.customer_phone ?? "—"}
            </Typography>
            <Typography variant="body2">
              <b>Dirección:</b> {order.shipping_address ?? "—"}
            </Typography>
            <Typography variant="body2">
              <b>Distrito:</b> {order.shipping_district ?? "—"}
            </Typography>
            <Typography variant="body2">
              <b>Referencia:</b> {order.shipping_reference ?? "—"}
            </Typography>
          </Stack>

          <Typography variant="h6" fontWeight={700} mb={1}>
            Items
          </Typography>

          <Stack spacing={1}>
            {order.items.map((it) => (
              <Box
                key={it.id}
                sx={{
                  p: 1.5,
                  borderRadius: 2,
                  border: "1px solid",
                  borderColor: "divider",
                }}
              >
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Box>
                    <Typography fontWeight={700}>{it.title_snapshot}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {it.productos?.internal_id ? `Código: ${it.productos.internal_id}` : ""}
                    </Typography>
                  </Box>
                  <Typography fontWeight={700}>
                    x{it.quantity} · {(it.line_total ?? 0).toFixed(2)}
                  </Typography>
                </Stack>
              </Box>
            ))}
          </Stack>

          <Stack direction="row" justifyContent="flex-end" mt={2}>
            <Typography variant="h6" fontWeight={800}>
              Total: {(order.total ?? 0).toFixed(2)} {order.currency ?? "PEN"}
            </Typography>
          </Stack>
        </CardContent>
      </Card>

      {/* ✅ Modal: confirmar guardado + decidir envío de correo */}
      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Confirmar cambios</DialogTitle>
        <DialogContent>
          <Typography sx={{ whiteSpace: "pre-line" }}>{confirmText}</Typography>

          <FormControlLabel
            sx={{ mt: 1 }}
            control={
              <Checkbox
                checked={sendEmail}
                onChange={(e) => setSendEmail(e.target.checked)}
              />
            }
            label="Enviar correo al cliente para avisar"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)}>Cancelar</Button>
          <Button onClick={doSave} variant="contained">
            Guardar
          </Button>
        </DialogActions>
      </Dialog>

      {/* ✅ Modal info */}
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
