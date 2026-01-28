"use server";

import { createSupabaseServerClient } from "@/lib/supabaseClient";
import { ensureDefaultPriceList } from "../precios/actions";

export type ProductOption = {
  id: number;
  internal_id: string;
  descripcion: string;
  list_price: number | null;
};

export type ColegioOption = {
  id: number;
  nombre_comercial: string;
  ruc: string;
};

export type PromotionRow = {
  id: number;
  code: string;
  type: "PERCENT" | "FIXED";
  value: number;
  active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  max_uses: number | null;
  uses_count: number;
  applies_to: "ALL" | "PRODUCT" | "PRICE_LIST" | "COLEGIO" | "COLEGIO_PRODUCT";

  product_id: number | null;
  product_internal_id: string | null;
  product_descripcion: string | null;

  colegio_id: number | null;
  colegio_nombre_comercial: string | null;
  colegio_ruc: string | null;

  list_price: number | null;
  final_price: number | null;
};

function computeFinalPrice(
  listPrice: number | null,
  type: "PERCENT" | "FIXED",
  value: number
) {
  if (listPrice == null) return null;

  let out = listPrice;

  if (type === "PERCENT") out = listPrice * (1 - value / 100);
  else out = listPrice - value;

  if (out < 0) out = 0;

  return Math.round(out * 100) / 100;
}

export async function fetchPromotionsPageData(): Promise<{
  promotions: PromotionRow[];
  products: ProductOption[];
  colegios: ColegioOption[];
}> {
  const supabase = await createSupabaseServerClient();

  // Default price list (preview)
  const defaultList = await ensureDefaultPriceList();
  const priceListId = Number((defaultList as any).id);

  // Colegios
  const { data: colegios, error: colErr } = await supabase
    .from("colegios")
    .select("id, nombre_comercial, ruc")
    .order("nombre_comercial", { ascending: true });

  if (colErr) throw colErr;

  // Productos
  const { data: productos, error: prodErr } = await supabase
    .from("productos")
    .select("id, internal_id, descripcion")
    .order("internal_id", { ascending: true });

  if (prodErr) throw prodErr;

  const productIds = (productos ?? []).map((p) => Number(p.id));

  // Price list items
  const { data: pli, error: pliErr } = await supabase
    .from("price_list_items")
    .select("producto_id, precio")
    .eq("price_list_id", priceListId)
    .in("producto_id", productIds);

  if (pliErr) throw pliErr;

  const priceMap = new Map<number, number>();
  for (const it of pli ?? []) {
    if (it.producto_id != null && it.precio != null) {
      priceMap.set(Number(it.producto_id), Number(it.precio));
    }
  }

  const products: ProductOption[] = (productos ?? []).map((p) => ({
    id: Number(p.id),
    internal_id: String(p.internal_id ?? ""),
    descripcion: String(p.descripcion ?? ""),
    list_price: priceMap.get(Number(p.id)) ?? null,
  }));

  // IMPORTANT: fetch both PRODUCT + COLEGIO_PRODUCT
  // Force FK names to avoid any PostgREST ambiguity.
  const { data: discounts, error: discErr } = await supabase
    .from("discounts")
    .select(
      `
      id, code, type, value, active, starts_at, ends_at, max_uses, uses_count, applies_to, product_id, colegio_id,
      producto:productos!discounts_product_id_fkey (internal_id, descripcion),
      colegio:colegios!discounts_colegio_id_fkey (nombre_comercial, ruc)
      `
    )
    .in("applies_to", ["PRODUCT", "COLEGIO_PRODUCT"])
    .order("created_at", { ascending: false });

  if (discErr) throw discErr;

  const promotions: PromotionRow[] = (discounts ?? []).map((d: any) => {
    const pid = d.product_id != null ? Number(d.product_id) : null;
    const listPrice = pid != null ? priceMap.get(pid) ?? null : null;

    const type = String(d.type) as "PERCENT" | "FIXED";
    const value = Number(d.value);

    const colegioId = d.colegio_id != null ? Number(d.colegio_id) : null;

    return {
      id: Number(d.id),
      code: String(d.code ?? ""),
      type,
      value,
      active: Boolean(d.active),
      starts_at: d.starts_at ?? null,
      ends_at: d.ends_at ?? null,
      max_uses: d.max_uses != null ? Number(d.max_uses) : null,
      uses_count: d.uses_count != null ? Number(d.uses_count) : 0,
      applies_to: String(d.applies_to) as any,

      product_id: pid,
      product_internal_id: d.producto?.internal_id ?? null,
      product_descripcion: d.producto?.descripcion ?? null,

      colegio_id: colegioId,
      colegio_nombre_comercial: d.colegio?.nombre_comercial ?? null,
      colegio_ruc: d.colegio?.ruc ?? null,

      list_price: listPrice,
      final_price: computeFinalPrice(listPrice, type, value),
    };
  });

  return {
    promotions,
    products,
    colegios: (colegios ?? []).map((c: any) => ({
      id: Number(c.id),
      nombre_comercial: String(c.nombre_comercial ?? ""),
      ruc: String(c.ruc ?? ""),
    })),
  };
}

