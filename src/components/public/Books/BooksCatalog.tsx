import "./books.css";
import Link from "next/link";

type BookItem = {
  id: string | number;
  descripcion: string;
  editorial?: string | null;
  autor?: string | null;
  anio_publicacion?: number | null;
  edicion?: string | null;
  foto_url?: string | null;
};

export default function BooksCatalog({ items }: { items: BookItem[] }) {
  return (
    <section className="books">
      <div className="books-inner fade-in-up">
        <div className="books-head">
          <div>
            <div className="books-kicker">Catálogo completo</div>
            <h1 className="books-title">Libros disponibles</h1>
            <p className="books-subtitle">
              Catálogo para campañas escolares. Si eres un colegio, podemos armar packs por grado y coordinar entrega.
            </p>
          </div>

          <div className="books-actions">
            <Link href="/contacto" className="books-btn books-btn--primary">
              Solicitar campaña
            </Link>
            <Link href="/" className="books-btn books-btn--ghost">
              Volver al inicio
            </Link>
          </div>
        </div>

        <div className="books-grid">
          {items.map((b) => (
            <article key={b.id} className="book-card fade-in-up">
              <div className="book-cover">
                <img
                  src={b.foto_url || "/images/web/book-sample.jpg"}
                  alt={b.descripcion}
                  loading="lazy"
                />
              </div>

              <div className="book-body">
                <h3 className="book-title">{b.descripcion}</h3>

                <div className="book-meta">
                  {b.editorial ? <span className="chip">{b.editorial}</span> : null}
                  {b.anio_publicacion ? <span className="chip">{b.anio_publicacion}</span> : null}
                  {b.edicion ? <span className="chip">{b.edicion}</span> : null}
                </div>

                <p className="book-desc">
                  {b.autor ? `Autor: ${b.autor}. ` : ""}
                  Disponible por campaña.
                </p>

                <div className="book-cta">
                  <Link
                    href={`/contacto?book=${encodeURIComponent(b.descripcion)}`}
                    className="book-link"
                  >
                    Solicitar cotización
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>

        {items.length === 0 ? (
          <div style={{ marginTop: 18, opacity: 0.85 }}>
            No hay libros cargados todavía.
          </div>
        ) : null}
      </div>
    </section>
  );
}
