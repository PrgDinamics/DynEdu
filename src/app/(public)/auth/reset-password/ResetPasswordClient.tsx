"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Lock, Save, AlertCircle, CheckCircle2, ArrowLeft } from "lucide-react";
import "../register/auth.css";

export default function ResetPasswordClient() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const router = useRouter();
  const search = useSearchParams();

  const next = search.get("next") || "/checkout";

  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");

  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(true);
  const [ready, setReady] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // 1) On mount: verify recovery link + establish session
  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setVerifying(true);
      setError(null);
      setReady(false);

      try {
        const url = new URL(window.location.href);

        // PKCE flow: /auth/reset-password?code=...
        const code = url.searchParams.get("code");

        // Legacy flow: /auth/reset-password#access_token=...&refresh_token=...
        const hash = url.hash?.startsWith("#") ? url.hash.slice(1) : "";
        const hashParams = new URLSearchParams(hash);

        const access_token =
          hashParams.get("access_token") || url.searchParams.get("access_token");
        const refresh_token =
          hashParams.get("refresh_token") || url.searchParams.get("refresh_token");

        if (code) {
          // Exchange the code for a session (Supabase v2)
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
          if (!data?.session) throw new Error("No session returned from recovery link.");
        } else if (access_token && refresh_token) {
          const { data, error } = await supabase.auth.setSession({
            access_token,
            refresh_token,
          });
          if (error) throw error;
          if (!data?.session) throw new Error("No session returned from recovery link.");
        } else {
          // Some providers redirect without exposing tokens/code in client.
          // In that case, check if there's already a session.
          const { data } = await supabase.auth.getSession();
          if (!data?.session) {
            throw new Error("El enlace de recuperación es inválido o ha expirado.");
          }
        }

        if (cancelled) return;

        // Clean URL (remove hash tokens / code) for nicer UX
        try {
          const clean = new URL(window.location.href);
          clean.searchParams.delete("code");
          clean.searchParams.delete("access_token");
          clean.searchParams.delete("refresh_token");
          clean.hash = "";
          window.history.replaceState({}, "", clean.toString());
        } catch {
          // ignore
        }

        setReady(true);
      } catch (e: any) {
        if (cancelled) return;
        setError(e?.message || "El enlace de recuperación es inválido o ha expirado.");
        setReady(false);
      } finally {
        if (!cancelled) setVerifying(false);
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [supabase]);

  // 2) Save new password
  const onSave = async () => {
    setError(null);

    if (!ready) {
      setError("El enlace de recuperación no está listo. Recarga la página o solicita uno nuevo.");
      return;
    }

    if (!password || password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    if (password !== password2) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      setDone(true);

      // (Optional) sign out to force login with new password
      try {
        await supabase.auth.signOut();
      } catch {}

      setTimeout(() => {
        router.push(`/auth/login?next=${encodeURIComponent(next)}`);
        router.refresh();
      }, 900);
    } catch (e: any) {
      setError(e?.message || "No se pudo actualizar la contraseña. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="authPage">
      <div className="auth-card">
        <h1 className="auth-title">Crear nueva contraseña</h1>
        <p className="auth-sub">Ingresa tu nueva contraseña.</p>

        {verifying && (
          <div className="auth-success" style={{ opacity: 0.9 }}>
            <CheckCircle2 size={18} />
            <span>Verificando enlace de recuperación…</span>
          </div>
        )}

        {!verifying && !ready && (
          <div className="auth-error">
            <AlertCircle size={18} />
            <span>
              {error || "El enlace de recuperación es inválido o ha expirado."}
            </span>
          </div>
        )}

        <div className="auth-grid" style={{ opacity: ready ? 1 : 0.5, pointerEvents: ready ? "auto" : "none" }}>
          <div className="auth-field">
            <label>Nueva contraseña *</label>
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

          <div className="auth-field">
            <label>Repite la contraseña *</label>
            <div className="auth-input">
              <span className="auth-ic">
                <Lock size={18} />
              </span>
              <input
                type="password"
                value={password2}
                onChange={(e) => setPassword2(e.target.value)}
                placeholder="Repite tu contraseña"
              />
            </div>
          </div>
        </div>

        <div className="auth-actions">
          <button
            className="auth-btn primary"
            onClick={onSave}
            disabled={loading || verifying || !ready}
            type="button"
          >
            <Save size={18} />
            <span>{loading ? "Guardando..." : "Guardar"}</span>
          </button>

          {!ready && (
            <button
              className="auth-btn ghost"
              onClick={() => router.push(`/auth/forgot-password?next=${encodeURIComponent(next)}`)}
              disabled={loading || verifying}
              type="button"
            >
              <ArrowLeft size={18} />
              <span>Volver a pedir link</span>
            </button>
          )}
        </div>

        {error && ready && (
          <div className="auth-error">
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        {done && (
          <div className="auth-success">
            <CheckCircle2 size={18} />
            <span>Contraseña actualizada. Te llevamos al login…</span>
          </div>
        )}
      </div>
    </main>
  );
}