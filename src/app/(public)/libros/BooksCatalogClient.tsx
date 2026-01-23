"use client";

import { useEffect, useMemo, useState } from "react";
import "./BooksCatalogClient.css";

import { createSupabaseBrowserClient } from "@/lib/supabaseBrowserClient";

import {
  addToCart,
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
  available: number; // ✅ now comes from VIEW
};

const PAGE_SIZE = 9;

// ---- Pricing helpers ----
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

// ---- Stock helpers (VIEW) ----
async function getStockAvailableMap(
  supabase: any,
  productIds: number[]
): Promise<Map<number, number>> {
  const map = new Map<number, number>();
  if (productIds.length === 0) return map;

  // ✅ read computed available from view
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

  const [books, setBooks] = useState<BookView[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const [q, setQ] = useState("");
  const [editorial, setEditorial] = useState("Todas");
  const [year, setYear] = useState("Todos");
  const [page, setPage] = useState(1);

  const [error, setError] = useState<string | null>(null);

  const [userReady, setUserReady] = useState(false);
  const [hasUser, setHasUser] = useState(false);

  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [cartCount, setCartCount] = useState(0);

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

  const totalPages = useMemo(() => Math.max(1, Math.ceil(totalCount / PAGE_SIZE)), [totalCount]);

  const fetchBooks = async () => {
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

      const rows = (data ?? []) as BookRow[];
      setTotalCount(count || 0);

      const ids = rows.map((r) => Number(r.id));

      const priceListId = await getDefaultPriceListId(supabase);
      const pricesMap = priceListId
        ? await getPricesMap(supabase, priceListId, ids)
        : new Map<number, number>();

      // ✅ stock from view
      const stockMap = await getStockAvailableMap(supabase, ids);

      const view: BookView[] = rows.map((r) => ({
        ...r,
        price: pricesMap.get(Number(r.id)) ?? 0,
        available: stockMap.get(Number(r.id)) ?? 0,
      }));

      setBooks(view);
    } catch (e: any) {
      setBooks([]);
      setTotalCount(0);
      setError(e?.message || "Ocurrió un error al cargar los libros.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBooks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, editorial, year, page]);

  const resetFiltersAndCart = () => {
    setQ("");
    setEditorial("Todas");
    setYear("Todos");
    setPage(1);
    clearCart();
  };

  const handleAddToCart = async (book: BookView) => {
    if (!userReady) return;

    if (!hasUser) {
      setAuthModalOpen(true);
      return;
    }

    if ((book.available ?? 0) <= 0) return;

    addToCart(book.id, 1);
  };

  const cartHref = hasUser ? "/carrito" : `/auth/login?next=${encodeURIComponent("/carrito")}`;

  return (
    <div className="catalog">
      <AuthRequiredModal
        open={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        message="Regístrate o inicia sesión para agregar items al carrito."
        nextPath="/libros"
      />

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
              placeholder="Buscar por título, editorial o código..."
            />
          </div>

          <a href={cartHref} className="libros-cart-btn">
            <span>🛒 Carrito</span>
            <span className="libros-cart-badge">{hasUser ? cartCount : 0}</span>
          </a>
        </div>
      </div>

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

      <div className="catalog-meta">
        Mostrando {books.length ? (page - 1) * PAGE_SIZE + 1 : 0}-
        {Math.min(page * PAGE_SIZE, totalCount)} de {totalCount}
      </div>

      {error && <div className="catalog-error">{error}</div>}

      <div className="catalog-grid">
        {loading
          ? Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="catalog-card" style={{ opacity: 0.6 }}>
                <div className="catalog-cover" />
                <div className="catalog-body">
                  <div className="catalog-title">Cargando...</div>
                </div>
              </div>
            ))
          : books.map((b) => {
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
                      {b.anio_publicacion && <span className="chip chip-soft">{b.anio_publicacion}</span>}
                      {b.codigo_venta && <span className="chip chip-soft">{b.codigo_venta}</span>}

                      <span className={`chip chip-soft ${out ? "chip-out" : "chip-available"}`}>
                        {out ? "Agotado" : `Disponible: ${available}`}
                      </span>
                    </div>

                    <div className="catalog-price">S/ {Number(b.price ?? 0).toFixed(2)}</div>

                    <div className="catalog-actions">
                      <button
                        className={`btn btn-primary ${out ? "btn-disabled" : ""}`}
                        onClick={() => handleAddToCart(b)}
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
