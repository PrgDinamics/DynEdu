"use client";

import "./dyneduLogin.css";
import Image from "next/image";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Mail, Lock, Eye, EyeOff, LogIn, MessageCircle, ArrowRight } from "lucide-react";

const LOGO_SRC = "/images/logos/de-logo-white.png";
const DEFAULT_WHATSAPP = "51999999999";

export default function DyneduLogin() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const whatsappNumber =
    process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP || DEFAULT_WHATSAPP;

  const whatsappHref = useMemo(() => {
    const text = encodeURIComponent(
      `Hola, necesito acceso a la Intranet DynEdu.\n\nCorreo: ${email || "(aún no ingresado)"}\nMotivo: Solicitar/recuperar acceso.`
    );
    return `https://wa.me/${whatsappNumber}?text=${text}`;
  }, [whatsappNumber, email]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim()) return setError("Ingresa tu correo institucional.");
    if (!password.trim()) return setError("Ingresa tu contraseña.");

    setLoading(true);
    try {
      /**
       * ✅ Aquí conectas tu login real (Supabase Auth / API).
       * Ejemplo:
       *  await signInWithPassword({ email, password })
       *  router.push("/dynedu/actividad")
       */
      await new Promise((r) => setTimeout(r, 450)); // mock visual

      // Ajusta el destino real del panel:
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
          <div className="dyTop">
            <div className="dyBrand">
              <Image
                src={LOGO_SRC}
                alt="Dynamic Education"
                width={220}
                height={90}
                priority
                className="dyLogo"
              />
            </div>

            <div className="dyHeaderText">
              <h1 className="dyTitle">Intranet DynEdu</h1>
              <p className="dySubtitle">Accede al panel de campaña académica</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="dyForm">
            <div className="dyField">
              <label className="dyLabel">Correo institucional *</label>
              <div className="dyInputWrap">
                <span className="dyIcon">
                  <Mail size={18} />
                </span>
                <input
                  className="dyInput"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@colegio.com"
                  type="email"
                  autoComplete="email"
                />
              </div>
            </div>

            <div className="dyField">
              <label className="dyLabel">Contraseña *</label>
              <div className="dyInputWrap">
                <span className="dyIcon">
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
              <span className="dyPrimaryIcon">
                <LogIn size={18} />
              </span>
              <span>{loading ? "Validando..." : "Ingresar"}</span>
              <span className="dyPrimaryArrow">
                <ArrowRight size={18} />
              </span>
            </button>

            <div className="dyRow">
              <span className="dyRowText">¿No tienes acceso?</span>
              <a className="dyLinkBtn" href={whatsappHref} target="_blank" rel="noreferrer">
                <MessageCircle size={16} />
                Solicitar acceso
              </a>
            </div>

            <div className="dyFooterNote">PRG Dinamics • Dynamic Education</div>
          </form>
        </div>
      </div>
    </div>
  );
}
