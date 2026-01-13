"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import "./Navbar.css";

type NavItem = { href: string; label: string };

export default function Navbar() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  const links: NavItem[] = useMemo(
    () => [
      { href: "/", label: "Inicio" },
      { href: "/nosotros", label: "Quiénes somos" },
      { href: "/libros", label: "Libros" },
      { href: "https://colegios.dynamiceducationperu.com", label: "Colegios" },
      { href: "/contacto", label: "Contacto" },
      { href: "https://reclamovirtual.pe/libros/31cbc750-fc7d-4a13-bf6a-09a314e81979/Canalvirtual", label: "Libro de Reclamaciones" },
    ],
    []
  );

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 50);
    handler();
    window.addEventListener("scroll", handler);
    return () => window.removeEventListener("scroll", handler);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname?.startsWith(href);

  return (
    <>
      <nav className={`navbar ${scrolled ? "scrolled" : ""}`}>
        <div className="nav-container">
          {/* Desktop: SOLO texto */}
          <Link href="/" className="logo" aria-label="PRG Dinamics home">
            PRG Dinamics
          </Link>

          {/* Desktop links */}
          <div className="nav-links" aria-label="Primary navigation">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={`nav-link ${isActive(l.href) ? "active" : ""}`}
              >
                {l.label}
              </Link>
            ))}
          </div>

          {/* Mobile toggle: icono lucide */}
          <button
            className={`nav-burger ${open ? "open" : ""}`}
            type="button"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </nav>

      {/* Mobile radial menu layer */}
      <div className={`nav-mobile ${open ? "open" : ""}`} aria-hidden={!open}>
        <button
          className="nav-backdrop"
          aria-label="Close menu backdrop"
          onClick={() => setOpen(false)}
        />

        <div className="nav-mobile-card" role="dialog" aria-label="Mobile menu">
          <div className="nav-mobile-header">
            {/* Mobile: LOGO SOLO EN POPUP */}
            <div className="nav-mobile-brand">
              <img
                className="nav-mobile-logo"
                src="/images/logos/de-logo-white.png"
                alt="PRG Dinamics"
              />
            </div>

            <button
              className="nav-close"
              onClick={() => setOpen(false)}
              aria-label="Close menu"
              type="button"
            >
              <X size={18} />
            </button>
          </div>

          <div className="nav-mobile-links">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={`nav-mobile-link ${isActive(l.href) ? "active" : ""}`}
              >
                {l.label}
              </Link>
            ))}
          </div>

        </div>
      </div>
    </>
  );
}
