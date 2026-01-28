"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Lock, Save, AlertCircle, CheckCircle2 } from "lucide-react";
import "../register/auth.css";


export default function ResetPasswordPage() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const router = useRouter();
  const search = useSearchParams();

  const next = search.get("next") || "/checkout";

  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [loading, setLoading] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const onSave = async () => {
    setError(null);

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
      // When user opens the email link, Supabase sets a recovery session.
      const { error } = await supabase.auth.updateUser({ password });

      if (error) throw error;

      setDone(true);

      // optional: log out + force login (some teams prefer)
      // await supabase.auth.signOut();

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

        <div className="auth-grid">
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
          <button className="auth-btn primary" onClick={onSave} disabled={loading} type="button">
            <Save size={18} />
            <span>{loading ? "Guardando..." : "Guardar"}</span>
          </button>
        </div>

        {error && (
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
