"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Session } from "@supabase/supabase-js";
import {
  LogIn,
  LogOut,
  UserRound,
  Menu,
  X,
  ChevronRight,
  User,
  Package,
} from "lucide-react";
import "./Navbar.css";

import { createSupabaseBrowserClient } from "@/lib/supabaseBrowserClient";

const NAV_LINKS = [
  { href: "/", label: "Inicio" },
  { href: "/nosotros", label: "Quiénes somos" },
  { href: "/libros", label: "Libros" },
  { href: "https://colegios.dynamiceducationperu.com", label: "Colegios" },
  { href: "/contacto", label: "Contacto" },
];

export default function Navbar() {
  const pathname = usePathname() || "/";

  // ✅ SAME client across app
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const [session, setSession] = useState<Session | null>(null);
  const [sessionReady, setSessionReady] = useState(false);

  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // ✅ dropdown perfil
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let alive = true;

    const syncSession = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();

        if (!alive) return;

        if (!error) {
          setSession(data.session ?? null);
          setSessionReady(true);
          return;
        }

        const { data: u } = await supabase.auth.getUser();
        if (!alive) return;

        if (u?.user) {
          setSession((prev) => prev ?? null);
        } else {
          setSession(null);
        }

        setSessionReady(true);
      } catch {
        if (!alive) return;
        setSession(null);
        setSessionReady(true);
      }
    };

    syncSession();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s ?? null);
      setSessionReady(true);
    });

    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 6);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [mobileOpen]);

  useEffect(() => {
    setMobileOpen(false);
    setUserMenuOpen(false);
  }, [pathname]);

  // ✅ click afuera cierra dropdown
  useEffect(() => {
    if (!userMenuOpen) return;

    const onDown = (e: MouseEvent) => {
      const el = userMenuRef.current;
      if (!el) return;
      if (e.target instanceof Node && !el.contains(e.target)) {
        setUserMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [userMenuOpen]);

  const user = session?.user;
  const meta = (user?.user_metadata as any) || {};
  const firstName: string | undefined = meta.first_name || meta.firstName || meta.nombres;
  const email = user?.email || "";
  const label = firstName ? firstName : email;

  const next = pathname.startsWith("/auth") ? "/checkout" : pathname;

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const onLogout = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUserMenuOpen(false);
  };

  return (
    <>
      <nav className={`navbar ${scrolled ? "scrolled" : ""}`}>
        <div className="nav-container">
          <Link href="/" className="logo">
            PRG Dinamics
          </Link>

          <div className="nav-links">
            {NAV_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={`nav-link ${isActive(l.href) ? "active" : ""}`}
              >
                {l.label}
              </Link>
            ))}
          </div>

          <div className="nav-actions">
            {!sessionReady ? (
              <div style={{ width: 220, height: 36 }} />
            ) : !session ? (
              <Link className="nav-auth" href={`/auth/login?next=${encodeURIComponent(next)}`}>
                <LogIn size={18} />
                <span>Ingresar</span>
              </Link>
            ) : (
              <div className="nav-user" ref={userMenuRef}>
                <button
                  type="button"
                  className="nav-user-pill"
                  title={email}
                  onClick={() => setUserMenuOpen((v) => !v)}
                >
                  <UserRound size={18} />
                  <span>Bienvenido, {label}</span>
                </button>

                {userMenuOpen && (
                  <div className="nav-user-menu">
                    <Link
                      href="/perfil"
                      onClick={() => setUserMenuOpen(false)}
                      className="nav-user-menu-item"
                    >
                      <User size={16} />
                      <span>Perfil</span>
                    </Link>

                    <Link
                      href="/mis-compras"
                      onClick={() => setUserMenuOpen(false)}
                      className="nav-user-menu-item"
                    >
                      <Package size={16} />
                      <span>Mis compras</span>
                    </Link>

                    <button
                      type="button"
                      onClick={onLogout}
                      className="nav-user-menu-logout"
                    >
                      <LogOut size={16} />
                      <span>Cerrar sesión</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          <button
            className="nav-burger"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
            type="button"
          >
            <Menu size={20} />
          </button>
        </div>
      </nav>

      <div className={`nav-mobile ${mobileOpen ? "open" : ""}`}>
        <button
          className="nav-backdrop"
          onClick={() => setMobileOpen(false)}
          aria-label="Close menu"
          type="button"
        />

        <div className="nav-mobile-card" role="dialog" aria-modal="true">
          <div className="nav-mobile-header">
            <div className="nav-mobile-brand">
              <span className="nav-mobile-title">PRG Dinamics</span>
            </div>

            <button
              className="nav-close"
              onClick={() => setMobileOpen(false)}
              aria-label="Close"
              type="button"
            >
              <X size={18} />
            </button>
          </div>

          <div className="nav-mobile-links">
            {NAV_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={`nav-mobile-link ${isActive(l.href) ? "active" : ""}`}
              >
                <span>{l.label}</span>
                <ChevronRight size={18} />
              </Link>
            ))}

            <div className="nav-mobile-divider" />

            {!sessionReady ? (
              <div style={{ height: 44 }} />
            ) : !session ? (
              <Link className="nav-mobile-auth" href={`/auth/login?next=${encodeURIComponent(next)}`}>
                <LogIn size={18} />
                <span>Ingresar</span>
              </Link>
            ) : (
              <div className="nav-mobile-user">
                <div className="nav-user-pill" title={email}>
                  <UserRound size={18} />
                  <span>Bienvenido, {label}</span>
                </div>

                <Link className="nav-mobile-auth" href="/perfil">
                  <User size={18} />
                  <span>Perfil</span>
                </Link>

                <Link className="nav-mobile-auth" href="/mis-compras">
                  <Package size={18} />
                  <span>Mis compras</span>
                </Link>

                <button className="nav-mobile-logout" onClick={onLogout} type="button">
                  <LogOut size={18} />
                  <span>Cerrar sesión</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="nav-spacer" />
    </>
  );
}
