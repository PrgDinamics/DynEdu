import "./nosotros.css";
import Link from "next/link";

export default function Page() {
  return (
    <main className="aboutPage">
      <section className="aboutHero fade-in-up">
        <div className="aboutHeroInner">
          <div className="aboutHeroContent">
            <div className="kicker">PRG Dinamics</div>
            <h1>Educación con orden, calidad y compromiso</h1>

            <p>
              Somos un equipo enfocado en el desarrollo y distribución de materiales educativos
              para instituciones escolares. Nuestro objetivo es que colegios y familias tengan
              una experiencia clara: selección simple, packs ordenados, entregas confiables y
              seguimiento durante el año académico.
            </p>

            <div className="heroBadges">
              <span className="badge">Catálogo escolar</span>
              <span className="badge">Packs</span>
              <span className="badge">Distribución</span>
              <span className="badge">Seguimiento</span>
            </div>

            <div className="heroActions">
              <Link href="/contacto" className="btnPrimary">
                Contáctanos
              </Link>
              <Link href="/libros" className="btnGhost">
                Ver libros
              </Link>
            </div>
          </div>

          <div className="aboutHeroMedia">
            <img src="/images/web/about-us.png" alt="Sobre PRG Dinamics" loading="lazy" />
          </div>
        </div>
      </section>

      <section className="aboutSection">
        <div className="container">
          <div className="grid2">
            <div className="card">
              <h2>Misión</h2>
              <p>
                Brindar soluciones editoriales y materiales educativos que faciliten el trabajo
                de las instituciones escolares, combinando calidad pedagógica, producción cuidada
                y una logística confiable.
              </p>
            </div>

            <div className="card">
              <h2>Visión</h2>
              <p>
                Ser un aliado estratégico para colegios y familias, consolidándonos como una opción
                reconocida por la organización, el acompañamiento y la experiencia de servicio.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="aboutSection alt">
        <div className="container">
          <h2 className="sectionTitle">Cómo trabajamos</h2>

          <div className="steps">
            <div className="step card">
              <div className="stepNum">1</div>
              <h3>Selección del material</h3>
              <p>Apoyamos en la elección de libros y recursos según el enfoque de cada institución.</p>
            </div>

            <div className="step card">
              <div className="stepNum">2</div>
              <h3>Packs y organización</h3>
              <p>Armamos packs claros por grado/curso, con control y trazabilidad.</p>
            </div>

            <div className="step card">
              <div className="stepNum">3</div>
              <h3>Distribución y seguimiento</h3>
              <p>Entregas coordinadas y soporte para asegurar una implementación sin fricciones.</p>
            </div>
          </div>

          <div className="cta card">
            <div>
              <h3>¿Eres un colegio y quieres coordinar tu campaña?</h3>
              <p>
                Escríbenos y te ayudamos a organizar el catálogo, los packs y el cronograma de entrega.
              </p>
            </div>
            <Link href="/contacto" className="btnPrimary">
              Hablar con PRG Dinamics
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
