"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import "./BooksCatalogClient.css";

import { createSupabaseBrowserClient } from "@/lib/supabaseBrowserClient";

import {
  addToCart,
  addPackToCart,
  clearCart,
  CART_EVENT_NAME,
  CART_STORAGE_KEY,
  getCart,
} from "@/lib/store/cart";

import AuthRequiredModal from "../modals/AuthRequiredModal";

type BookRow = {
  id: number;
  descripcion: string;
  editorial: string | null;
  codigo_venta: string | null;
  foto_url: string | null;
  anio_publicacion: number | null;
  is_public: boolean;
};

type BookView = BookRow & {
  price: number;
  available: number;
};

type ProductInPack = {
  id: number;
  descripcion: string;
  editorial: string | null;
  codigo_venta: string | null;
  foto_url: string | null;
  anio_publicacion: number | null;
};

type PackItemRow = {
  cantidad: number | null;
  productos: ProductInPack | ProductInPack[] | null;
};

type PackRow = {
  id: number;
  nombre: string;
  descripcion: string | null;
  codigo_venta: string | null;
  is_public: boolean;
  foto_url: string | null;
  pack_items: PackItemRow[] | null;
};

type PackItemView = {
  productId: number;
  qty: number;
  descripcion: string;
  codigo_venta: string | null;
  foto_url: string | null;
};

type PackView = {
  id: number;
  nombre: string;
  descripcion: string | null;
  codigo_venta: string | null;
  cover_url: string | null;
  items: PackItemView[];
  price: number; // ✅ pack price
  available: number;
};

type Mode = "books" | "packs";

const PAGE_SIZE = 9;

// ---------- helpers ----------
function normalizeOne<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
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

async function getStockAvailableMap(
  supabase: any,
  productIds: number[]
): Promise<Map<number, number>> {
  const map = new Map<number, number>();
  if (productIds.length === 0) return map;

  const { data, error } = await supabase
    .from("stock_actual_view")
    .select("producto_id,available")
    .in("producto_id", productIds);

  if (error) {
    console.error("[stock] stock_actual_view error:", error);
    return map;
  }

  (data ?? []).forEach((row: any) => {
    map.set(Number(row.producto_id), Number(row.available ?? 0));
  });

  return map;
}

