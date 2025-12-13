import "./books.css";
import Link from "next/link";

export default function Books() {
  return (
    <section className="books-section fade-in-up">
      <h2 className="books-title">Nuestros libros</h2>

      <div className="books-grid">

        {/* Card 1 */}
        <div className="book-card fade-in-up delay-1">
          <div className="book-image">
            <img src="/images/web/book-sample.jpg" alt="Libro 1" />
          </div>
          <h3>Título del libro</h3>
          <p>
            Breve descripción del libro. Un resumen del contenido o área educativa al que pertenece.
          </p>
          <Link href="/contacto" className="book-btn">
            Solicitar cotización
          </Link>
        </div>

        {/* Card 2 */}
        <div className="book-card fade-in-up delay-2">
          <div className="book-image">
            <img src="/images/web/book-sample.jpg" alt="Libro 2" />
          </div>
          <h3>Título del libro</h3>
          <p>
            Breve descripción del libro. Un resumen del contenido o área educativa al que pertenece.
          </p>
          <Link href="/contacto" className="book-btn">
            Solicitar cotización
          </Link>
        </div>

        {/* Card 3 */}
        <div className="book-card fade-in-up delay-3">
          <div className="book-image">
            <img src="/images/web/book-sample.jpg" alt="Libro 3" />
          </div>
          <h3>Título del libro</h3>
          <p>
            Breve descripción del libro. Un resumen del contenido o área educativa al que pertenece.
          </p>
          <Link href="/contacto" className="book-btn">
            Solicitar cotización
          </Link>
        </div>

      </div>

      <div className="books-more fade-in-up delay-4">
        <Link href="/libros" className="books-more-btn">
          Ver todos los libros
        </Link>
      </div>
    </section>
  );
}
