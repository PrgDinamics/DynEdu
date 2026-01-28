"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { clearCart, getCart } from "@/lib/store/cart";
import { createSupabaseBrowserClient } from "@/lib/supabaseBrowserClient";
import "./checkout.css";

import {
  ArrowLeft,
  Truck,
  MapPin,
  MapPinned,
  StickyNote,
  UserRound,
  Phone,
  IdCard,
  Mail,
  ShoppingBag,
  Loader2,
  ShieldCheck,
  Tag,
  Package,
} from "lucide-react";

type ProductRow = {
  id: number;
  descripcion: string;
  codigo_venta: string | null;
  foto_url: string | null;
};

type PackRow = {
  id: number;
  nombre: string;
  codigo_venta: string | null;
  foto_url: string | null;
};

type CartLineProduct = {
  type: "PRODUCT";
  productId: number;
  quantity: number;
  product: ProductRow;
  unitPrice: number;
};

type CartLinePack = {
  type: "PACK";
  packId: number;
  quantity: number;
  pack: PackRow;
  unitPrice: number; // pack unit price
};

type CartLine = CartLineProduct | CartLinePack;

type BuyerRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  document_type: string | null;
  document_number: string | null;
  phone: string | null;
  address_line1: string | null;
  address_line2: string | null;
  district: string | null;
  city: string | null;
  reference: string | null;
  student_full_name: string | null;
  school_name: string | null;
};

function formatPEN(value: number) {
  return new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: "PEN",
    minimumFractionDigits: 2,
  }).format(value);
}

