"use client";

import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
  Tooltip,
  MenuItem,
  Tabs,
  Tab,
  Alert,

} from "@mui/material";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { IconEye, IconPencil, IconTrash } from "@tabler/icons-react";

import { DiamondPlusIcon } from "lucide-react";

import type {
  ColegioOption,
  ProductOption,
  PromotionRow,
  UpsertPromotionInput,
} from "./actions";
import { deletePromotion, setPromotionActive, upsertPromotion } from "./actions";

type Props = {
  initialPromotions: PromotionRow[];
  products: ProductOption[];
  colegios: ColegioOption[];
  canManage: boolean;
};

type PromoTab = "PRODUCTS" | "SCHOOLS";

function money(n: number | null) {
  if (n == null) return "—";
  return n.toFixed(2);
}

function friendlyErrorMessage(err: any) {
  const msg = String(err?.message ?? err ?? "Unknown error");
  if (msg.includes("discounts_scope_combo_check") || msg.includes("23514")) {
    return "Combinación inválida: en Productos el colegio debe estar vacío; en Colegios debes seleccionar colegio y producto.";
  }
  if (msg.toLowerCase().includes("duplicate") || msg.includes("23505")) {
    return "Ya existe una promoción con ese código (code debe ser único).";
  }
  return msg;
}

// Only for SCHOOLS tab: hide "<RUC>-" if present in DB
function stripSchoolPrefix(code: string, ruc?: string | null) {
  const c = String(code ?? "");
  const r = String(ruc ?? "").trim();
  if (!c) return c;

  // Prefer exact RUC match if available
  if (r && c.startsWith(`${r}-`)) return c.slice(r.length + 1);

  // Fallback: if DB has "11digits-" prefix, strip it
  // (works for legacy rows you already created)
  return c.replace(/^\d{11}-/i, "");
}

