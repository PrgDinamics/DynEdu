import "./about.css";
import Link from "next/link";

export default function About() {
  return (
    <section className="about fade-in-up">

  <div className="about-image">
    <img src="/images/web/about-us.png" alt="Sobre nosotros" />
  </div>

  <div className="about-content">
    <h2 className="about-title">Quiénes somos</h2>

    <p>
      En <strong>PRG Dinamics</strong> nos dedicamos a proveer materiales
      educativos...
    </p>

    <p>
      Nuestro compromiso es brindar...
    </p>

    <Link href="/nosotros" className="about-btn">
      Conoce más sobre nosotros
    </Link>
  </div>

</section>

  );
}