async function getDefaultPriceListId(supabase: any): Promise<number | null> {
  const { data: preferred, error: e1 } = await supabase
    .from("price_lists")
    .select("id")
    .eq("estado", true)
    .eq("es_predeterminada", true)
    .limit(1)
    .maybeSingle();

  if (!e1 && preferred?.id) return Number(preferred.id);

  const { data: fallback } = await supabase
    .from("price_lists")
    .select("id")
    .eq("estado", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  return fallback?.id ? Number(fallback.id) : null;
}

async function getProductPricesMap(
  supabase: any,
  priceListId: number,
  productIds: number[]
): Promise<Map<number, number>> {
  const map = new Map<number, number>();
  if (!priceListId || productIds.length === 0) return map;

  const { data, error } = await supabase
    .from("price_list_items")
    .select("producto_id,precio")
    .eq("price_list_id", priceListId)
    .in("producto_id", productIds);

  if (error) {
    console.error("[pricing] product price_list_items error:", error);
    return map;
  }

  (data ?? []).forEach((row: any) => {
    map.set(Number(row.producto_id), Number(row.precio ?? 0));
  });

  return map;
}

async function getPackPricesMap(
  supabase: any,
  priceListId: number,
  packIds: number[]
): Promise<Map<number, number>> {
  const map = new Map<number, number>();
  if (!priceListId || packIds.length === 0) return map;

  const { data, error } = await supabase
    .from("price_list_items")
    .select("pack_id,precio")
    .eq("price_list_id", priceListId)
    .in("pack_id", packIds);

  if (error) {
    console.error("[pricing] pack price_list_items error:", error);
    return map;
  }

  (data ?? []).forEach((row: any) => {
    map.set(Number(row.pack_id), Number(row.precio ?? 0));
  });

  return map;
}

export default function CheckoutClient() {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const redirectingRef = useRef(false);

  const [sessionReady, setSessionReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [userEmail, setUserEmail] = useState<string>("");

  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lines, setLines] = useState<CartLine[]>([]);

  // Buyer profile
  const [buyer, setBuyer] = useState<BuyerRow | null>(null);
  const [useSavedAddress, setUseSavedAddress] = useState(true);

  // Shipping
  const [address, setAddress] = useState("");
  const [reference, setReference] = useState("");
  const [district, setDistrict] = useState("");
  const [notes, setNotes] = useState("");

  // Discount code (promo)
  const [discountCode, setDiscountCode] = useState("");
  const [checkingDiscount, setCheckingDiscount] = useState(false);
  const [discountPreview, setDiscountPreview] = useState<{
    normalized_code: string;
    applied: boolean;
    subtotal: number;
    discount_amount: number;
    total: number;
    message?: string | null;
  } | null>(null);

  const safeRedirect = (path: string) => {
    if (redirectingRef.current) return;
    redirectingRef.current = true;
    router.replace(path);
    router.refresh();
  };

  // 1) Auth guard
  useEffect(() => {
    let alive = true;

    const check = async () => {
      const { data, error: e } = await supabase.auth.getSession();
      if (!alive) return;

      if (e) {
        setSessionReady(true);
        setHasSession(false);
        return;
      }

      const ok = !!data.session?.user;
      setHasSession(ok);
      setUserEmail(data.session?.user?.email || "");
      setSessionReady(true);
    };

    check();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      const ok = !!session?.user;
      setHasSession(ok);
      setUserEmail(session?.user?.email || "");
      setSessionReady(true);
    });

    return () => {
      alive = false;
      authListener?.subscription?.unsubscribe();
    };
  }, [supabase]);

  const loadBuyer = async () => {
    const { data: u } = await supabase.auth.getUser();
    const user = u.user;
    if (!user) return;

    const { data, error: bErr } = await supabase
      .from("buyers")
      .select(
        "id,first_name,last_name,document_type,document_number,phone,address_line1,address_line2,district,city,reference,student_full_name,school_name"
      )
      .eq("id", user.id)
      .maybeSingle();

    if (bErr) return;
    setBuyer((data as any) ?? null);

    const hasAddr = !!data?.address_line1 || !!data?.district;
    setUseSavedAddress(hasAddr);

    if (hasAddr) {
      setAddress(data?.address_line1 ?? "");
      setDistrict(data?.district ?? "");
      setReference(data?.reference ?? "");
    }
  };

  const load = async () => {
    setLoading(true);
    setError(null);

    try {
      const cart = getCart().filter((x: any) => (x.quantity ?? 0) > 0);

      if (cart.length === 0) {
        setLines([]);
        safeRedirect("/carrito");
        return;
      }

      const productIds = cart
        .filter((x: any) => x.type === "PRODUCT")
        .map((x: any) => Number(x.productId));

      const packIds = cart
        .filter((x: any) => x.type === "PACK")
        .map((x: any) => Number(x.packId));

      // Fetch products
      const prodMap = new Map<number, ProductRow>();
      if (productIds.length) {
        const { data: products, error: prodErr } = await supabase
          .from("productos")
          .select("id,descripcion,codigo_venta,foto_url")
          .in("id", productIds);

        if (prodErr) throw prodErr;

        (products as any[] | null)?.forEach((p) => {
          const pid = Number(p?.id);
          if (Number.isFinite(pid)) prodMap.set(pid, p as ProductRow);
        });
      }

      // Fetch packs
      const packMap = new Map<number, PackRow>();
      if (packIds.length) {
        const { data: packs, error: packErr } = await supabase
          .from("packs")
          .select("id,nombre,codigo_venta,foto_url")
          .in("id", packIds);

        if (packErr) throw packErr;

        (packs as any[] | null)?.forEach((p) => {
          const id = Number(p?.id);
          if (Number.isFinite(id)) packMap.set(id, p as PackRow);
        });
      }

      // Price list
      const priceListId = await getDefaultPriceListId(supabase);
      if (!priceListId) throw new Error("No hay una lista de precios predeterminada activa.");

      const productPricesMap = await getProductPricesMap(supabase, priceListId, productIds);
      const packPricesMap = await getPackPricesMap(supabase, priceListId, packIds);

      const computed: CartLine[] = cart.map((c: any) => {
        if (c.type === "PACK") {
          const packId = Number(c.packId);
          const pack = packMap.get(packId);
          const unit = packPricesMap.get(packId);

          if (!pack) throw new Error(`Pack no encontrado (ID ${packId})`);
          if (unit == null)
            throw new Error(`No hay precio configurado para el pack "${pack.nombre}"`);

          return {
            type: "PACK",
            packId,
            quantity: Number(c.quantity ?? 1),
            pack,
            unitPrice: Number(unit),
          };
        }

        const productId = Number(c.productId);
        const product = prodMap.get(productId);
        const unit = productPricesMap.get(productId);

        if (!product) throw new Error("Producto no encontrado");
        if (unit == null)
          throw new Error(`No hay precio configurado para "${product.descripcion}"`);

        return {
          type: "PRODUCT",
          productId,
          quantity: Number(c.quantity ?? 1),
          product,
          unitPrice: Number(unit),
        };
      });

      setLines(computed);
    } catch (e: any) {
      setError(e?.message || "No se pudo cargar el checkout.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!sessionReady) return;

    if (!hasSession) {
      safeRedirect(`/auth/login?next=${encodeURIComponent("/checkout")}`);
      return;
    }

    loadBuyer();
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionReady, hasSession]);

  const hasBuyerAddress =
    !!buyer?.address_line1?.trim() || !!buyer?.district?.trim() || !!buyer?.reference?.trim();

  useEffect(() => {
    if (!buyer) return;

    if (useSavedAddress) {
      setAddress(buyer.address_line1 ?? "");
      setDistrict(buyer.district ?? "");
      setReference(buyer.reference ?? "");
    }
  }, [useSavedAddress, buyer]);

  const normalizeDiscountCode = (raw: string) => String(raw ?? "").trim().toUpperCase();

  const subtotal = lines.reduce((acc, l) => acc + l.unitPrice * l.quantity, 0);

  // Use preview totals only if the code matches current input
  const normalizedCode = normalizeDiscountCode(discountCode);
  const discountApplied =
    !!discountPreview?.applied && discountPreview.normalized_code === normalizedCode;

  const discountAmount = discountApplied ? Number(discountPreview?.discount_amount ?? 0) : 0;
  const total = discountApplied ? Number(discountPreview?.total ?? subtotal) : subtotal;

  // If cart changes, invalidate discount preview
  useEffect(() => {
    setDiscountPreview(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lines.length]);

  const applyDiscountPreview = async () => {
    const code = normalizeDiscountCode(discountCode);
    if (!code) {
      setDiscountPreview(null);
      return;
    }

    setCheckingDiscount(true);
    setError(null);

    try {
      const res = await fetch("/api/mercadopago/create-preference", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          previewOnly: true,
          discount_code: code,
          items: lines.map((l) =>
            l.type === "PACK"
              ? { type: "PACK", packId: l.packId, quantity: l.quantity }
              : { type: "PRODUCT", productId: l.productId, quantity: l.quantity }
          ),
        }),
      });

      const json = await res.json().catch(() => ({}));
      const msg = String(json?.error || "");

      if (res.status === 401 && msg === "AUTH_REQUIRED") {
        safeRedirect(`/auth/login?next=${encodeURIComponent("/checkout")}`);
        return;
      }

      if (res.status === 403 && msg === "BUYER_PROFILE_REQUIRED") {
        safeRedirect(`/perfil?next=${encodeURIComponent("/checkout")}`);
        return;
      }

      if (!res.ok) throw new Error(json?.error || "No se pudo validar el código.");

      setDiscountPreview({
        normalized_code: String(json?.normalized_code ?? code),
        applied: Boolean(json?.applied),
        subtotal: Number(json?.subtotal ?? subtotal),
        discount_amount: Number(json?.discount_amount ?? 0),
        total: Number(json?.total ?? subtotal),
        message: json?.message ?? null,
      });
    } catch (e: any) {
      setDiscountPreview(null);
      setError(e?.message || "No se pudo validar el código.");
    } finally {
      setCheckingDiscount(false);
    }
  };

  const createPreferenceAndPay = async () => {
    setCreating(true);
    setError(null);

    try {
      if (!lines.length) throw new Error("Tu carrito está vacío.");
      if (!address.trim()) throw new Error("Completa la dirección de envío.");

      const res = await fetch("/api/mercadopago/create-preference", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          shipping: {
            address: address.trim(),
            reference: reference.trim() || null,
            district: district.trim() || null,
            notes: notes.trim() || null,
          },
          items: lines.map((l) =>
            l.type === "PACK"
              ? { type: "PACK", packId: l.packId, quantity: l.quantity }
              : { type: "PRODUCT", productId: l.productId, quantity: l.quantity }
          ),
          discount_code: normalizedCode || null,
        }),
      });

      const json = await res.json().catch(() => ({}));
      const msg = String(json?.error || "");

      if (res.status === 401 && msg === "AUTH_REQUIRED") {
        safeRedirect(`/auth/login?next=${encodeURIComponent("/checkout")}`);
        return;
      }

      if (res.status === 403 && msg === "BUYER_PROFILE_REQUIRED") {
        safeRedirect(`/perfil?next=${encodeURIComponent("/checkout")}`);
        return;
      }

      if (!res.ok) throw new Error(json?.error || "No se pudo iniciar el pago.");
      if (!json?.init_point) throw new Error("No se recibió el link de pago (init_point).");

      clearCart();
      window.location.href = json.init_point;
    } catch (e: any) {
      setError(e?.message || "No se pudo iniciar el pago.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="checkout-page">
      <div className="checkout">
        <div className="checkout-top">
          <a className="checkout-back" href="/carrito">
            <ArrowLeft size={16} />
            <span>Volver</span>
          </a>

          <h1 className="checkout-title">Checkout</h1>

          <div className="checkout-security">
            <ShieldCheck size={16} />
            <span>Pago seguro</span>
          </div>
        </div>

        {!sessionReady || loading ? (
          <div className="checkout-state">
            <Loader2 className="spin" size={16} />
            <span>Cargando…</span>
          </div>
        ) : error ? (
          <div className="checkout-state is-error">{error}</div>
        ) : (
          <div className="checkout-grid">
            <section className="checkout-form">
              <div className="section-title">
                <Truck size={16} />
                <h2>Datos de envío</h2>
              </div>

              <div className="checkout-profile">
                <div className="profile-row">
                  <UserRound size={16} />
                  <div>
                    <b>{(buyer?.first_name || "") + " " + (buyer?.last_name || "")}</b>
                    <small>{userEmail}</small>
                  </div>
                </div>

                <div className="profile-grid">
                  <div className="profile-item">
                    <IdCard size={16} />
                    <span>
                      {buyer?.document_type || "DOC"}: {buyer?.document_number || "-"}
                    </span>
                  </div>
                  <div className="profile-item">
                    <Phone size={16} />
                    <span>{buyer?.phone || "-"}</span>
                  </div>
                  <div className="profile-item">
                    <Mail size={16} />
                    <span>{userEmail || "-"}</span>
                  </div>
                </div>
              </div>

              {hasBuyerAddress && (
                <div className="toggle-row">
                  <label className="toggle">
                    <input
                      type="checkbox"
                      checked={useSavedAddress}
                      onChange={(e) => setUseSavedAddress(e.target.checked)}
                    />
                    <span>Usar mi dirección guardada</span>
                  </label>
                </div>
              )}

              <div className="fields">
                <label>
                  Dirección
                  <div className="input-ic">
                    <MapPin size={16} />
                    <input
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="Av. / Calle, número, etc."
                    />
                  </div>
                </label>

                <label>
                  Distrito
                  <div className="input-ic">
                    <MapPinned size={16} />
                    <input
                      value={district}
                      onChange={(e) => setDistrict(e.target.value)}
                      placeholder="Distrito"
                    />
                  </div>
                </label>

                <label>
                  Referencia (opcional)
                  <div className="input-ic">
                    <MapPinned size={16} />
                    <input
                      value={reference}
                      onChange={(e) => setReference(e.target.value)}
                      placeholder="Frente a… / Piso… / etc."
                    />
                  </div>
                </label>

                <div className="textarea-ic">
                  <StickyNote size={16} />
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    placeholder="Algo a tomar en cuenta.."
                  />
                </div>
              </div>

              {!hasBuyerAddress && (
                <div className="checkout-hint">
                  * Tu perfil aún no tiene dirección registrada. Completa tus datos en{" "}
                  <b>Registro</b> o en <b>Perfil</b>.
                </div>
              )}
            </section>

            <aside className="checkout-summary">
              <div className="section-title">
                <ShoppingBag size={16} />
                <h2>Resumen</h2>
              </div>

              <div className="lines">
                {lines.map((l) => (
                  <div
                    key={l.type === "PACK" ? `PACK-${l.packId}` : `PRODUCT-${l.productId}`}
                    className="line"
                  >
                    <span className="line-title">
                      {l.type === "PACK" ? (
                        <>
                          <Package size={14} style={{ marginRight: 6 }} />
                          {l.pack.nombre} <small>x{l.quantity}</small>
                        </>
                      ) : (
                        <>
                          {l.product.descripcion} <small>x{l.quantity}</small>
                        </>
                      )}
                    </span>
                    <strong>{formatPEN(l.unitPrice * l.quantity)}</strong>
                  </div>
                ))}

                {discountApplied && discountAmount > 0 && (
                  <div className="line">
                    <span className="line-title">Descuento</span>
                    <strong>-{formatPEN(discountAmount)}</strong>
                  </div>
                )}
              </div>

              <div className="discount-block">
                <div className="field">
                  <label>Código de descuento</label>
                  <div className="input-ic">
                    <Tag size={16} />
                    <input
                      value={discountCode}
                      onChange={(e) => {
                        setDiscountCode(e.target.value);
                        if (discountPreview) setDiscountPreview(null);
                      }}
                      placeholder="Ingresa tu código"
                    />
                  </div>

                  <div className="discount-actions">
                    <button
                      className="checkout-back"
                      type="button"
                      onClick={applyDiscountPreview}
                      disabled={checkingDiscount || !normalizeDiscountCode(discountCode)}
                    >
                      {checkingDiscount ? "Verificando…" : "Aplicar"}
                    </button>

                    {discountApplied && <span className="discount-ok">Aplicado ✓</span>}
                  </div>

                  {discountPreview && !discountPreview.applied && (
                    <div className="checkout-hint">
                      {discountPreview.message || "Código no válido."}
                    </div>
                  )}
                </div>
              </div>

              <div className="total">
                <span>Total</span>
                <strong>{formatPEN(total)}</strong>
              </div>

              <button
                className="pay-btn"
                type="button"
                disabled={creating}
                onClick={createPreferenceAndPay}
              >
                {creating ? (
                  <>
                    <Loader2 className="spin" size={16} />
                    <span>Redirecting…</span>
                  </>
                ) : (
                  <span>Paga con Mercado Pago</span>
                )}
              </button>

              <a className="checkout-back checkout-center-link" href="/libros">
                Seguir comprando
              </a>
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}