export default function BooksCatalogClient() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const [mode, setMode] = useState<Mode>("books");

  const [books, setBooks] = useState<BookView[]>([]);
  const [packs, setPacks] = useState<PackView[]>([]);

  const [totalCount, setTotalCount] = useState(0);

  // loading "suave" (no borra la lista)
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [editorial, setEditorial] = useState("Todas");
  const [year, setYear] = useState("Todos");
  const [page, setPage] = useState(1);

  const [userReady, setUserReady] = useState(false);
  const [hasUser, setHasUser] = useState(false);

  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [cartCount, setCartCount] = useState(0);

  // Pack modal
  const [packModalOpen, setPackModalOpen] = useState(false);
  const [activePack, setActivePack] = useState<PackView | null>(null);

  // stale-response guard
  const fetchSeqRef = useRef(0);

  // --------------------------
  // Auth sync + cart counter
  // --------------------------
  useEffect(() => {
    let alive = true;

    const syncUser = async () => {
      try {
        const { data } = await supabase.auth.getUser();
        if (!alive) return;
        setHasUser(!!data?.user);
        setUserReady(true);
      } catch {
        if (!alive) return;
        setHasUser(false);
        setUserReady(true);
      }
    };

    syncUser();

    const { data: sub } = supabase.auth.onAuthStateChange(async () => {
      await syncUser();
    });

    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, [supabase]);

  const refreshCartCount = () => {
    const items = getCart();
    const total = items.reduce((acc: number, it: any) => acc + (it.quantity ?? 0), 0);
    setCartCount(total);
  };

  useEffect(() => {
    if (!userReady) return;

    if (!hasUser) {
      setCartCount(0);
      return;
    }

    refreshCartCount();

    const onStorage = (e: StorageEvent) => {
      if (e.key === CART_STORAGE_KEY) refreshCartCount();
    };
    const onCustom = () => refreshCartCount();

    window.addEventListener("storage", onStorage);
    window.addEventListener(CART_EVENT_NAME, onCustom);

    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(CART_EVENT_NAME, onCustom);
    };
  }, [userReady, hasUser]);

  useEffect(() => {
    if (userReady && hasUser) setAuthModalOpen(false);
  }, [userReady, hasUser]);

  // --------------------------
  // Filters helpers
  // --------------------------
  const editoriales = useMemo(() => {
    const set = new Set<string>();
    books.forEach((b) => {
      const v = (b.editorial || "").trim();
      if (v) set.add(v);
    });
    return ["Todas", ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [books]);

  const years = useMemo(() => {
    const set = new Set<number>();
    books.forEach((b) => {
      if (typeof b.anio_publicacion === "number") set.add(b.anio_publicacion);
    });
    return ["Todos", ...Array.from(set).sort((a, b) => b - a).map(String)];
  }, [books]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(totalCount / PAGE_SIZE)),
    [totalCount]
  );

  const showSkeleton =
    loading &&
    ((mode === "books" && books.length === 0) ||
      (mode === "packs" && packs.length === 0));

  // --------------------------
  // Fetch BOOKS (solo books)
  // --------------------------
  const fetchBooks = async () => {
    const mySeq = ++fetchSeqRef.current;

    setLoading(true);
    setError(null);

    try {
      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let query = supabase
        .from("productos")
        .select(
          "id,descripcion,editorial,codigo_venta,foto_url,anio_publicacion,is_public",
          { count: "exact" }
        )
        .eq("is_public", true);

      const qq = q.trim();
      if (qq) {
        query = query.or(
          `descripcion.ilike.%${qq}%,editorial.ilike.%${qq}%,codigo_venta.ilike.%${qq}%`
        );
      }

      if (editorial !== "Todas") query = query.eq("editorial", editorial);
      if (year !== "Todos") query = query.eq("anio_publicacion", Number(year));

      query = query.order("descripcion", { ascending: true }).range(from, to);

      const { data, error, count } = await query;
      if (error) throw error;

      // stale response? ignore
      if (fetchSeqRef.current !== mySeq) return;

      const rows = (data ?? []) as BookRow[];
      setTotalCount(count || 0);

      const ids = rows.map((r) => Number(r.id));

      const priceListId = await getDefaultPriceListId(supabase);
      const pricesMap = priceListId
        ? await getPricesMap(supabase, priceListId, ids)
        : new Map<number, number>();

      const stockMap = await getStockAvailableMap(supabase, ids);

      if (fetchSeqRef.current !== mySeq) return;

      const view: BookView[] = rows.map((r) => ({
        ...r,
        price: pricesMap.get(Number(r.id)) ?? 0,
        available: stockMap.get(Number(r.id)) ?? 0,
      }));

      setBooks(view);
    } catch (e: any) {
      if (fetchSeqRef.current !== mySeq) return;
      setTotalCount(0);
      setError(e?.message || "Ocurrió un error al cargar los libros.");
      if (books.length === 0) setBooks([]);
    } finally {
      if (fetchSeqRef.current === mySeq) setLoading(false);
    }
  };

  // --------------------------
  // Fetch PACKS (solo packs)
  // --------------------------
  const fetchPacks = async () => {
    const mySeq = ++fetchSeqRef.current;

    setLoading(true);
    setError(null);

    try {
      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let query = supabase
        .from("packs")
        .select(
          `
          id,
          nombre,
          descripcion,
          codigo_venta,
          is_public,
          foto_url,
          pack_items (
            cantidad,
            productos (
              id,
              descripcion,
              editorial,
              codigo_venta,
              foto_url,
              anio_publicacion
            )
          )
        `,
          { count: "exact" }
        )
        .eq("is_public", true)
        .eq("estado", true);

      const qq = q.trim();
      if (qq) {
        query = query.or(
          `nombre.ilike.%${qq}%,descripcion.ilike.%${qq}%,codigo_venta.ilike.%${qq}%`
        );
      }

      query = query.order("created_at", { ascending: false }).range(from, to);

      const { data, error, count } = await query;
      if (error) throw error;

      if (fetchSeqRef.current !== mySeq) return;

      const rows = (data ?? []) as PackRow[];
      setTotalCount(count || 0);

      const packIds = rows.map((p) => Number(p.id));

      // collect all product IDs in packs (for stock calc)
      const productIdsSet = new Set<number>();
      rows.forEach((p) => {
        (p.pack_items ?? []).forEach((it) => {
          const prod = normalizeOne(it?.productos);
          if (prod?.id) productIdsSet.add(Number(prod.id));
        });
      });

      const productIds = Array.from(productIdsSet);

      const priceListId = await getDefaultPriceListId(supabase);

      // ✅ Pack prices (bundle)
      const packPricesMap =
        priceListId && packIds.length
          ? await getPackPricesMap(supabase, priceListId, packIds)
          : new Map<number, number>();

      // (Optional) product prices only for fallback calc (si un pack no tiene precio seteado)
      const productPricesMap =
        priceListId && productIds.length
          ? await getPricesMap(supabase, priceListId, productIds)
          : new Map<number, number>();

      const stockMap = await getStockAvailableMap(supabase, productIds);

      if (fetchSeqRef.current !== mySeq) return;

      const view: PackView[] = rows.map((p) => {
        const items: PackItemView[] = (p.pack_items ?? [])
          .map((it) => {
            const prod = normalizeOne(it?.productos);
            if (!prod?.id) return null;

            return {
              productId: Number(prod.id),
              qty: Math.max(1, Number(it?.cantidad ?? 1)),
              descripcion: prod.descripcion,
              codigo_venta: prod.codigo_venta ?? null,
              foto_url: prod.foto_url ?? null,
            } as PackItemView;
          })
          .filter(Boolean) as PackItemView[];

        const cover_url =
          p.foto_url ??
          items.find((x) => !!x.foto_url)?.foto_url ??
          null;

        // ✅ price = pack price (bundle). Fallback: sum products (por si falta setear precio pack)
        const packId = Number(p.id);
        const priceFromPack = packPricesMap.get(packId);

        const fallbackSum = items.reduce((acc, it) => {
          const unit = productPricesMap.get(it.productId) ?? 0;
          return acc + unit * (it.qty ?? 1);
        }, 0);

        const price = typeof priceFromPack === "number" ? priceFromPack : fallbackSum;

        let available = 0;
        if (items.length > 0) {
          const mins = items.map((it) => {
            const stock = stockMap.get(it.productId) ?? 0;
            const qty = Math.max(1, it.qty ?? 1);
            return Math.floor(stock / qty);
          });
          available = mins.length ? Math.max(0, Math.min(...mins)) : 0;
        }

        return {
          id: packId,
          nombre: p.nombre,
          descripcion: p.descripcion,
          codigo_venta: p.codigo_venta,
          cover_url,
          items,
          price,
          available,
        };
      });

      // Extra search client-side por items (códigos/descripción)
      const qqLower = q.trim().toLowerCase();
      const finalView =
        qqLower && qqLower.length > 0
          ? view.filter((p) => {
              if (
                (p.nombre || "").toLowerCase().includes(qqLower) ||
                (p.descripcion || "").toLowerCase().includes(qqLower) ||
                (p.codigo_venta || "").toLowerCase().includes(qqLower)
              ) {
                return true;
              }
              return p.items.some((it) => {
                return (
                  (it.descripcion || "").toLowerCase().includes(qqLower) ||
                  (it.codigo_venta || "").toLowerCase().includes(qqLower)
                );
              });
            })
          : view;

      setPacks(finalView);
    } catch (e: any) {
      if (fetchSeqRef.current !== mySeq) return;
      setTotalCount(0);
      setError(e?.message || "Ocurrió un error al cargar los packs.");
      if (packs.length === 0) setPacks([]);
    } finally {
      if (fetchSeqRef.current === mySeq) setLoading(false);
    }
  };

  // ✅ Separate effects (evita fetch duplicado)
  useEffect(() => {
    if (mode !== "books") return;
    fetchBooks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, q, editorial, year, page]);

  useEffect(() => {
    if (mode !== "packs") return;
    fetchPacks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, q, page]);

  // --------------------------
  // UI actions
  // --------------------------
  const resetFiltersAndCart = () => {
    setQ("");
    setEditorial("Todas");
    setYear("Todos");
    setPage(1);
    clearCart();
  };

  const requireAuthOrOpenModal = () => {
    if (!userReady) return false;
    if (!hasUser) {
      setAuthModalOpen(true);
      return false;
    }
    return true;
  };

  const handleAddBookToCart = (book: BookView) => {
    if (!requireAuthOrOpenModal()) return;
    if (Number(book.available ?? 0) <= 0) return;
    addToCart(book.id, 1);
  };

  const handleAddPackToCart = (pack: PackView) => {
    if (!requireAuthOrOpenModal()) return;
    if (Number(pack.available ?? 0) <= 0) return;

    // ✅ Add as bundle (NOT expand into products)
    addPackToCart(pack.id, 1);
  };

  const openPackModal = (pack: PackView) => {
    setActivePack(pack);
    setPackModalOpen(true);
  };

  const cartHref = hasUser
    ? "/carrito"
    : `/auth/login?next=${encodeURIComponent("/carrito")}`;

  const showingFrom = totalCount ? (page - 1) * PAGE_SIZE + 1 : 0;
  const showingTo = Math.min(page * PAGE_SIZE, totalCount);

  return (
    <div className="catalog">
      <AuthRequiredModal
        open={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        message="Regístrate o inicia sesión para agregar items al carrito."
        nextPath="/libros"
      />

      {/* Modal detalle pack */}
      {packModalOpen && activePack && (
        <div
          className="simple-modal-overlay"
          onClick={() => setPackModalOpen(false)}
        >
          <div className="simple-modal" onClick={(e) => e.stopPropagation()}>
            <div className="simple-modal-header">
              <div>
                <div className="simple-modal-title">{activePack.nombre}</div>
                <div className="simple-modal-sub">
                  {activePack.codigo_venta ? `Código: ${activePack.codigo_venta}` : ""}
                </div>
              </div>
              <button
                className="simple-modal-close"
                onClick={() => setPackModalOpen(false)}
                type="button"
              >
                ✕
              </button>
            </div>

            {activePack.descripcion && (
              <div className="simple-modal-desc">{activePack.descripcion}</div>
            )}

            <div className="simple-modal-list">
              {activePack.items.map((it) => (
                <div
                  key={`${activePack.id}-${it.productId}`}
                  className="simple-modal-item"
                >
                  <div className="simple-modal-item-left">
                    <div className="simple-modal-item-title">{it.descripcion}</div>
                    <div className="simple-modal-item-sub">
                      {it.codigo_venta ? `(${it.codigo_venta})` : ""}
                    </div>
                  </div>
                  <div className="simple-modal-item-qty">× {it.qty}</div>
                </div>
              ))}
            </div>

            <div className="simple-modal-footer">
              <div className="simple-modal-price">
                S/ {Number(activePack.price ?? 0).toFixed(2)}
              </div>
              <button
                className={`btn btn-primary ${
                  activePack.available <= 0 ? "btn-disabled" : ""
                }`}
                onClick={() => handleAddPackToCart(activePack)}
                type="button"
                disabled={activePack.available <= 0}
                title={
                  activePack.available <= 0
                    ? "Sin stock disponible"
                    : "Agregar pack al carrito"
                }
              >
                + Agregar Pack
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="libros-topbar">
        <div className="libros-topbar-inner">
          <div className="libros-search">
            <span className="libros-search-icon">🔎</span>
            <input
              className="libros-search-input"
              value={q}
              onChange={(e) => {
                setPage(1);
                setQ(e.target.value);
              }}
              placeholder={
                mode === "books"
                  ? "Buscar por título, editorial o código..."
                  : "Buscar packs o códigos..."
              }
            />
          </div>

          <a href={cartHref} className="libros-cart-btn">
            <span>🛒 Carrito</span>
            <span className="libros-cart-badge">{hasUser ? cartCount : 0}</span>
          </a>
        </div>

        <div className="libros-tabs">
          <button
            className={`libros-tab ${mode === "books" ? "active" : ""}`}
            type="button"
            onClick={() => {
              setMode("books");
              setPage(1);
            }}
          >
            Libros
          </button>
          <button
            className={`libros-tab ${mode === "packs" ? "active" : ""}`}
            type="button"
            onClick={() => {
              setMode("packs");
              setPage(1);
              setEditorial("Todas");
              setYear("Todos");
            }}
          >
            Packs
          </button>
        </div>
      </div>

      {/* Toolbar solo libros */}
      {mode === "books" && (
        <div className="catalog-toolbar" style={{ marginTop: 0 }}>
          <div>
            <div className="catalog-label">Editorial</div>
            <select
              className="catalog-select"
              value={editorial}
              onChange={(e) => {
                setPage(1);
                setEditorial(e.target.value);
              }}
            >
              {editoriales.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>

          <div className="catalog-filters">
            <div>
              <div className="catalog-label">Año</div>
              <select
                className="catalog-select"
                value={year}
                onChange={(e) => {
                  setPage(1);
                  setYear(e.target.value);
                }}
              >
                {years.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>

            <button className="catalog-reset" onClick={resetFiltersAndCart} type="button">
              Limpiar
            </button>
          </div>
        </div>
      )}

      {/* Toolbar packs */}
      {mode === "packs" && (
        <div
          className="catalog-toolbar"
          style={{ marginTop: 0, gridTemplateColumns: "1fr" as any }}
        >
          <div className="catalog-filters" style={{ gridTemplateColumns: "1fr" as any }}>
            <button className="catalog-reset" onClick={resetFiltersAndCart} type="button">
              Limpiar
            </button>
          </div>
        </div>
      )}

      <div className="catalog-meta">
        Mostrando {showingFrom}-{showingTo} de {totalCount}
        {loading && !showSkeleton ? <span className="catalog-updating"> · Actualizando...</span> : null}
      </div>

      {error && <div className="catalog-error">{error}</div>}

      <div className="catalog-grid">
        {showSkeleton
          ? Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="catalog-card" style={{ opacity: 0.6 }}>
                <div className="catalog-cover" />
                <div className="catalog-body">
                  <div className="catalog-title">Cargando...</div>
                </div>
              </div>
            ))
          : mode === "books"
          ? books.map((b) => {
              const available = Number(b.available ?? 0);
              const out = available <= 0;

              return (
                <div key={b.id} className="catalog-card">
                  <div className="catalog-cover">
                    <img
                      src={b.foto_url || "/images/placeholders/book-cover.png"}
                      alt={b.descripcion}
                      loading="lazy"
                    />
                  </div>

                  <div className="catalog-body">
                    <div className="catalog-title">{b.descripcion}</div>

                    <div className="catalog-chips">
                      {b.editorial && <span className="chip">{b.editorial}</span>}
                      {b.anio_publicacion && (
                        <span className="chip chip-soft">{b.anio_publicacion}</span>
                      )}
                      {b.codigo_venta && (
                        <span className="chip chip-soft">{b.codigo_venta}</span>
                      )}
                      <span
                        className={`chip chip-soft ${
                          out ? "chip-out" : "chip-available"
                        }`}
                      >
                        {out ? "Agotado" : `Disponible: ${available}`}
                      </span>
                    </div>

                    <div className="catalog-price">
                      S/ {Number(b.price ?? 0).toFixed(2)}
                    </div>

                    <div className="catalog-actions">
                      <button
                        className={`btn btn-primary ${out ? "btn-disabled" : ""}`}
                        onClick={() => handleAddBookToCart(b)}
                        type="button"
                        disabled={out}
                        title={out ? "Sin stock disponible" : "Agregar al carrito"}
                      >
                        + Agregar
                      </button>

                      <a className="btn btn-ghost" href={`/libros/${b.id}`}>
                        Ver
                      </a>
                    </div>
                  </div>
                </div>
              );
            })
          : packs.map((p) => {
              const available = Number(p.available ?? 0);
              const out = available <= 0;

              return (
                <div key={p.id} className="catalog-card">
                  <div className="catalog-cover">
                    <img
                      src={p.cover_url || "/images/placeholders/book-cover.png"}
                      alt={p.nombre}
                      loading="lazy"
                    />
                  </div>

                  <div className="catalog-body">
                    <div className="catalog-title">{p.nombre}</div>

                    <div className="catalog-chips">
                      {p.codigo_venta && (
                        <span className="chip chip-soft">{p.codigo_venta}</span>
                      )}
                      <span className="chip chip-soft">
                        Incluye: {p.items.length} item{p.items.length === 1 ? "" : "s"}
                      </span>

                      <span
                        className={`chip chip-soft ${
                          out ? "chip-out" : "chip-available"
                        }`}
                      >
                        {out ? "Agotado" : `Disponible: ${available}`}
                      </span>
                    </div>

                    <div className="catalog-price">
                      S/ {Number(p.price ?? 0).toFixed(2)}
                    </div>

                    <div className="catalog-actions">
                      <button
                        className={`btn btn-primary ${out ? "btn-disabled" : ""}`}
                        onClick={() => handleAddPackToCart(p)}
                        type="button"
                        disabled={out}
                        title={out ? "Sin stock disponible" : "Agregar pack al carrito"}
                      >
                        + Agregar
                      </button>

                      <button
                        className="btn btn-ghost"
                        type="button"
                        onClick={() => openPackModal(p)}
                      >
                        Ver
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
      </div>

      {totalPages > 1 && (
        <div className="catalog-pagination">
          <button
            className="catalog-reset"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            type="button"
          >
            Anterior
          </button>

          <div>
            Página {page} / {totalPages}
          </div>

          <button
            className="catalog-reset"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            type="button"
          >
            Siguiente
          </button>
        </div>
      )}
    </div>
  );
}
