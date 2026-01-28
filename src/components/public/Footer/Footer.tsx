import "./Footer.css";
import Link from "next/link";

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-inner fade-in-up">
        <div className="footer-grid">
          {/* Brand */}
          <div className="footer-col footer-brand">
            <img
              src="/images/logos/de-logo-white.png"
              alt="PRG Dinamics"
              className="footer-logo"
              loading="lazy"
            />
            <p className="footer-desc">
              Soluciones editoriales y recursos educativos para instituciones escolares.
            </p>

            <div className="footer-social">
              <a className="footer-socialBtn" href="#" aria-label="LinkedIn">
                in
              </a>
              <a className="footer-socialBtn" href="#" aria-label="WhatsApp">
                wa
              </a>
              <a className="footer-socialBtn" href="#" aria-label="X">
                x
              </a>
            </div>
          </div>

          {/* Links */}
          <div className="footer-col">
            <h4 className="footer-title">Enlaces</h4>
            <ul className="footer-links">
              <li><Link href="/">Inicio</Link></li>
              <li><Link href="/nosotros">Quiénes somos</Link></li>
              <li><Link href="/libros">Libros</Link></li>
              <li><Link href="/colegios">Colegios</Link></li>
              <li><Link href="/contacto">Contacto</Link></li>
              <li><Link href="https://app.reclamovirtual.pe/libros/31cbc750-fc7d-4a13-bf6a-09a314e81979/Canalvirtual">Libro de Reclamaciones</Link></li>
              <li><Link href="/terminos-y-condiciones">Terminos y Condiciones</Link></li>

            </ul>
          </div>

          {/* Contact */}
          <div className="footer-col">
            <h4 className="footer-title">Contacto</h4>

            <div className="footer-contact">
              <div className="footer-contactItem">
                <span className="footer-dot" />
                <span>Email: contacto@prgdynamics.com</span>
              </div>

              <div className="footer-contactItem">
                <span className="footer-dot" />
                <span>Teléfono: +51 999 999 999</span>
              </div>

              <div className="footer-contactItem">
                <span className="footer-dot" />
                <span>Lima, Perú</span>
              </div>
            </div>
          </div>
        </div>

        <div className="footer-bottom">
          <p>© {new Date().getFullYear()} PRG Dinamics. Todos los derechos reservados.</p>
        </div>
      </div>
    </footer>
  );
}
