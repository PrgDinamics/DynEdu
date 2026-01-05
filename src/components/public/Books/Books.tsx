import Link from "next/link";
import {
  BookOpen,
  ClipboardList,
  Package,
  Truck,
  ArrowRight,
} from "lucide-react";
import "./books.css";

export default function Books() {
  return (
    <section className="booksSection" aria-label="Catálogo">
      <div className="booksWrap">
        <div className="booksHeader">
          <span className="booksBadge">CATÁLOGO</span>
          <h2 className="booksTitle">Libros para campañas escolares</h2>
          <p className="booksSubtitle">
            Somos distribuidora y trabajamos por campaña con instituciones
            educativas. Selecciona el material y nosotros coordinamos packs,
            entrega y seguimiento.
          </p>
        </div>

        <div className="booksGrid">
          {/* Left: Content */}
          <div className="booksContent">
            <div className="booksCard">
              <h3 className="booksCardTitle">Todo en un flujo simple</h3>
              <p className="booksCardText">
                Te ayudamos a armar el pedido ideal por grado/editorial,
                consolidamos el pack y programamos la logística para que la
                campaña salga ordenada.
              </p>

              <ul className="booksList">
                <li>
                  <span className="booksIcon">
                    <BookOpen size={18} />
                  </span>
                  Catálogos por nivel, editorial y campaña
                </li>
                <li>
                  <span className="booksIcon">
                    <Package size={18} />
                  </span>
                  Packs listos para entrega (por aula o por alumno)
                </li>
                <li>
                  <span className="booksIcon">
                    <Truck size={18} />
                  </span>
                  Entregas coordinadas + control de recepción
                </li>
                <li>
                  <span className="booksIcon">
                    <ClipboardList size={18} />
                  </span>
                  Seguimiento y reportes durante la campaña
                </li>
              </ul>

              <div className="booksActions">
                <Link className="booksBtnPrimary" href="/libros">
                  Ver catálogo <ArrowRight size={18} />
                </Link>

                <Link className="booksBtnSecondary" href="/contacto">
                  Solicitar campaña
                </Link>
              </div>
            </div>

            <div className="booksSteps">
              <div className="booksStep">
                <div className="booksStepNum">1</div>
                <div className="booksStepText">
                  <strong>Selección</strong>
                  <span>Material por grado/editorial</span>
                </div>
              </div>

              <div className="booksStep">
                <div className="booksStepNum">2</div>
                <div className="booksStepText">
                  <strong>Pack</strong>
                  <span>Armado y consolidación</span>
                </div>
              </div>

              <div className="booksStep">
                <div className="booksStepNum">3</div>
                <div className="booksStepText">
                  <strong>Entrega</strong>
                  <span>Logística y recepción</span>
                </div>
              </div>

              <div className="booksStep">
                <div className="booksStepNum">4</div>
                <div className="booksStepText">
                  <strong>Seguimiento</strong>
                  <span>Control y reportes</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Single Image */}
          <div className="booksImageCard" aria-hidden="true">
            {/* Cambia el src por tu imagen real si tu ruta es diferente */}
            <img
              className="booksImage"
              src="/images/books/books-stack.png"
              alt=""
            />
            <div className="booksImageGlow" />
          </div>
        </div>
      </div>
    </section>
  );
}
