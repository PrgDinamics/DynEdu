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
  clearCart,
  updateProductQuantity,
  updatePackQuantity,
  removeProductFromCart,
  removePackFromCart,
} from "@/lib/store/cart";

type ProductRow = {
  id: number;
  descripcion: string;
  codigo_venta?: string | null;
  foto_url?: string | null;
};

type PackRow = {
  id: number;
  nombre: string;
  codigo_venta?: string | null;
  foto_url?: string | null;
  pack_items?: Array<{
    cantidad?: number | null;
    productos?: {
      id: number;
      descripcion: string;
      internal_id: string;
      codigo_venta?: string | null;
    } | null;
  }> | null;
};

type ViewItemBase = {
  key: string;
  type: "PRODUCT" | "PACK";
  titulo: string;
  codigo?: string | null;
  precio: number; // unit price (product or pack unit price)
  qty: number;
  image_url?: string | null;
  subtitle?: string | null;
};

type ViewItemProduct = ViewItemBase & {
  type: "PRODUCT";
  productId: number;
};

type ViewItemPack = ViewItemBase & {
  type: "PACK";
  packId: number;
};

type ViewItem = ViewItemProduct | ViewItemPack;

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

  // Build items: productos + packs + precios desde price_list_items
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

      const cleanCart = cartItems.filter((x: any) => (x?.quantity ?? 0) > 0);

      if (cleanCart.length === 0) {
        if (!alive) return;
        setItems([]);
        setLoading(false);
        return;
      }

      const productIds = cleanCart
        .filter((c: any) => c.type === "PRODUCT")
        .map((c: any) => c.productId);

      const packIds = cleanCart
        .filter((c: any) => c.type === "PACK")
        .map((c: any) => c.packId);

      // Fetch product rows
      let productMap = new Map<number, ProductRow>();
      if (productIds.length > 0) {
        const { data: products, error: pErr } = await supabase
          .from("productos")
          .select("id,descripcion,codigo_venta,foto_url")
          .in("id", productIds);

        if (!alive) return;

        if (pErr) {
          console.error("[carrito] productos error:", pErr);
        } else {
          (products ?? []).forEach((p: any) => productMap.set(Number(p.id), p as ProductRow));
        }
      }

      // Fetch pack rows (with items for subtitle)
      let packMap = new Map<number, PackRow>();
      if (packIds.length > 0) {
        const { data: packs, error: pkErr } = await supabase
          .from("packs")
          .select(
            `
            id,
            nombre,
            codigo_venta,
            foto_url,
            pack_items (
              cantidad,
              productos (
                id,
                descripcion,
                internal_id,
                codigo_venta
              )
            )
          `
          )
          .in("id", packIds);

        if (!alive) return;

        if (pkErr) {
          console.error("[carrito] packs error:", pkErr);
        } else {
          (packs ?? []).forEach((p: any) => packMap.set(Number(p.id), p as PackRow));
        }
      }

      const priceListId = await getDefaultPriceListId(supabase);
      const productPricesMap =
        priceListId && productIds.length ? await getProductPricesMap(supabase, priceListId, productIds) : new Map();
      const packPricesMap =
        priceListId && packIds.length ? await getPackPricesMap(supabase, priceListId, packIds) : new Map();

      // Preserve cart order
      const view: ViewItem[] = cleanCart.map((c: any) => {
        if (c.type === "PACK") {
          const packId = Number(c.packId);
          const p = packMap.get(packId);
          const unitPrice = packPricesMap.get(packId) ?? 0;

          const list = p?.pack_items ?? [];
          const totalUnits = (list ?? []).reduce((acc, it) => acc + Number(it?.cantidad ?? 0), 0);
          const subtitle =
            list?.length
              ? `Incluye ${list.length} producto(s) • ${totalUnits || list.length} unidad(es)`
              : "Pack";

          return {
            key: `PACK-${packId}`,
            type: "PACK",
            packId,
            titulo: p?.nombre ?? `Pack #${packId}`,
            codigo: p?.codigo_venta ?? null,
            precio: unitPrice,
            qty: Number(c.quantity ?? 1),
            image_url: p?.foto_url ?? null,
            subtitle,
          };
        }

        // PRODUCT
        const productId = Number(c.productId);
        const p = productMap.get(productId);
        const unitPrice = productPricesMap.get(productId) ?? 0;

        return {
          key: `PRODUCT-${productId}`,
          type: "PRODUCT",
          productId,
          titulo: p?.descripcion ?? `Producto #${productId}`,
          codigo: p?.codigo_venta ?? null,
          precio: unitPrice,
          qty: Number(c.quantity ?? 1),
          image_url: p?.foto_url ?? null,
          subtitle: null,
        };
      });

      if (!alive) return;
      setItems(view);
      setLoading(false);
    }

    run();
    return () => {
      alive = false;
    };
  }, [cartItems, supabase, sessionReady, session]);

  const inc = (it: ViewItem) => {
    if (it.type === "PACK") {
      const current = cartItems.find((x: any) => x.type === "PACK" && x.packId === it.packId)?.quantity ?? 0;
      updatePackQuantity(it.packId, current + 1);
      return;
    }

    const current = cartItems.find((x: any) => x.type === "PRODUCT" && x.productId === it.productId)?.quantity ?? 0;
    updateProductQuantity(it.productId, current + 1);
  };

  const dec = (it: ViewItem) => {
    if (it.type === "PACK") {
      const current = cartItems.find((x: any) => x.type === "PACK" && x.packId === it.packId)?.quantity ?? 0;
      updatePackQuantity(it.packId, Math.max(1, current - 1));
      return;
    }

    const current = cartItems.find((x: any) => x.type === "PRODUCT" && x.productId === it.productId)?.quantity ?? 0;
    updateProductQuantity(it.productId, Math.max(1, current - 1));
  };

  const remove = (it: ViewItem) => {
    if (it.type === "PACK") {
      removePackFromCart(it.packId);
      return;
    }
    removeProductFromCart(it.productId);
  };

  const clear = () => clearCart();

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
            <div className="cart-item" key={it.key}>
              <div className="cart-item-left">
                <img
                  className="cart-item-img"
                  src={it.image_url || "/images/placeholders/book-cover.png"}
                  alt={it.titulo}
                />
                <div className="cart-item-info">
                  <div className="cart-item-name">
                    {it.titulo}
                    {it.type === "PACK" ? " (Pack)" : ""}
                  </div>

                  {it.codigo ? <div className="cart-item-code">{it.codigo}</div> : null}

                  {it.type === "PACK" && it.subtitle ? (
                    <div className="cart-item-code">{it.subtitle}</div>
                  ) : null}

                  <div className="cart-item-unit">
                    S/ {it.precio.toFixed(2)} {it.type === "PACK" ? "pack" : "c/u"}
                  </div>
                </div>
              </div>

              <div className="cart-item-right">
                <div className="cart-qty">
                  <button onClick={() => dec(it)} className="cart-qty-btn" aria-label="decrease">
                    −
                  </button>
                  <div className="cart-qty-num">{it.qty}</div>
                  <button onClick={() => inc(it)} className="cart-qty-btn" aria-label="increase">
                    +
                  </button>
                </div>

                <div className="cart-item-price">
                  <div>S/ {(it.precio * it.qty).toFixed(2)}</div>
                  <button onClick={() => remove(it)} className="cart-remove">
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
