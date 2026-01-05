import Link from "next/link";
import {
  GraduationCap,
  Truck,
  HeartHandshake,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";
import "./about.css";

export default function About() {
  return (
    <section className="aboutSection aboutReverse" id="nosotros" aria-label="Quiénes somos">
      <div className="aboutWrap">
        <div className="aboutGrid">
          {/* Left: Image */}
          <div className="aboutRight" aria-hidden="true">
            <div className="aboutImageCard">
              <img className="aboutImage" src="/images/about/nosotros.png" alt="" />
              <div className="aboutGlow" />
            </div>
          </div>

          {/* Right: Content */}
          <div className="aboutLeft">
            <span className="aboutKicker">PRG DINAMICS</span>
            <h2 className="aboutTitle">Quiénes somos</h2>

            <p className="aboutText">
              En <strong>PRG Dinamics</strong> desarrollamos y distribuimos
              materiales educativos para instituciones escolares. Trabajamos con
              enfoque pedagógico, producción cuidada y una operación ordenada que
              asegura entregas confiables durante el año académico.
            </p>

            <p className="aboutText">
              Acompañamos a colegios, docentes y familias con{" "}
              <strong>packs</strong>, <strong>catálogos</strong> y procesos de{" "}
              <strong>gestión</strong> pensados para simplificar la
              implementación: desde la selección del material hasta la logística
              y seguimiento.
            </p>

            <div className="aboutFeatures">
              <div className="aboutFeature">
                <span className="aboutIcon">
                  <GraduationCap size={18} />
                </span>
                <div className="aboutFeatureText">
                  <strong>Calidad editorial</strong>
                  <span>Material alineado a objetivos educativos.</span>
                </div>
              </div>

              <div className="aboutFeature">
                <span className="aboutIcon">
                  <Truck size={18} />
                </span>
                <div className="aboutFeatureText">
                  <strong>Logística con control</strong>
                  <span>Distribución ordenada y entregas confiables.</span>
                </div>
              </div>

              <div className="aboutFeature">
                <span className="aboutIcon">
                  <HeartHandshake size={18} />
                </span>
                <div className="aboutFeatureText">
                  <strong>Soporte cercano</strong>
                  <span>Atención rápida para colegios y campañas.</span>
                </div>
              </div>
            </div>

            <div className="aboutPills">
              <span className="aboutPill">
                <CheckCircle2 size={16} /> Packs por aula/alumno
              </span>
              <span className="aboutPill">
                <CheckCircle2 size={16} /> Seguimiento de campaña
              </span>
              <span className="aboutPill">
                <CheckCircle2 size={16} /> Catálogo por nivel
              </span>
            </div>

            <div className="aboutActions">
              <Link className="aboutBtnPrimary" href="/nosotros">
                Conoce más <ArrowRight size={18} />
              </Link>
              <Link className="aboutBtnSecondary" href="/contacto">
                Contáctanos
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
