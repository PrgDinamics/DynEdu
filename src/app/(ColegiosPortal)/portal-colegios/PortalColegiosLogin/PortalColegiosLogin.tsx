"use client";

import "./portalColegiosLogin.css";
import Image from "next/image";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  KeyRound,
  Eye,
  EyeOff,
  LogIn,
  MessageCircle,
  ArrowRight,
} from "lucide-react";

import { loginColegioAction } from "../actions";

const LOGO_SRC = "/images/logos/de-logo-white.png";
const DEFAULT_WHATSAPP = "51999999999";

export default function PortalColegiosLogin() {
  const router = useRouter();

  const [ruc, setRuc] = useState("");
  const [code, setCode] = useState("");
  const [showCode, setShowCode] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [isPending, startTransition] = useTransition();

  const whatsappNumber =
    process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP || DEFAULT_WHATSAPP;

  const whatsappHref = useMemo(() => {
    const text = encodeURIComponent(
      `Hola, necesito acceso al Portal de Colegios (DynEdu).\n\nRUC: ${
        ruc || "(aún no ingresado)"
      }\nMotivo: Solicitar/recuperar código de acceso.`
    );
    return `https://wa.me/${whatsappNumber}?text=${text}`;
  }, [whatsappNumber, ruc]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanRuc = ruc.replace(/\D/g, "");

    if (cleanRuc.length !== 11) {
      setError("El RUC debe tener 11 dígitos.");
      return;
    }
    if (!code.trim()) {
      setError("Ingresa tu código de acceso.");
      return;
    }

    startTransition(async () => {
      const res = await loginColegioAction({
        ruc: cleanRuc,
        accessKey: code.trim(),
      });

      if (!res.success) {
        setError(res.error || "No se pudo validar el acceso.");
        return;
      }

      // ✅ Cookie ya quedó seteada en el server action
      // Refresh para que server components lean cookie, luego push
      router.refresh();
      router.push("/portal-colegios/consignacion");
    });
  };

  return (
    <div className="pcWrap">
      <div className="pcGlow pcGlowA" />
      <div className="pcGlow pcGlowB" />

      <div className="pcCard">
        <div className="pcCardInner">
          <div className="pcBrand">
            <Image
              src={LOGO_SRC}
              alt="Dynamic Education"
              width={210}
              height={88}
              priority
              className="pcLogo"
            />
          </div>

          <h1 className="pcTitle">Portal de colegios</h1>
          <p className="pcSubtitle">
            Ingresa el RUC del colegio y tu <b>código de acceso</b> para registrar
            consignaciones.
          </p>

          <form onSubmit={handleSubmit} className="pcForm">
            <div className="pcField">
              <label className="pcLabel">RUC del colegio</label>
              <div className="pcInputWrap">
                <span className="pcIcon">
                  <Building2 size={18} />
                </span>

                <input
                  className="pcInput"
                  value={ruc}
                  onChange={(e) => setRuc(e.target.value)}
                  inputMode="numeric"
                  placeholder="Ej: 20123456789"
                  aria-label="RUC del colegio"
                />
              </div>
            </div>

            <div className="pcField">
              <label className="pcLabel">Código de acceso</label>
              <div className="pcInputWrap">
                <span className="pcIcon">
                  <KeyRound size={18} />
                </span>

                <input
                  className="pcInput"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  type={showCode ? "text" : "password"}
                  placeholder="Tu código"
                  aria-label="Código de acceso"
                />

                <button
                  type="button"
                  className="pcEye"
                  onClick={() => setShowCode((v) => !v)}
                  aria-label={showCode ? "Ocultar código" : "Mostrar código"}
                >
                  {showCode ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              <div className="pcHintRow">
                <span className="pcHintDot" />
                <span className="pcHint">
                  Si no tienes código, solicita acceso.
                </span>
              </div>
            </div>

            {error && <div className="pcError">{error}</div>}

            <button className="pcPrimary" type="submit" disabled={isPending}>

              <span>{isPending ? "Validando..." : "Ingresar"}</span>
                  <span className="pcPrimaryIcon">
                <LogIn size={18} />
              </span> 
            </button>

            <a
              className="pcSecondary"
              href={whatsappHref}
              target="_blank"
              rel="noreferrer"
            >
              <MessageCircle size={18} />
              Recuperar contraseña.
            </a>

            <div className="pcFooterNote">
              El acceso es validado por campaña (RUC + código).
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
