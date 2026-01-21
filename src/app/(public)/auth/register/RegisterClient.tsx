"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import "./auth.css";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Mail, Lock, UserPlus, LogIn, AlertCircle, CheckCircle2 } from "lucide-react";

type Props = {
  nextPath?: string;
};

export default function RegisterClient({ nextPath = "/checkout" }: Props) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const router = useRouter();
  const search = useSearchParams();

  const next = search.get("next") || nextPath;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [acceptTerms, setAcceptTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // modal
  const [successOpen, setSuccessOpen] = useState(false);
  const [successTitle, setSuccessTitle] = useState("Cuenta creada");
  const [successMsg, setSuccessMsg] = useState("Revisa tu correo para confirmar tu cuenta.");
  const [successActionLabel, setSuccessActionLabel] = useState("Ir a login");
  const [successAction, setSuccessAction] = useState<null | (() => void)>(null);

  const openSuccess = (opts: {
    title: string;
    msg: string;
    actionLabel: string;
    onAction: () => void;
  }) => {
    setSuccessTitle(opts.title);
    setSuccessMsg(opts.msg);
    setSuccessActionLabel(opts.actionLabel);
    setSuccessAction(() => opts.onAction);
    setSuccessOpen(true);
  };

  const validate = () => {
    if (!email.trim()) return "Email is required.";
    if (!password || password.length < 6) return "Password must be at least 6 characters.";
    if (!acceptTerms) return "You must accept the Terms & Conditions.";
    return null;
  };

  const onSubmit = async () => {
    const v = validate();
    if (v) {
      setError(v);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      });

      if (signUpError) throw signUpError;

      // Email confirmation ON -> no session yet; we just show success + go to login.
      openSuccess({
        title: "Cuenta creada",
        msg: "Te enviamos un correo para confirmar tu cuenta. Confírmala y luego inicia sesión para completar tu perfil.",
        actionLabel: "Ir a login",
        onAction: () => {
          router.push(`/auth/login?next=${encodeURIComponent(`/perfil?next=${encodeURIComponent(next)}`)}`);
          router.refresh();
        },
      });
    } catch (e: any) {
      setError(e?.message || "Failed to create account.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="authPage">
      <div className="auth-card">
        <h1 className="auth-title">Crear cuenta</h1>
        <p className="auth-sub">Crea tu cuenta y confirma tu correo para continuar.</p>

        <div className="auth-grid">
          <div className="auth-field">
            <label>Correo electrónico *</label>
            <div className="auth-input">
              <span className="auth-ic">
                <Mail size={18} />
              </span>
              <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nombre@mail.com" />
            </div>
          </div>

          <div className="auth-field">
            <label>Contraseña *</label>
            <div className="auth-input">
              <span className="auth-ic">
                <Lock size={18} />
              </span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
              />
            </div>
          </div>
        </div>

        <div className="auth-checkbox">
          <input id="terms" type="checkbox" checked={acceptTerms} onChange={(e) => setAcceptTerms(e.target.checked)} />
          <label htmlFor="terms">
            Acepto los{" "}
            <a href="/terminos-y-condiciones" target="_blank" rel="noreferrer">
              Términos &amp; Condiciones
            </a>
            .
          </label>
        </div>

        <div className="auth-actions">
          <button className="auth-btn primary" onClick={onSubmit} disabled={loading} type="button">
            <UserPlus size={18} />
            <span>{loading ? "Creando..." : "Crear cuenta"}</span>
          </button>

          <button
            className="auth-btn ghost"
            onClick={() => router.push(`/auth/login?next=${encodeURIComponent(`/perfil?next=${encodeURIComponent(next)}`)}`)}
            disabled={loading}
            type="button"
          >
            <LogIn size={18} />
            <span>Ya tengo cuenta</span>
          </button>
        </div>

        {error && (
          <div className="auth-error">
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}
      </div>

      {successOpen && (
        <div className="authModalBackdrop" role="dialog" aria-modal="true">
          <div className="authModalCard">
            <div className="authModalHeader">
              <div className="authModalTitle">
                <CheckCircle2 size={18} />
                <span>{successTitle}</span>
              </div>
              <button className="authModalClose" onClick={() => setSuccessOpen(false)} aria-label="Close">
                ✕
              </button>
            </div>

            <p className="authModalMsg">{successMsg}</p>

            <div className="authModalActions">
              <button
                className="auth-btn primary"
                type="button"
                onClick={() => {
                  setSuccessOpen(false);
                  successAction?.();
                }}
              >
                {successActionLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