export default function PromocionesClient({
  initialPromotions,
  products,
  colegios,
  canManage,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [tab, setTab] = useState<PromoTab>("PRODUCTS");
  const [query, setQuery] = useState("");

  // create/edit modal
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<PromotionRow | null>(null);
  const [viewOnly, setViewOnly] = useState(false);

  // validation modal
  const [valOpen, setValOpen] = useState(false);
  const [valMsg, setValMsg] = useState("");

  // form state
  const [colegioId, setColegioId] = useState<number | "">("");
  const [productId, setProductId] = useState<number | "">("");
  const [code, setCode] = useState("");
  const [type, setType] = useState<"PERCENT" | "FIXED">("PERCENT");
  const [value, setValue] = useState<string>("10");
  const [active, setActive] = useState(true);
  const [startsDate, setStartsDate] = useState<string>("");
  const [endsDate, setEndsDate] = useState<string>("");
  const [maxUses, setMaxUses] = useState<string>("");

  const [confirmDelete, setConfirmDelete] = useState<PromotionRow | null>(null);

  const productMap = useMemo(() => {
    const m = new Map<number, ProductOption>();
    for (const p of products ?? []) m.set(p.id, p);
    return m;
  }, [products]);

  const colegioMap = useMemo(() => {
    const m = new Map<number, ColegioOption>();
    for (const c of colegios ?? []) m.set(c.id, c);
    return m;
  }, [colegios]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = initialPromotions ?? [];

    const tabFiltered =
      tab === "PRODUCTS"
        ? base.filter((r) => !r.colegio_id)
        : base.filter((r) => Boolean(r.colegio_id));

    if (!q) return tabFiltered;

    return tabFiltered.filter((r) => {
      const prod = `${r.product_internal_id ?? ""} ${r.product_descripcion ?? ""}`.toLowerCase();
      const col = `${r.colegio_nombre_comercial ?? ""} ${r.colegio_ruc ?? ""}`.toLowerCase();

      const displayCode =
        tab === "SCHOOLS"
          ? stripSchoolPrefix(r.code, r.colegio_ruc).toLowerCase()
          : r.code.toLowerCase();

      return (
        displayCode.includes(q) ||
        prod.includes(q) ||
        col.includes(q) ||
        String(r.value).includes(q)
      );
    });
  }, [initialPromotions, query, tab]);

  const preview = useMemo(() => {
    if (!productId) {
      return { list: null as number | null, final: null as number | null };
    }

    const p = productMap.get(Number(productId));
    const list = p?.list_price ?? null;

    const v = Number(value);
    if (!Number.isFinite(v) || v < 0) return { list, final: null };

    let final = list;
    if (list != null) {
      if (type === "PERCENT") final = list * (1 - v / 100);
      else final = list - v;

      if (final < 0) final = 0;
      final = Math.round(final * 100) / 100;
    }

    return { list, final };
  }, [productId, productMap, type, value]);

  function openValidation(message: string) {
    setValMsg(message);
    setValOpen(true);
  }

  function resetForm() {
    setEditing(null);
    setViewOnly(false);
    setColegioId("");
    setProductId("");
    setCode("");
    setType("PERCENT");
    setValue("10");
    setActive(true);
    setStartsDate("");
    setEndsDate("");
    setMaxUses("");
  }

  function openNew() {
    resetForm();
    if (tab === "PRODUCTS") setColegioId("");
    setOpen(true);
  }

  function displayCodeForRow(r: PromotionRow) {
    if (tab !== "SCHOOLS") return r.code;
    return stripSchoolPrefix(r.code, r.colegio_ruc);
  }

  function openView(r: PromotionRow) {
    setEditing(r);
    setViewOnly(true);
    setColegioId(r.colegio_id ?? "");
    setProductId(r.product_id ?? "");
    setCode(displayCodeForRow(r));
    setType(r.type);
    setValue(String(r.value ?? 0));
    setActive(Boolean(r.active));
    setStartsDate(r.starts_at ? String(r.starts_at).slice(0, 10) : "");
    setEndsDate(r.ends_at ? String(r.ends_at).slice(0, 10) : "");
    setMaxUses(r.max_uses != null ? String(r.max_uses) : "");
    setOpen(true);
  }

  function openEdit(r: PromotionRow) {
    setEditing(r);
    setViewOnly(false);
    setColegioId(r.colegio_id ?? "");
    setProductId(r.product_id ?? "");
    setCode(displayCodeForRow(r));
    setType(r.type);
    setValue(String(r.value ?? 0));
    setActive(Boolean(r.active));
    setStartsDate(r.starts_at ? String(r.starts_at).slice(0, 10) : "");
    setEndsDate(r.ends_at ? String(r.ends_at).slice(0, 10) : "");
    setMaxUses(r.max_uses != null ? String(r.max_uses) : "");
    setOpen(true);
  }

  function onChangeColegio(next: number | "") {
    setColegioId(next);
    // Do NOT auto-prefix code. (Requested)
  }

  const isColegioTab = tab === "SCHOOLS";
  const colegioMissing = isColegioTab && (colegioId === "" || colegioId == null);

  function validateBeforeSave() {
    if (!productId) return "Selecciona un producto.";
    if (isColegioTab && !colegioId) return "Selecciona un colegio.";
    if (!code.trim()) return "Ingresa un código.";
    const v = Number(value);
    if (!Number.isFinite(v) || v < 0) return "Ingresa un valor válido.";
    if (type === "PERCENT" && v > 100) return "El porcentaje no puede ser mayor a 100.";
    return null;
  }

  function onSave() {
    if (!canManage) return;

    const validation = validateBeforeSave();
    if (validation) return openValidation(validation);

    const finalColegioId =
      tab === "PRODUCTS" ? null : (colegioId === "" ? null : Number(colegioId));

    const pid = productId === "" ? null : Number(productId);
    if (!pid || !Number.isFinite(pid)) return openValidation("Selecciona un producto.");

    const v = Number(value);

    const payload: UpsertPromotionInput = {
      id: editing?.id,
      product_id: pid,
      code: code.trim().toUpperCase(), // free code (no RUC prefix)
      type,
      value: v,
      active,
      colegio_id: finalColegioId,
      starts_date: startsDate ? startsDate : null,
      ends_date: endsDate ? endsDate : null,
      max_uses: maxUses.trim() ? Number(maxUses) : null,
    };

    startTransition(async () => {
      try {
        await upsertPromotion(payload);
        setOpen(false);
        resetForm();
        router.refresh();
      } catch (e: any) {
        openValidation(friendlyErrorMessage(e));
      }
    });
  }

  function onToggleActive(r: PromotionRow) {
    if (!canManage) return;
    startTransition(async () => {
      try {
        await setPromotionActive(r.id, !r.active);
        router.refresh();
      } catch (e: any) {
        openValidation(friendlyErrorMessage(e));
      }
    });
  }

  function onDeleteConfirm() {
    if (!confirmDelete) return;
    const id = confirmDelete.id;

    startTransition(async () => {
      try {
        await deletePromotion(id);
        setConfirmDelete(null);
        router.refresh();
      } catch (e: any) {
        openValidation(friendlyErrorMessage(e));
      }
    });
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <Paper sx={{ p: 2 }}>
        <Stack
          direction={{ xs: "column", md: "row" }}
          justifyContent="space-between"
          alignItems={{ xs: "flex-start", md: "center" }}
          gap={1}
        >
          <Box>
            <Typography variant="h5" fontWeight={800}>
              Promociones
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Descuentos por producto. Pestañas: <b>Productos</b> (general) y <b>Colegios</b> (ligado a un colegio).
            </Typography>
          </Box>

          <Stack direction="row" gap={1} alignItems="center">
            <TextField
              size="small"
              label="Buscar"
              placeholder="Buscar codigos, colegios"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <Button
              variant="contained"
              onClick={openNew}
              endIcon={<DiamondPlusIcon />}
              disabled={!canManage || isPending}
              sx={{ fontWeight: 900 }}
            >
              Crear Código
            </Button>
          </Stack>
        </Stack>

        <Tabs
          value={tab}
          onChange={(_, v) => {
            setTab(v);
            if (v === "PRODUCTS") setColegioId("");
          }}
          sx={{ mt: 2 }}
          textColor="primary"
          indicatorColor="primary"
        >
          <Tab value="PRODUCTS" label="Productos" />
          <Tab value="SCHOOLS" label="Colegios" />
        </Tabs>

        <Divider sx={{ my: 2 }} />

        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Código</TableCell>
              {tab === "SCHOOLS" && <TableCell>Colegio</TableCell>}
              <TableCell>Producto</TableCell>
              <TableCell>Tipo</TableCell>
              <TableCell align="right">Valor</TableCell>
              <TableCell align="right">Precio lista</TableCell>
              <TableCell align="right">Precio final</TableCell>
              <TableCell align="center">Usos</TableCell>
              <TableCell>Estado</TableCell>
              <TableCell align="right">Acciones</TableCell>
            </TableRow>
          </TableHead>

          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id} hover>
                <TableCell sx={{ fontFamily: "monospace", fontWeight: 700 }}>
                  {tab === "SCHOOLS" ? stripSchoolPrefix(r.code, r.colegio_ruc) : r.code}
                </TableCell>

                {tab === "SCHOOLS" && (
                  <TableCell>
                    {r.colegio_id ? (
                      <Box>
                        <Typography fontWeight={700}>
                          {r.colegio_nombre_comercial ?? "—"}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          RUC: {r.colegio_ruc ?? "—"}
                        </Typography>
                      </Box>
                    ) : (
                      <Chip size="small" label="General" variant="outlined" />
                    )}
                  </TableCell>
                )}

                <TableCell>
                  <Typography fontWeight={700}>{r.product_internal_id ?? "—"}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {r.product_descripcion ?? "Sin producto"}
                  </Typography>
                </TableCell>

                <TableCell>
                  <Chip size="small" label={r.type === "PERCENT" ? "%" : "S/"} variant="outlined" />
                </TableCell>

                <TableCell align="right">
                  {r.type === "PERCENT" ? `${r.value}%` : `S/ ${money(r.value)}`}
                </TableCell>

                <TableCell align="right">S/ {money(r.list_price)}</TableCell>

                <TableCell align="right">
                  {r.final_price == null ? "—" : `S/ ${money(r.final_price)}`}
                </TableCell>

                <TableCell align="center">
                  {r.max_uses != null ? (
                    <span>
                      {r.uses_count}/{r.max_uses}
                    </span>
                  ) : (
                    <span>{r.uses_count}</span>
                  )}
                </TableCell>

                <TableCell>
                  <Tooltip title={canManage ? "Click para activar / desactivar" : ""}>
                    <span>
                      <Chip
                        size="small"
                        label={r.active ? "Activa" : "Inactiva"}
                        color={r.active ? "success" : "default"}
                        variant={r.active ? "filled" : "outlined"}
                        onClick={canManage && !isPending ? () => onToggleActive(r) : undefined}
                        sx={{ cursor: canManage ? "pointer" : "default" }}
                      />
                    </span>
                  </Tooltip>
                </TableCell>

                <TableCell align="right">
                  <Stack direction="row" justifyContent="flex-end" gap={0.5}>
                    <Tooltip title="Ver">
                      <span>
                        <IconButton
                          size="small"
                          onClick={() => openView(r)}
                          disabled={isPending}
                          sx={{ color: "#1E88E5" }}
                        >
                          <IconEye size={18} />
                        </IconButton>
                      </span>
                    </Tooltip>

                    <Tooltip title="Editar">
                      <span>
                        <IconButton
                          size="small"
                          onClick={() => openEdit(r)}
                          disabled={!canManage || isPending}
                          sx={{ color: "#FB8C00" }}
                        >
                          <IconPencil size={18} />
                        </IconButton>
                      </span>
                    </Tooltip>

                    <Tooltip title="Eliminar">
                      <span>
                        <IconButton
                          size="small"
                          onClick={() => setConfirmDelete(r)}
                          disabled={!canManage || isPending}
                          sx={{ color: "#E53935" }}
                        >
                          <IconTrash size={18} />
                        </IconButton>
                      </span>
                    </Tooltip>
                  </Stack>
                </TableCell>
              </TableRow>
            ))}

            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={tab === "SCHOOLS" ? 10 : 9}>
                  <Typography color="text.secondary">No hay promociones.</Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>

      {/* Create / Edit modal */}
      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>
          {viewOnly ? "Ver promoción" : editing ? "Editar promoción" : "Nueva promoción"}
        </DialogTitle>

        <DialogContent>
          <Stack gap={2} sx={{ pt: 1 }}>
            {tab === "SCHOOLS" && (
              <TextField
                select
                label="Colegio"
                value={colegioId}
                onChange={(e) =>
                  onChangeColegio(e.target.value === "" ? "" : Number(e.target.value))
                }
                fullWidth
                disabled={viewOnly}
                error={colegioMissing && !viewOnly}
                helperText={
                  colegioMissing && !viewOnly
                    ? "Selecciona un colegio para crear una promoción por colegio."
                    : "El código es libre (no se prefija con RUC)."
                }
              >
                <MenuItem value="">Selecciona…</MenuItem>
                {colegios.map((c) => (
                  <MenuItem key={c.id} value={c.id}>
                    {c.nombre_comercial} (RUC: {c.ruc})
                  </MenuItem>
                ))}
              </TextField>
            )}

            <TextField
              select
              label="Producto"
              value={productId}
              onChange={(e) => setProductId(e.target.value === "" ? "" : Number(e.target.value))}
              fullWidth
              disabled={viewOnly}
            >
              <MenuItem value="">Selecciona…</MenuItem>
              {products.map((p) => (
                <MenuItem key={p.id} value={p.id}>
                  {p.internal_id} — {p.descripcion}
                </MenuItem>
              ))}
            </TextField>

            <Stack direction={{ xs: "column", md: "row" }} gap={2}>
              <TextField
                label="Código"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder={"Ej: SPT44"} // no RUC in placeholder for schools
                fullWidth
                disabled={viewOnly}
                inputProps={{ style: { textTransform: "uppercase" } }}
              />

              <TextField
                select
                label="Tipo"
                value={type}
                onChange={(e) => setType(e.target.value as any)}
                fullWidth
                disabled={viewOnly}
              >
                <MenuItem value="PERCENT">Porcentaje (%)</MenuItem>
                <MenuItem value="FIXED">Monto fijo (PEN)</MenuItem>
              </TextField>
            </Stack>

            <Stack direction={{ xs: "column", md: "row" }} gap={2}>
              <TextField
                label={type === "PERCENT" ? "Valor (%)" : "Valor (PEN)"}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                type="number"
                fullWidth
                disabled={viewOnly}
              />

              <TextField
                label="Max usos (opcional)"
                value={maxUses}
                onChange={(e) => setMaxUses(e.target.value)}
                type="number"
                fullWidth
                disabled={viewOnly}
              />
            </Stack>

            <Stack direction={{ xs: "column", md: "row" }} gap={2}>
              <TextField
                label="Inicio (opcional)"
                type="date"
                value={startsDate}
                onChange={(e) => setStartsDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
                fullWidth
                disabled={viewOnly}
              />
              <TextField
                label="Fin (opcional)"
                type="date"
                value={endsDate}
                onChange={(e) => setEndsDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
                fullWidth
                disabled={viewOnly}
              />
            </Stack>

            <Paper variant="outlined" sx={{ p: 1.5 }}>
              <Typography fontWeight={800}>Descuento</Typography>
              <Typography variant="body2" color="text.secondary">
                Precio lista: <b>S/ {money(preview.list)}</b> — Precio final:{" "}
                <b>{preview.final == null ? "—" : `S/ ${money(preview.final)}`}</b>
              </Typography>
            </Paper>
          </Stack>
        </DialogContent>

        <DialogActions>
          <Button onClick={() => setOpen(false)} disabled={isPending}>
            {viewOnly ? "Cerrar" : "Cancelar"}
          </Button>

          {!viewOnly && (
            <Button
              variant="contained"
              onClick={onSave}
              disabled={!canManage || isPending || (tab === "SCHOOLS" && colegioMissing)}
              sx={{ fontWeight: 900 }}
            >
              Guardar
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* Validation modal */}
      <Dialog open={valOpen} onClose={() => setValOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Validación</DialogTitle>
        <DialogContent>
          <Alert severity="warning">{valMsg}</Alert>
        </DialogContent>
        <DialogActions>
          <Button variant="contained" color="error" onClick={() => setValOpen(false)}>
            OK
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete confirm */}
      <Dialog
        open={Boolean(confirmDelete)}
        onClose={() => setConfirmDelete(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Eliminar promoción</DialogTitle>
        <DialogContent>
          <Typography>
            ¿Seguro que deseas eliminar <b>{confirmDelete?.code}</b>?
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Esto borra el registro en la tabla <b>discounts</b>.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDelete(null)} disabled={isPending}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={onDeleteConfirm}
            disabled={isPending}
            sx={{ fontWeight: 900 }}
          >
            Eliminar
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
