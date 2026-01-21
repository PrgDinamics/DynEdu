"use client";

import "./dyneduLogin.css";
import Image from "next/image";
import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Eye, EyeOff, Lock, LogIn, User, MessageCircle } from "lucide-react";

import { loginWithUsername } from "./actions";

const LOGO_SRC = "/images/logos/de-logo-white.png";
const DEFAULT_WHATSAPP = "51999999999";

export default function DyneduLogin() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const whatsappNumber = useMemo(() => DEFAULT_WHATSAPP, []);

  const whatsappHref = useMemo(() => {
    const text = encodeURIComponent(
      `Hola, necesito acceso a la Intranet DynEdu.\n\nEmail: ${email || "(aún no ingresado)"}\nMotivo: Solicitar/recuperar acceso.`
    );
    return `https://wa.me/${whatsappNumber}?text=${text}`;
  }, [whatsappNumber, email]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim()) return setError("Ingresa tu email.");
    if (!password.trim()) return setError("Ingresa tu contraseña.");

    setLoading(true);
    try {
      // Mantengo la firma { username, password } para no romper tu action import
      const res = await loginWithUsername({ username: email, password });

      if (res.ok === false) {
        setError(res.error);
        return;
      }

      router.push("/dynedu/actividad");
    } catch {
      setError("Credenciales inválidas o no tienes acceso.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dyWrap">
      <div className="dyGlow dyGlowA" />
      <div className="dyGlow dyGlowB" />

      <div className="dyCard">
        <div className="dyCardInner">
          <div className="dyBrand">
            <Image
              src={LOGO_SRC}
              alt="DynEdu"
              width={88}
              height={88}
              priority
              className="dyLogo"
            />
          </div>

          <h1 className="dyTitle">Intranet DynEdu</h1>
          <p className="dySubtitle">
            Ingresa tu <b>email</b> y tu <b>contraseña</b> para acceder al panel.
          </p>

          <form onSubmit={handleSubmit} className="dyForm">
            <div className="dyField">
              <label className="dyLabel">Email</label>
              <div className="dyInputWrap">
                <span className="dyIcon" aria-hidden="true">
                  <User size={18} />
                </span>

                <input
                  className="dyInput"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="username@correo.com"
                  type="text"
                  autoComplete="email"
                />
              </div>
            </div>

            <div className="dyField">
              <label className="dyLabel">Contraseña</label>
              <div className="dyInputWrap">
                <span className="dyIcon" aria-hidden="true">
                  <Lock size={18} />
                </span>

                <input
                  className="dyInput"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  type={showPass ? "text" : "password"}
                  autoComplete="current-password"
                />

                <button
                  type="button"
                  className="dyEye"
                  onClick={() => setShowPass((v) => !v)}
                  aria-label={showPass ? "Ocultar contraseña" : "Mostrar contraseña"}
                >
                  {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {error && <div className="dyError">{error}</div>}

            <button className="dyPrimary" type="submit" disabled={loading}>
            
              <span>{loading ? "Validando..." : "Ingresar"}</span>
                <span className="dyPrimaryIcon" aria-hidden="true">
                <LogIn size={18} />
              </span>
            </button>

            <a className="dySecondary" href={whatsappHref} target="_blank" rel="noreferrer">
              <MessageCircle size={18} />
              Solicitar acceso
            </a>

            <div className="dyFooterNote">PRG Dinamics • Dynamic Education</div>
          </form>
        </div>
      </div>
    </div>
  );
}
