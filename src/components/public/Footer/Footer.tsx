import "./Footer.css";
import Link from "next/link";

export default function Footer() {
  return (
    <footer className="footer fade-in-up">
      
      <div className="footer-container">
        
        {/* LOGO + DESCRIPCIÓN */}
        <div className="footer-col">
          <img 
            src="/images/logos/de-logo-white.png" 
            alt="PRG Dinamics" 
            className="footer-logo"
          />
          <p className="footer-desc">
            Soluciones editoriales y recursos educativos para instituciones escolares.
          </p>
        </div>

        {/* LINKS RÁPIDOS */}
        <div className="footer-col">
          <h4>Enlaces</h4>
          <ul>
            <li><Link href="/">Inicio</Link></li>
            <li><Link href="/nosotros">Quiénes somos</Link></li>
            <li><Link href="/libros">Libros</Link></li>
            <li><Link href="/colegios">Colegios</Link></li>
            <li><Link href="/contacto">Contacto</Link></li>
          </ul>
        </div>

        {/* CONTACTO */}
        <div className="footer-col">
          <h4>Contacto</h4>
          <p>Email: contacto@prgdynamics.com</p>
          <p>Teléfono: +51 999 999 999</p>
          <p>Lima, Perú</p>
        </div>

      </div>

      <div className="footer-bottom">
        <p>© {new Date().getFullYear()} PRG Dinamics. Todos los derechos reservados.</p>
      </div>

    </footer>
  );
}
