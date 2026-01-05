import "./hero.css";
import Link from "next/link";

export default function Hero() {
  return (
    <section className="hero">
      <div className="hero-inner hero-inner--center fade-in">
        <img
          src="/images/logos/de-logo-white.png"
          className="hero-logo hero-logo--center"
          alt="PRG Dinamics logo"
          loading="eager"
        />

        <div className="hero-content hero-content--center">
          <h1 className="hero-title">
            Soluciones editoriales
            <br />
            para instituciones educativas
          </h1>

          <p className="hero-subtitle">
            Materiales educativos diseñados con calidad, confianza y compromiso.
          </p>

          <div className="hero-buttons hero-buttons--center">
            <Link href="/libros" className="hero-btn hero-btn--primary">
              Ver libros
            </Link>
            <Link href="/colegios" className="hero-btn hero-btn--secondary">
              Servicios
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
