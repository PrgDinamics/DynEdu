"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import "./BookDetail.css";

type Book = {
  id: number;
  descripcion: string;
  autor: string | null;
  isbn: string | null;
  editorial: string | null;
  edicion: string | null;
  anio_publicacion: number | null;
  foto_url: string | null;
};

type Props = {
  book: Book;
  price: number | null;
};

type CartItem = Book & { quantity: number; price?: number | null };

const CART_KEY = "dynedu_cart";

function formatPEN(value: number) {
  return new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: "PEN",
    minimumFractionDigits: 2,
  }).format(value);
}

export default function BookDetailClient({ book, price }: Props) {
  const router = useRouter();

  const [qty, setQty] = useState(1);
  const [openSpecs, setOpenSpecs] = useState(true);
  const [cartCount, setCartCount] = useState(0);

  const coverSrc = useMemo(() => {
    return book.foto_url || "/images/placeholders/book-cover.png";
  }, [book.foto_url]);

  const refreshCartCount = () => {
    try {
      const raw = localStorage.getItem(CART_KEY);
      const items: CartItem[] = raw ? JSON.parse(raw) : [];
      const total = items.reduce((acc, it) => acc + (it.quantity ?? 0), 0);
      setCartCount(total);
    } catch {
      setCartCount(0);
    }
  };

  useEffect(() => {
    refreshCartCount();

    const onStorage = (e: StorageEvent) => {
      if (e.key === CART_KEY) refreshCartCount();
    };
    const onCustom = () => refreshCartCount();

    window.addEventListener("storage", onStorage);
    window.addEventListener("dynedu_cart_updated", onCustom);

    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("dynedu_cart_updated", onCustom);
    };
  }, []);

  const clampQty = (n: number) => Math.max(1, Math.min(99, n));

  const upsertCart = (redirectToCart?: boolean) => {
    try {
      const raw = localStorage.getItem(CART_KEY);
      const current: CartItem[] = raw ? JSON.parse(raw) : [];

      const idx = current.findIndex((it) => it.id === book.id);
      let next: CartItem[];

      if (idx >= 0) {
        next = current.map((it, i) =>
          i === idx ? { ...it, quantity: (it.quantity ?? 0) + qty, price } : it
        );
      } else {
        next = [...current, { ...book, quantity: qty, price }];
      }

      localStorage.setItem(CART_KEY, JSON.stringify(next));
      window.dispatchEvent(new Event("dynedu_cart_updated"));

      if (redirectToCart) router.push("/carrito");
    } catch {
      // noop
    }
  };

  const subtotal = useMemo(() => {
    if (price == null) return null;
    return price * qty;
  }, [price, qty]);

  return (
    <div className="bd-wrap">
      <div className="bd-top">
        <a className="bd-back" href="/libros">
          ← Volver
        </a>

        <a className="bd-cart" href="/carrito">
          <span className="bd-cart-ico">🛒</span>
          <span>Carrito</span>
          <span className="bd-cart-badge">{cartCount}</span>
        </a>
      </div>

      <div className="bd-grid">
        {/* LEFT: IMAGES */}
        <div className="bd-media">
          <div className="bd-cover">
            <img src={coverSrc} alt={book.descripcion} />
          </div>

          <div className="bd-thumbs">
            <button className="bd-thumb is-active" type="button">
              <img src={coverSrc} alt="thumb" />
            </button>
          </div>
        </div>

        {/* CENTER: INFO (sin descripción) */}
        <div className="bd-info">
          <h1 className="bd-title">{book.descripcion}</h1>
          <div className="bd-sub">{book.autor ? <>Más de {book.autor}</> : <span>—</span>}</div>

          <div className="bd-divider" />

          <button
            className="bd-accordion"
            onClick={() => setOpenSpecs((v) => !v)}
            type="button"
          >
            <span>Especificaciones</span>
            <span className={`bd-chevron ${openSpecs ? "open" : ""}`}>⌄</span>
          </button>

          {openSpecs && (
            <div className="bd-specs">
              <div className="bd-spec-row">
                <span>ISBN</span>
                <span>{book.isbn || "—"}</span>
              </div>
              <div className="bd-spec-row">
                <span>Autor(es)</span>
                <span>{book.autor || "—"}</span>
              </div>
              <div className="bd-spec-row">
                <span>Editorial</span>
                <span>{book.editorial || "—"}</span>
              </div>
              <div className="bd-spec-row">
                <span>Edición</span>
                <span>{book.edicion || "—"}</span>
              </div>
              <div className="bd-spec-row">
                <span>Año</span>
                <span>{book.anio_publicacion ?? "—"}</span>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT: BUY BOX (Agregar + Pagar) */}
        <aside className="bd-buy">
          <div className="bd-price">
            {price != null ? formatPEN(price) : "Precio: TBA"}
          </div>

          {subtotal != null && (
            <div className="bd-subtotal">
              Subtotal: <strong>{formatPEN(subtotal)}</strong>
            </div>
          )}

          <div className="bd-buy-row">
            <div className="bd-qty">
              <button type="button" onClick={() => setQty((q) => clampQty(q - 1))}>
                −
              </button>
              <input
                value={qty}
                onChange={(e) => setQty(clampQty(Number(e.target.value) || 1))}
                inputMode="numeric"
              />
              <button type="button" onClick={() => setQty((q) => clampQty(q + 1))}>
                +
              </button>
            </div>

            <button className="bd-add" type="button" onClick={() => upsertCart(false)}>
              Agregar al carrito
            </button>
          </div>

          <button className="bd-pay" type="button" onClick={() => upsertCart(true)}>
            Pagar ahora
          </button>

          <button className="bd-fav" type="button">
            ♡ Favoritos
          </button>

          <div className="bd-divider" />

          <a className="bd-help" href="/contacto">
            ¿Dónde puedo encontrar este producto?
          </a>
        </aside>
      </div>
    </div>
  );
}
