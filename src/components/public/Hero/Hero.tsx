import "./hero.css";
import "./animations.css";
import Link from "next/link";

export default function Hero() {
  return (
    <section className="hero fade-in">
      <div className="hero-content">
        <img
          src="/images/logos/de-logo-white.png"
          className="hero-logo"
          alt="PRG Dinamics logo"
        />

        <h1>
          Soluciones editoriales
          <br />
          para instituciones educativas
        </h1>

        <p className="hero-subtitle">
          Materiales educativos diseñados con calidad, confianza y compromiso.
        </p>

        <div className="hero-buttons">
          <Link href="/libros" className="hero-btn primary">Ver libros</Link>
          <Link href="/colegios" className="hero-btn secondary">Servicios</Link>
        </div>
      </div>

      <div className="hero-image float">
        <img src="/images/web/hero-books.png" alt="books" />
      </div>
    </section>
  );
}
