"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import "./Navbar.css";

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", handler);
    return () => window.removeEventListener("scroll", handler);
  }, []);

  return (
    <nav className={`navbar ${scrolled ? "scrolled" : ""}`}>
      <div className="nav-container">
        <Link href="/" className="logo">PRG Dinamics</Link>

        <div className="nav-links">
          <Link href="/">Inicio</Link>
          <Link href="/nosotros">Quiénes somos</Link>
          <Link href="/libros">Libros</Link>
          <Link href="/colegios">Colegios</Link>
          <Link href="/contacto">Contacto</Link>
          <Link href="/dynedu">Dashboard</Link>
        </div>
      </div>
    </nav>
  );
}