export type UpsertPromotionInput = {
  id?: number;
  code: string;
  type: "PERCENT" | "FIXED";
  value: number;
  product_id: number;
  active: boolean;

  // optional - if present => COLEGIO_PRODUCT
  colegio_id?: number | null;

  // optional (YYYY-MM-DD)
  starts_date?: string | null;
  ends_date?: string | null;

  max_uses?: number | null;
};

function dateToLimaStart(date: string) {
  return `${date}T00:00:00-05:00`;
}
function dateToLimaEnd(date: string) {
  return `${date}T23:59:59-05:00`;
}

function validateInput(input: UpsertPromotionInput) {
  const code = String(input.code ?? "").trim();
  if (!code) throw new Error("Code is required.");
  if (!input.product_id) throw new Error("Product is required.");
  if (input.type !== "PERCENT" && input.type !== "FIXED") throw new Error("Invalid type.");
  if (!Number.isFinite(input.value) || input.value < 0) throw new Error("Invalid value.");

  if (input.type === "PERCENT" && input.value > 100) {
    throw new Error("Percent discount cannot be greater than 100.");
  }

  if (input.max_uses != null && input.max_uses < 0) throw new Error("Invalid max uses.");
}


export async function upsertPromotion(input: UpsertPromotionInput) {
  validateInput(input);

  const supabase = await createSupabaseServerClient();

  const colegioId = input.colegio_id != null ? Number(input.colegio_id) : null;

  // Scope rule:
  // - PRODUCT => colegio_id must be NULL
  // - COLEGIO_PRODUCT => colegio_id + product_id required
  const appliesTo = colegioId ? "COLEGIO_PRODUCT" : "PRODUCT";

  const code = String(input.code ?? "").trim().toUpperCase();

  const starts_at =
    input.starts_date && input.starts_date.trim()
      ? dateToLimaStart(input.starts_date.trim())
      : null;

  const ends_at =
    input.ends_date && input.ends_date.trim()
      ? dateToLimaEnd(input.ends_date.trim())
      : null;

  const payload: any = {
    code,
    type: input.type,
    value: input.value,
    currency: "PEN",
    active: Boolean(input.active),

    starts_at,
    ends_at,
    max_uses: input.max_uses ?? null,

    applies_to: appliesTo,
    product_id: input.product_id,
    price_list_id: null,

    // CRITICAL: enforce constraint combo
    colegio_id: appliesTo === "PRODUCT" ? null : colegioId,
  };

  if (input.id) {
    const { error } = await supabase.from("discounts").update(payload).eq("id", input.id);
    if (error) throw error;
    return;
  }

  const { error } = await supabase.from("discounts").insert(payload);
  if (error) throw error;
}

export async function setPromotionActive(id: number, active: boolean) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("discounts").update({ active }).eq("id", id);
  if (error) throw error;
}

export async function deletePromotion(id: number) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("discounts").delete().eq("id", id);
  if (error) throw error;
}
