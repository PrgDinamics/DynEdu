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
} from "lucide-react";

type ProductRow = {
  id: number;
  descripcion: string;
  codigo_venta: string | null;
  foto_url: string | null;
};

type CartLine = {
  productId: number;
  quantity: number;
  product: ProductRow;
  unitPrice: number;
};

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

  const safeRedirect = (path: string) => {
    if (redirectingRef.current) return;
    redirectingRef.current = true;
    router.replace(path);
    router.refresh();
  };

  // 1) Auth guard (client-side) — stable, no hard reload
  useEffect(() => {
    let alive = true;

    const check = async () => {
      const { data, error: e } = await supabase.auth.getUser();
      if (!alive) return;

      const ok = !!data.user && !e;
      setHasSession(ok);
      setUserEmail(data.user?.email ?? "");
      setSessionReady(true);

      if (!ok) {
        safeRedirect(`/auth/login?next=${encodeURIComponent("/checkout")}`);
      }
    };

    check();

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
      // If session becomes null => redirect.
      if (!session) {
        setHasSession(false);
        setSessionReady(true);
        safeRedirect(`/auth/login?next=${encodeURIComponent("/checkout")}`);
        return;
      }

      // Session exists; confirm user.
      const { data } = await supabase.auth.getUser();
      const ok = !!data.user;
      setHasSession(ok);
      setUserEmail(data.user?.email ?? "");
      setSessionReady(true);

      if (!ok) safeRedirect(`/auth/login?next=${encodeURIComponent("/checkout")}`);
    });

    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

    if (bErr) return; // no hard fail in UI
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
      const cart = getCart().filter((x) => x.quantity > 0);

      if (cart.length === 0) {
        setLines([]);
        safeRedirect("/carrito");
        return;
      }

      const productIds = cart.map((x) => x.productId);

      const { data: products, error: prodErr } = await supabase
        .from("productos")
        .select("id,descripcion,codigo_venta,foto_url")
        .in("id", productIds);

      if (prodErr) throw prodErr;

      const { data: defaultList, error: listErr } = await supabase
        .from("price_lists")
        .select("id")
        .eq("es_predeterminada", true)
        .eq("estado", true)
        .limit(1)
        .maybeSingle();

      if (listErr) throw listErr;
      if (!defaultList?.id) throw new Error("No hay una lista de precios predeterminada activa.");

      const { data: prices, error: priceErr } = await supabase
        .from("price_list_items")
        .select("producto_id,precio")
        .eq("price_list_id", defaultList.id)
        .in("producto_id", productIds);

      if (priceErr) throw priceErr;

      const priceMap = new Map<number, number>();
      (prices as any[] | null)?.forEach((p) => {
        const pid =
          typeof p?.producto_id === "number"
            ? p.producto_id
            : typeof p?.producto_id === "string"
              ? Number(p.producto_id)
              : NaN;

        if (Number.isFinite(pid)) priceMap.set(pid, Number(p.precio));
      });

      const prodMap = new Map<number, ProductRow>();
      (products as any[] | null)?.forEach((p) => {
        const id = typeof p?.id === "number" ? p.id : Number(p?.id);
        if (Number.isFinite(id)) prodMap.set(id, p as ProductRow);
      });

      const nextLines: CartLine[] = cart
        .map((c) => {
          const product = prodMap.get(c.productId);
          const unitPrice = priceMap.get(c.productId);
          if (!product) return null;
          if (unitPrice == null) return null;
          return { productId: c.productId, quantity: c.quantity, product, unitPrice };
        })
        .filter(Boolean) as CartLine[];

      if (nextLines.length !== cart.length) {
        throw new Error("Faltan precios o productos para algunos items. Revisa la lista de precios predeterminada.");
      }

      setLines(nextLines);
    } catch (e: any) {
      setError(e?.message || "No se pudo cargar el checkout.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!sessionReady) return;
    if (!hasSession) return;

    redirectingRef.current = false; // allow internal redirects after auth is stable
    load();
    loadBuyer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionReady, hasSession]);

  useEffect(() => {
    if (!buyer) return;
    if (!useSavedAddress) return;
    setAddress(buyer.address_line1 ?? "");
    setDistrict(buyer.district ?? "");
    setReference(buyer.reference ?? "");
  }, [useSavedAddress, buyer]);

  const total = lines.reduce((acc, l) => acc + l.unitPrice * l.quantity, 0);

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
          items: lines.map((l) => ({ productId: l.productId, quantity: l.quantity })),
        }),
      });

      const json = await res.json().catch(() => ({}));
      const msg = String(json?.error || "");

      if (res.status === 401 && msg === "AUTH_REQUIRED") {
        safeRedirect(`/auth/login?next=${encodeURIComponent("/checkout")}`);
        return;
      }

      if (res.status === 403 && msg === "BUYER_PROFILE_REQUIRED") {
        safeRedirect(`/auth/register?mode=complete&next=${encodeURIComponent("/checkout")}`);
        return;
      }

      if (!res.ok) throw new Error(json?.error || "No se pudo iniciar el pago.");
      if (!json?.init_point) throw new Error("No se recibió el link de pago (init_point).");

      clearCart();
      window.location.href = json.init_point; // external redirect OK
    } catch (e: any) {
      setError(e?.message || "No se pudo iniciar el pago.");
    } finally {
      setCreating(false);
    }
  };

  if (!sessionReady) return null;
  if (!hasSession) return null;

  const buyerName = [buyer?.first_name, buyer?.last_name].filter(Boolean).join(" ");
  const buyerDoc = [buyer?.document_type, buyer?.document_number].filter(Boolean).join(" ");
  const hasBuyerAddress = !!buyer?.address_line1 || !!buyer?.district;

  return (
    <div className="checkout-page">
      <div className="checkout">
        <div className="checkout-top">
          <a className="checkout-back" href="/carrito">
            <ArrowLeft size={16} />
            <span>Volver al carrito</span>
          </a>
          <h1 className="checkout-title">Checkout</h1>
        </div>

        {loading && (
          <div className="checkout-state">
            <Loader2 className="spin" size={16} /> Cargando…
          </div>
        )}

        {!loading && error && (
          <div className="checkout-state is-error">
            <ShieldCheck size={16} /> {error}
          </div>
        )}

        {!loading && !error && lines.length === 0 && <div className="checkout-state">Tu carrito está vacío.</div>}

        {!loading && !error && lines.length > 0 && (
          <div className="checkout-grid">
            <section className="checkout-form">
              <div className="section-title">
                <Truck size={16} />
                <h2>Envío</h2>
              </div>

              <div className="buyer-card">
                <div className="buyer-row">
                  <UserRound size={16} />
                  <div>
                    <div className="buyer-main">{buyerName || "Perfil"}</div>
                    <div className="buyer-sub">
                      {buyerDoc ? (
                        <>
                          <IdCard size={14} /> {buyerDoc}
                        </>
                      ) : (
                        <span className="muted">Documento no registrado</span>
                      )}

                      {buyer?.phone ? (
                        <>
                          <span className="dot">•</span>
                          <Phone size={14} /> {buyer.phone}
                        </>
                      ) : null}

                      {userEmail ? (
                        <>
                          <span className="dot">•</span>
                          <Mail size={14} /> {userEmail}
                        </>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="buyer-actions">
                  <a className="buyer-link" href="/perfil">
                    Editar perfil
                  </a>
                </div>
              </div>

              <label className={`checkout-check ${!hasBuyerAddress ? "is-disabled" : ""}`}>
                <input
                  type="checkbox"
                  checked={useSavedAddress}
                  disabled={!hasBuyerAddress}
                  onChange={(e) => setUseSavedAddress(e.target.checked)}
                />
                <span>Usar la dirección registrada</span>
              </label>

              <div className="field">
                <label>Dirección</label>
                <div className="input-ic">
                  <MapPin size={16} />
                  <input
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Street / number / apt"
                    disabled={useSavedAddress}
                  />
                </div>
              </div>

              <div className="row">
                <div className="field">
                  <label>Distrito</label>
                  <div className="input-ic">
                    <MapPinned size={16} />
                    <input
                      value={district}
                      onChange={(e) => setDistrict(e.target.value)}
                      placeholder="District"
                      disabled={useSavedAddress}
                    />
                  </div>
                </div>

                <div className="field">
                  <label>Referencia</label>
                  <div className="input-ic">
                    <MapPin size={16} />
                    <input
                      value={reference}
                      onChange={(e) => setReference(e.target.value)}
                      placeholder="Detalles"
                      disabled={useSavedAddress}
                    />
                  </div>
                </div>
              </div>

              <div className="field">
                <label>Nota</label>
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
                  * Tu perfil aún no tiene dirección registrada. Completa tus datos en <b>Registro</b> o en <b>Perfil</b>.
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
                  <div key={l.productId} className="line">
                    <span className="line-title">
                      {l.product.descripcion} <small>x{l.quantity}</small>
                    </span>
                    <strong>{formatPEN(l.unitPrice * l.quantity)}</strong>
                  </div>
                ))}
              </div>

              <div className="total">
                <span>Total</span>
                <strong>{formatPEN(total)}</strong>
              </div>

              <button className="pay-btn" type="button" disabled={creating} onClick={createPreferenceAndPay}>
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
