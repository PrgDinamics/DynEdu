"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Mail, ArrowLeft, Send, AlertCircle, CheckCircle2 } from "lucide-react";
import "../register/auth.css";

export default function ForgotPasswordClient() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const router = useRouter();
  const search = useSearchParams();

  const next = search.get("next") || "/checkout";

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const onSend = async () => {
    setLoading(true);
    setError(null);

    try {
      const redirectTo = `${window.location.origin}/auth/reset-password?next=${encodeURIComponent(
        next
      )}`;

      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo,
      });

      if (error) throw error;
      setSent(true);
    } catch (e: any) {
      setError(e?.message || "No se pudo enviar el correo de recuperación.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="authPage">
      <div className="auth-card">
        <h1 className="auth-title">Recuperar contraseña</h1>
        <p className="auth-sub">Te enviaremos un link para crear una nueva contraseña.</p>

        <div className="auth-grid">
          <div className="auth-field">
            <label>Correo electrónico *</label>
            <div className="auth-input">
              <span className="auth-ic">
                <Mail size={18} />
              </span>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nombre@mail.com"
                autoComplete="email"
              />
            </div>
          </div>
        </div>

        <div className="auth-actions">
          <button className="auth-btn primary" onClick={onSend} disabled={loading} type="button">
            <Send size={18} />
            <span>{loading ? "Enviando..." : "Enviar link"}</span>
          </button>

          <button
            className="auth-btn ghost"
            onClick={() => router.push(`/auth/login?next=${encodeURIComponent(next)}`)}
            disabled={loading}
            type="button"
          >
            <ArrowLeft size={18} />
            <span>Volver</span>
          </button>
        </div>

        {error && (
          <div className="auth-error">
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        {sent && (
          <div className="auth-success">
            <CheckCircle2 size={18} />
            <span>Listo. Revisa tu correo para continuar con la recuperación.</span>
          </div>
        )}
      </div>
    </main>
  );
}
