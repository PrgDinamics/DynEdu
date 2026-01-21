"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Session } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import "./carrito.css";

import { createSupabaseBrowserClient } from "@/lib/supabaseBrowserClient";

import {
  CART_EVENT_NAME,
  CART_STORAGE_KEY,
  getCart,
  updateQuantity,
  removeFromCart,
  clearCart,
} from "@/lib/store/cart";

type ProductRow = {
  id: number;
  descripcion: string;
  codigo_venta?: string | null;
  foto_url?: string | null;
};

type ViewItem = {
  productId: number;
  titulo: string;
  codigo?: string | null;
  precio: number; // unit price (from price_list_items)
  qty: number;
  image_url?: string | null;
};

// ---- Pricing helpers (based on your DB schema) ----
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

async function getPricesMap(
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
    console.error("[pricing] price_list_items error:", error);
    return map;
  }

  (data ?? []).forEach((row: any) => {
    map.set(Number(row.producto_id), Number(row.precio ?? 0));
  });

  return map;
}

// Subscribe cart without useSyncExternalStore
function subscribeCart(cb: () => void) {
  const onStorage = (e: StorageEvent) => {
    if (e.key === CART_STORAGE_KEY) cb();
  };
  const onCustom = () => cb();

  window.addEventListener("storage", onStorage);
  window.addEventListener(CART_EVENT_NAME, onCustom);

  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(CART_EVENT_NAME, onCustom);
  };
}

export default function CarritoClient() {
  const router = useRouter();

  // ✅ Unified client (same as CheckoutClient)
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const [session, setSession] = useState<Session | null>(null);
  const [sessionReady, setSessionReady] = useState(false);

  // cart state
  const [cartItems, setCartItems] = useState(() => getCart());

  const [items, setItems] = useState<ViewItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Auth
  useEffect(() => {
    let alive = true;

    supabase.auth.getSession().then(async ({ data, error }) => {
      if (!alive) return;

      // ✅ If refresh token is corrupt/missing, sign out hard and go login
      if (error) {
        await supabase.auth.signOut();
        router.replace(`/auth/login?next=${encodeURIComponent("/carrito")}`);
        return;
      }

      setSession(data.session ?? null);
      setSessionReady(true);

      if (!data.session) {
        router.replace(`/auth/login?next=${encodeURIComponent("/carrito")}`);
      }
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s ?? null);
      setSessionReady(true);
      if (!s) router.replace(`/auth/login?next=${encodeURIComponent("/carrito")}`);
    });

    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, [supabase, router]);

  // Subscribe to cart changes only when session exists
  useEffect(() => {
    if (!sessionReady || !session) return;

    const refresh = () => setCartItems(getCart());
    refresh();

    const unsub = subscribeCart(refresh);
    return unsub;
  }, [sessionReady, session]);

  // Build items: productos + precios desde price_list_items
  useEffect(() => {
    let alive = true;

    async function run() {
      setLoading(true);

      if (!sessionReady || !session) {
        if (!alive) return;
        setItems([]);
        setLoading(false);
        return;
      }

      const cleanCart = cartItems.filter((x) => x.quantity > 0);

      if (cleanCart.length === 0) {
        if (!alive) return;
        setItems([]);
        setLoading(false);
        return;
      }

      const ids = cleanCart.map((c) => c.productId);

      const { data: products, error: pErr } = await supabase
        .from("productos")
        .select("id,descripcion,codigo_venta,foto_url")
        .in("id", ids);

      if (!alive) return;

      if (pErr) {
        console.error("[carrito] productos error:", pErr);
        setItems(
          cleanCart.map((c) => ({
            productId: c.productId,
            titulo: `Producto #${c.productId}`,
            codigo: null,
            precio: 0,
            qty: c.quantity,
            image_url: null,
          }))
        );
        setLoading(false);
        return;
      }

      const priceListId = await getDefaultPriceListId(supabase);
      const pricesMap = priceListId ? await getPricesMap(supabase, priceListId, ids) : new Map();

      const productMap = new Map<number, ProductRow>();
      (products ?? []).forEach((p: any) => productMap.set(Number(p.id), p as ProductRow));

      const view: ViewItem[] = cleanCart.map((c) => {
        const p = productMap.get(c.productId);
        const unitPrice = pricesMap.get(c.productId) ?? 0;

        return {
          productId: c.productId,
          titulo: p?.descripcion ?? `Producto #${c.productId}`,
          codigo: p?.codigo_venta ?? null,
          precio: unitPrice,
          qty: c.quantity,
          image_url: p?.foto_url ?? null,
        };
      });

      setItems(view);
      setLoading(false);
    }

    run();
    return () => {
      alive = false;
    };
  }, [cartItems, supabase, sessionReady, session]);

  const inc = (productId: number) => {
    const current = cartItems.find((x) => x.productId === productId)?.quantity ?? 0;
    updateQuantity(productId, current + 1);
  };

  const dec = (productId: number) => {
    const current = cartItems.find((x) => x.productId === productId)?.quantity ?? 0;
    updateQuantity(productId, Math.max(1, current - 1));
  };

  const remove = (productId: number) => {
    removeFromCart(productId);
  };

  const clear = () => {
    clearCart();
  };

  const total = items.reduce((acc, it) => acc + it.precio * it.qty, 0);

  const goCheckout = () => {
    if (!items.length) {
      router.push("/carrito");
      return;
    }
    router.push("/checkout");
  };

  if (!sessionReady) return null;
  if (!session) return null;
  if (loading) return null;

  if (!items.length) {
    return (
      <div className="cart-wrap">
        <div className="cart-empty">
          <div className="cart-empty-title">Tu carrito está vacío.</div>
          <Link href="/libros" className="cart-empty-btn">
            Ir al catálogo
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="cart-wrap">
      <div className="cart-top">
        <Link href="/libros" className="cart-back">
          ← Volver al catálogo
        </Link>
        <h1 className="cart-title">Carrito</h1>
      </div>

      <div className="cart-grid">
        <div className="cart-list">
          {items.map((it) => (
            <div className="cart-item" key={it.productId}>
              <div className="cart-item-left">
                <img
                  className="cart-item-img"
                  src={it.image_url || "/images/placeholders/book-cover.png"}
                  alt={it.titulo}
                />
                <div className="cart-item-info">
                  <div className="cart-item-name">{it.titulo}</div>
                  <div className="cart-item-code">{it.codigo || ""}</div>
                  <div className="cart-item-unit">S/ {it.precio.toFixed(2)} c/u</div>
                </div>
              </div>

              <div className="cart-item-right">
                <div className="cart-qty">
                  <button onClick={() => dec(it.productId)} className="cart-qty-btn" aria-label="decrease">
                    −
                  </button>
                  <div className="cart-qty-num">{it.qty}</div>
                  <button onClick={() => inc(it.productId)} className="cart-qty-btn" aria-label="increase">
                    +
                  </button>
                </div>

                <div className="cart-item-price">
                  <div>S/ {(it.precio * it.qty).toFixed(2)}</div>
                  <button onClick={() => remove(it.productId)} className="cart-remove">
                    Quitar
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <aside className="cart-summary">
          <div className="cart-summary-title">RESUMEN</div>

          <div className="cart-total">
            <div>Total</div>
            <div>S/ {total.toFixed(2)}</div>
          </div>

          <button className="cart-checkout" onClick={goCheckout}>
            Ir a checkout
          </button>

          <button className="cart-clear" onClick={clear}>
            Vaciar carrito
          </button>
        </aside>
      </div>
    </div>
  );
}
