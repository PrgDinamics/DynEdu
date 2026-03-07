"use client";

import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { IconEye, IconPencil, IconTrash, IconListCheck } from "@tabler/icons-react";
import { DiamondPlusIcon } from "lucide-react";

import type {
  ColegioOption,
  ProductOption,
  PromotionRow,
  UpsertPromotionInput,
  UpsertMultiPromotionInput,
} from "./actions";
import {
  deletePromotion,
  fetchDiscountProducts,
  saveDiscountProducts,
  setPromotionActive,
  upsertMultiPromotion,
  upsertPromotion,
} from "./actions";

type Props = {
  initialPromotions: PromotionRow[];
  products: ProductOption[];
  colegios: ColegioOption[];
  canManage: boolean;
};

type PromoTab = "PRODUCTS" | "SCHOOLS" | "MULTI";

function money(n: number | null) {
  if (n == null) return "—";
  return n.toFixed(2);
}

function friendlyErrorMessage(err: any) {
  const msg = String(err?.message ?? err ?? "Unknown error");
  if (msg.includes("discounts_scope_combo_check") || msg.includes("23514")) {
    return "Combinación inválida. Revisa el tipo de promoción y los campos requeridos.";
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
  if (r && c.startsWith(`${r}-`)) return c.slice(r.length + 1);
  return c.replace(/^\d{11}-/i, "");
}

export default function PromocionesClient({ initialPromotions, products, colegios, canManage }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [tab, setTab] = useState<PromoTab>("PRODUCTS");
  const [query, setQuery] = useState("");

  // create/edit modal for SINGLE / SCHOOLS
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<PromotionRow | null>(null);
  const [viewOnly, setViewOnly] = useState(false);

  // create/edit modal for MULTI
  const [multiOpen, setMultiOpen] = useState(false);
  const [multiEditing, setMultiEditing] = useState<PromotionRow | null>(null);
  const [multiViewOnly, setMultiViewOnly] = useState(false);

  // manage products for MULTI
  const [mapOpen, setMapOpen] = useState(false);
  const [mapDiscount, setMapDiscount] = useState<PromotionRow | null>(null);
  const [mapSelected, setMapSelected] = useState<number[]>([]);
  const [mapLoading, setMapLoading] = useState(false);

  // NEW: search in mapping dialog
  const [mapQuery, setMapQuery] = useState("");

  // NEW: cache assigned books for MULTI table (discount_id -> productIds[])
  const [multiBooksMap, setMultiBooksMap] = useState<Record<number, number[]>>({});
  const [multiBooksLoading, setMultiBooksLoading] = useState<Record<number, boolean>>({});

  // validation modal
  const [valOpen, setValOpen] = useState(false);
  const [valMsg, setValMsg] = useState("");

  // form state (SINGLE/SCHOOLS)
  const [colegioId, setColegioId] = useState<number | "">("");
  const [productId, setProductId] = useState<number | "">("");
  const [code, setCode] = useState("");
  const [type, setType] = useState<"PERCENT" | "FIXED">("PERCENT");
  const [value, setValue] = useState<string>("10");
  const [active, setActive] = useState(true);
  const [startsDate, setStartsDate] = useState<string>("");
  const [endsDate, setEndsDate] = useState<string>("");
  const [maxUses, setMaxUses] = useState<string>("");

  // form state (MULTI)
  const [mCode, setMCode] = useState("");
  const [mType, setMType] = useState<"PERCENT" | "FIXED">("PERCENT");
  const [mValue, setMValue] = useState<string>("10");
  const [mActive, setMActive] = useState(true);
  const [mStartsDate, setMStartsDate] = useState<string>("");
  const [mEndsDate, setMEndsDate] = useState<string>("");
  const [mMaxUses, setMMaxUses] = useState<string>("");

  const [confirmDelete, setConfirmDelete] = useState<PromotionRow | null>(null);

  const productMap = useMemo(() => {
    const m = new Map<number, ProductOption>();
    for (const p of products ?? []) m.set(p.id, p);
    return m;
  }, [products]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = initialPromotions ?? [];

    const tabFiltered =
      tab === "PRODUCTS"
        ? base.filter((r) => !r.colegio_id && String(r.applies_to) !== "PRODUCTS")
        : tab === "SCHOOLS"
        ? base.filter((r) => Boolean(r.colegio_id))
        : base.filter((r) => String(r.applies_to) === "PRODUCTS");

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

  // NEW: prefetch assigned books when in MULTI tab (for visible rows)
  useEffect(() => {
    if (tab !== "MULTI") return;

    const multiRows = rows.slice(0, 30); // cap to avoid too many calls
    for (const r of multiRows) {
      const id = Number(r.id);
      if (!id) continue;
      if (multiBooksMap[id]) continue;
      if (multiBooksLoading[id]) continue;

      setMultiBooksLoading((prev) => ({ ...prev, [id]: true }));

      fetchDiscountProducts(id)
        .then((ids) => {
          setMultiBooksMap((prev) => ({ ...prev, [id]: ids ?? [] }));
        })
        .catch(() => {
          // ignore; user can still open mapping
        })
        .finally(() => {
          setMultiBooksLoading((prev) => ({ ...prev, [id]: false }));
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, rows]);

  const preview = useMemo(() => {
    if (!productId) return { list: null as number | null, final: null as number | null };
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

  function resetMultiForm() {
    setMultiEditing(null);
    setMultiViewOnly(false);
    setMCode("");
    setMType("PERCENT");
    setMValue("10");
    setMActive(true);
    setMStartsDate("");
    setMEndsDate("");
    setMMaxUses("");
  }

  function openNew() {
    if (tab === "MULTI") {
      resetMultiForm();
      setMultiOpen(true);
      return;
    }
    resetForm();
    if (tab === "PRODUCTS") setColegioId("");
    setOpen(true);
  }

  function openView(r: PromotionRow) {
    setEditing(r);
    setViewOnly(true);
    setColegioId(r.colegio_id ?? "");
    setProductId(r.product_id ?? "");
    setCode(tab === "SCHOOLS" ? stripSchoolPrefix(r.code, r.colegio_ruc) : r.code);
    setType(r.type);
    setValue(String(r.value ?? 0));
    setActive(Boolean(r.active));
    setStartsDate(r.starts_at ? String(r.starts_at).slice(0, 10) : "");
    setEndsDate(r.ends_at ? String(r.ends_at).slice(0, 10) : "");
    setMaxUses(r.max_uses != null ? String(r.max_uses) : "");
    setOpen(true);
  }

  function openEdit(r: PromotionRow) {
    if (String(r.applies_to) === "PRODUCTS") {
      setMultiEditing(r);
      setMultiViewOnly(false);
      setMCode(r.code);
      setMType(r.type);
      setMValue(String(r.value ?? 0));
      setMActive(Boolean(r.active));
      setMStartsDate(r.starts_at ? String(r.starts_at).slice(0, 10) : "");
      setMEndsDate(r.ends_at ? String(r.ends_at).slice(0, 10) : "");
      setMMaxUses(r.max_uses != null ? String(r.max_uses) : "");
      setMultiOpen(true);
      return;
    }

    setEditing(r);
    setViewOnly(false);
    setColegioId(r.colegio_id ?? "");
    setProductId(r.product_id ?? "");
    setCode(tab === "SCHOOLS" ? stripSchoolPrefix(r.code, r.colegio_ruc) : r.code);
    setType(r.type);
    setValue(String(r.value ?? 0));
    setActive(Boolean(r.active));
    setStartsDate(r.starts_at ? String(r.starts_at).slice(0, 10) : "");
    setEndsDate(r.ends_at ? String(r.ends_at).slice(0, 10) : "");
    setMaxUses(r.max_uses != null ? String(r.max_uses) : "");
    setOpen(true);
  }

  function validateBeforeSaveSingle() {
    if (!productId) return "Selecciona un producto.";
    if (tab === "SCHOOLS" && !colegioId) return "Selecciona un colegio.";
    if (!code.trim()) return "Ingresa un código.";
    const v = Number(value);
    if (!Number.isFinite(v) || v < 0) return "Ingresa un valor válido.";
    if (type === "PERCENT" && v > 100) return "El porcentaje no puede ser mayor a 100.";
    return null;
  }

  function onSaveSingle() {
    if (!canManage) return;

    const validation = validateBeforeSaveSingle();
    if (validation) return openValidation(validation);

    const finalColegioId = tab === "PRODUCTS" ? null : (colegioId === "" ? null : Number(colegioId));

    const pid = productId === "" ? null : Number(productId);
    if (!pid || !Number.isFinite(pid)) return openValidation("Selecciona un producto.");

    const v = Number(value);

    const payload: UpsertPromotionInput = {
      id: editing?.id,
      product_id: pid,
      code: code.trim().toUpperCase(),
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

  function validateBeforeSaveMulti() {
    if (!mCode.trim()) return "Ingresa un código.";
    const v = Number(mValue);
    if (!Number.isFinite(v) || v < 0) return "Ingresa un valor válido.";
    if (mType === "PERCENT" && v > 100) return "El porcentaje no puede ser mayor a 100.";
    return null;
  }

  function onSaveMulti() {
    if (!canManage) return;

    const validation = validateBeforeSaveMulti();
    if (validation) return openValidation(validation);

    const v = Number(mValue);

    const payload: UpsertMultiPromotionInput = {
      id: multiEditing?.id,
      code: mCode.trim().toUpperCase(),
      type: mType,
      value: v,
      active: mActive,
      starts_date: mStartsDate ? mStartsDate : null,
      ends_date: mEndsDate ? mEndsDate : null,
      max_uses: mMaxUses.trim() ? Number(mMaxUses) : null,
    };

    startTransition(async () => {
      try {
        const createdId = await upsertMultiPromotion(payload);

        const idToMap = Number(multiEditing?.id ?? createdId);
        setMultiOpen(false);
        resetMultiForm();
        router.refresh();

        if (idToMap) {
          const createdRow = (initialPromotions ?? []).find((r) => r.id === idToMap) ?? null;
          await openMapping(createdRow ?? ({ id: idToMap } as any));
        }
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

  async function openMapping(r: PromotionRow | null) {
    const row = r ?? null;
    if (!row?.id) return;

    setMapDiscount(row);
    setMapSelected([]);
    setMapQuery(""); // reset search
    setMapOpen(true);
    setMapLoading(true);

    try {
      const ids = await fetchDiscountProducts(row.id);
      setMapSelected(ids);
    } catch (e: any) {
      openValidation(friendlyErrorMessage(e));
    } finally {
      setMapLoading(false);
    }
  }

  function toggleMapProduct(pid: number) {
    setMapSelected((prev) => {
      const s = new Set(prev);
      if (s.has(pid)) s.delete(pid);
      else s.add(pid);
      return Array.from(s);
    });
  }

  function onSaveMapping() {
    if (!canManage || !mapDiscount?.id) return;

    startTransition(async () => {
      try {
        await saveDiscountProducts(mapDiscount.id, mapSelected);

        // update cache for MULTI table instantly (no refresh dependency)
        setMultiBooksMap((prev) => ({ ...prev, [Number(mapDiscount.id)]: mapSelected }));

        setMapOpen(false);
        setMapDiscount(null);
        router.refresh();
      } catch (e: any) {
        openValidation(friendlyErrorMessage(e));
      }
    });
  }

  // NEW: mapping dialog filtered products
  const mapFilteredProducts = useMemo(() => {
    const q = mapQuery.trim().toLowerCase();
    if (!q) return products;

    return (products ?? []).filter((p) => {
      const code = String(p.internal_id ?? "").toLowerCase();
      const desc = String(p.descripcion ?? "").toLowerCase();
      return code.includes(q) || desc.includes(q);
    });
  }, [mapQuery, products]);

  // NEW: render assigned books chips for MULTI table
 function truncate(s: string, max = 26) {
  const t = String(s ?? "").trim();
  if (!t) return "Sin nombre";
  return t.length > max ? t.slice(0, max - 1) + "…" : t;
}

function renderAssignedBooks(discountId: number) {
  const ids = multiBooksMap[discountId] ?? [];
  if (!ids.length) {
    const loading = Boolean(multiBooksLoading[discountId]);
    return (
      <Typography variant="body2" color="text.secondary">
        {loading ? "Cargando…" : "—"}
      </Typography>
    );
  }

  const resolved = ids
    .map((pid) => productMap.get(pid))
    .filter(Boolean) as ProductOption[];

  const top = resolved.slice(0, 3);
  const rest = resolved.length - top.length;

  return (
    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
      {top.map((p) => (
        <Tooltip key={p.id} title={`${p.internal_id} — ${p.descripcion}`}>
          <Chip
            size="small"
            label={truncate(p.descripcion, 28)}
            variant="outlined"
          />
        </Tooltip>
      ))}
      {rest > 0 && <Chip size="small" label={`+${rest}`} variant="outlined" />}
    </Stack>
  );
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
              <b>Productos</b>: descuento por 1 libro · <b>Colegios</b>: descuento por colegio+libro ·{" "}
              <b>Multi-libro</b>: un código aplica a varios libros.
            </Typography>
          </Box>

          <Stack direction="row" gap={1} alignItems="center">
            <TextField
              size="small"
              label="Buscar"
              placeholder="Buscar códigos, productos, colegios"
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
          <Tab value="MULTI" label="Multi-libro" />
        </Tabs>

        <Divider sx={{ my: 2 }} />

        {tab !== "MULTI" ? (
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
                          <Typography fontWeight={700}>{r.colegio_nombre_comercial ?? "—"}</Typography>
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

                  <TableCell align="right">{r.final_price == null ? "—" : `S/ ${money(r.final_price)}`}</TableCell>

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
        ) : (
          <>
            <Alert severity="info" sx={{ mb: 2 }}>
              Aquí defines códigos que aplican a <b>varios libros</b>. Crea el código y luego selecciona los productos permitidos.
            </Alert>

            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Código</TableCell>
                  <TableCell>Tipo</TableCell>
                  <TableCell align="right">Valor</TableCell>
                  <TableCell>Libros asignados</TableCell>
                  <TableCell align="center">N°</TableCell>
                  <TableCell align="center">Usos</TableCell>
                  <TableCell>Estado</TableCell>
                  <TableCell align="right">Acciones</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id} hover>
                    <TableCell sx={{ fontFamily: "monospace", fontWeight: 700 }}>{r.code}</TableCell>
                    <TableCell>
                      <Chip size="small" label={r.type === "PERCENT" ? "%" : "S/"} variant="outlined" />
                    </TableCell>
                    <TableCell align="right">
                      {r.type === "PERCENT" ? `${r.value}%` : `S/ ${money(r.value)}`}
                    </TableCell>

                    <TableCell>{renderAssignedBooks(Number(r.id))}</TableCell>

                    <TableCell align="center">{r.multi_products_count ?? (multiBooksMap[Number(r.id)]?.length ?? 0)}</TableCell>

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
                        <Tooltip title="Asignar libros">
                          <span>
                            <IconButton
                              size="small"
                              onClick={() => openMapping(r)}
                              disabled={!canManage || isPending}
                              sx={{ color: "#5E35B1" }}
                            >
                              <IconListCheck size={18} />
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
                    <TableCell colSpan={8}>
                      <Typography color="text.secondary">No hay promociones multi-libro.</Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </>
        )}
      </Paper>

      {/* Create / Edit modal (single product / schools) */}
      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{viewOnly ? "Ver promoción" : editing ? "Editar promoción" : "Nueva promoción"}</DialogTitle>

        <DialogContent>
          <Stack gap={2} sx={{ pt: 1 }}>
            {tab === "SCHOOLS" && (
              <TextField
                select
                label="Colegio"
                value={colegioId}
                onChange={(e) => setColegioId(e.target.value === "" ? "" : Number(e.target.value))}
                fullWidth
                disabled={viewOnly}
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

            <TextField
              label="Código"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              fullWidth
              disabled={viewOnly}
              helperText="El código es libre (no se prefija con RUC)."
            />

            <Stack direction={{ xs: "column", sm: "row" }} gap={2}>
              <TextField
                select
                label="Tipo"
                value={type}
                onChange={(e) => setType(e.target.value as any)}
                fullWidth
                disabled={viewOnly}
              >
                <MenuItem value="PERCENT">Porcentaje (%)</MenuItem>
                <MenuItem value="FIXED">Monto fijo (S/)</MenuItem>
              </TextField>

              <TextField
                label="Valor"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                fullWidth
                disabled={viewOnly}
              />
            </Stack>

            <Stack direction={{ xs: "column", sm: "row" }} gap={2}>
              <TextField
                label="Inicio"
                type="date"
                value={startsDate}
                onChange={(e) => setStartsDate(e.target.value)}
                fullWidth
                disabled={viewOnly}
                InputLabelProps={{ shrink: true }}
              />
              <TextField
                label="Fin"
                type="date"
                value={endsDate}
                onChange={(e) => setEndsDate(e.target.value)}
                fullWidth
                disabled={viewOnly}
                InputLabelProps={{ shrink: true }}
              />
            </Stack>

            <TextField
              label="Máx. usos (opcional)"
              value={maxUses}
              onChange={(e) => setMaxUses(e.target.value)}
              fullWidth
              disabled={viewOnly}
            />

            <Stack direction="row" gap={1} alignItems="center">
              <Chip
                label={active ? "Activa" : "Inactiva"}
                color={active ? "success" : "default"}
                variant={active ? "filled" : "outlined"}
                onClick={!viewOnly ? () => setActive((p) => !p) : undefined}
                sx={{ cursor: viewOnly ? "default" : "pointer" }}
              />
              <Typography variant="body2" color="text.secondary">
                Preview: lista S/ {money(preview.list)} → final S/ {money(preview.final)}
              </Typography>
            </Stack>
          </Stack>
        </DialogContent>

        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cerrar</Button>
          {!viewOnly && (
            <Button variant="contained" onClick={onSaveSingle} disabled={!canManage || isPending} sx={{ fontWeight: 900 }}>
              Guardar
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* Create / Edit modal (MULTI) */}
      <Dialog open={multiOpen} onClose={() => setMultiOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>
          {multiViewOnly ? "Ver promoción multi-libro" : multiEditing ? "Editar promoción multi-libro" : "Nueva promoción multi-libro"}
        </DialogTitle>

        <DialogContent>
          <Stack gap={2} sx={{ pt: 1 }}>
            <TextField
              label="Código"
              value={mCode}
              onChange={(e) => setMCode(e.target.value)}
              fullWidth
              disabled={multiViewOnly}
              helperText="Después de guardar, asigna los libros permitidos."
            />

            <Stack direction={{ xs: "column", sm: "row" }} gap={2}>
              <TextField
                select
                label="Tipo"
                value={mType}
                onChange={(e) => setMType(e.target.value as any)}
                fullWidth
                disabled={multiViewOnly}
              >
                <MenuItem value="PERCENT">Porcentaje (%)</MenuItem>
                <MenuItem value="FIXED">Monto fijo (S/)</MenuItem>
              </TextField>

              <TextField
                label="Valor"
                value={mValue}
                onChange={(e) => setMValue(e.target.value)}
                fullWidth
                disabled={multiViewOnly}
              />
            </Stack>

            <Stack direction={{ xs: "column", sm: "row" }} gap={2}>
              <TextField
                label="Inicio"
                type="date"
                value={mStartsDate}
                onChange={(e) => setMStartsDate(e.target.value)}
                fullWidth
                disabled={multiViewOnly}
                InputLabelProps={{ shrink: true }}
              />
              <TextField
                label="Fin"
                type="date"
                value={mEndsDate}
                onChange={(e) => setMEndsDate(e.target.value)}
                fullWidth
                disabled={multiViewOnly}
                InputLabelProps={{ shrink: true }}
              />
            </Stack>

            <TextField
              label="Máx. usos (opcional)"
              value={mMaxUses}
              onChange={(e) => setMMaxUses(e.target.value)}
              fullWidth
              disabled={multiViewOnly}
            />

            <Stack direction="row" gap={1} alignItems="center">
              <Chip
                label={mActive ? "Activa" : "Inactiva"}
                color={mActive ? "success" : "default"}
                variant={mActive ? "filled" : "outlined"}
                onClick={!multiViewOnly ? () => setMActive((p) => !p) : undefined}
                sx={{ cursor: multiViewOnly ? "default" : "pointer" }}
              />
              <Typography variant="body2" color="text.secondary">
                Aplícalo a libros seleccionados (no a todo).
              </Typography>
            </Stack>
          </Stack>
        </DialogContent>

        <DialogActions>
          <Button onClick={() => setMultiOpen(false)}>Cerrar</Button>
          {!multiViewOnly && (
            <Button variant="contained" onClick={onSaveMulti} disabled={!canManage || isPending} sx={{ fontWeight: 900 }}>
              Guardar
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* Mapping dialog for MULTI products */}
      <Dialog open={mapOpen} onClose={() => setMapOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>Asignar libros al código {mapDiscount?.code ?? ""}</DialogTitle>
        <DialogContent>
          <Stack gap={1} sx={{ pt: 1 }}>
            {mapLoading ? (
              <Typography color="text.secondary">Cargando…</Typography>
            ) : (
              <Alert severity="info">
                Marca los libros que pueden usar este código. Guardar reemplaza la selección anterior.
              </Alert>
            )}

            <Divider sx={{ my: 1 }} />

            {/* NEW: search input */}
            <TextField
              size="small"
              fullWidth
              label="Buscar libro"
              placeholder="Buscar por código o descripción…"
              value={mapQuery}
              onChange={(e) => setMapQuery(e.target.value)}
              disabled={mapLoading}
            />

            <Box sx={{ maxHeight: 420, overflow: "auto" }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell width={80}>Usar</TableCell>
                    <TableCell>Libro</TableCell>
                    <TableCell>Descripción</TableCell>
                    <TableCell align="right">Precio lista</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {mapFilteredProducts.map((p) => {
                    const checked = mapSelected.includes(p.id);
                    return (
                      <TableRow
                        key={p.id}
                        hover
                        onClick={() => !mapLoading && toggleMapProduct(p.id)}
                        style={{ cursor: mapLoading ? "default" : "pointer" }}
                      >
                        <TableCell>
                          <Chip
                            size="small"
                            label={checked ? "Sí" : "No"}
                            color={checked ? "success" : "default"}
                            variant={checked ? "filled" : "outlined"}
                          />
                        </TableCell>
                        <TableCell sx={{ fontFamily: "monospace", fontWeight: 700 }}>{p.internal_id}</TableCell>
                        <TableCell>{p.descripcion}</TableCell>
                        <TableCell align="right">S/ {money(p.list_price)}</TableCell>
                      </TableRow>
                    );
                  })}

                  {mapFilteredProducts.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4}>
                        <Typography color="text.secondary">No se encontraron libros.</Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMapOpen(false)}>Cerrar</Button>
          <Button variant="contained" onClick={onSaveMapping} disabled={!canManage || isPending || mapLoading} sx={{ fontWeight: 900 }}>
            Guardar selección
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={Boolean(confirmDelete)} onClose={() => setConfirmDelete(null)} fullWidth maxWidth="xs">
        <DialogTitle>Eliminar promoción</DialogTitle>
        <DialogContent>
          <Typography>
            ¿Seguro que deseas eliminar <b>{confirmDelete?.code}</b>?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDelete(null)}>Cancelar</Button>
          <Button variant="contained" color="error" onClick={onDeleteConfirm} disabled={!canManage || isPending}>
            Eliminar
          </Button>
        </DialogActions>
      </Dialog>

      {/* Validation modal */}
      <Dialog open={valOpen} onClose={() => setValOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Error</DialogTitle>
        <DialogContent>
          <Alert severity="error">{valMsg}</Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setValOpen(false)}>Cerrar</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}