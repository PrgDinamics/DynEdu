"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import "./login.css";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Mail, Lock, LogIn, UserPlus, AlertCircle } from "lucide-react";

export default function LoginClient() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const router = useRouter();
  const searchParams = useSearchParams();

  const next = searchParams.get("next") || "/checkout";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async () => {
    setLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      // cookie session should be available via middleware
      await supabase.auth.getSession();

      router.push(next);
      router.refresh();
    } catch (e: any) {
      setError(e?.message || "Error al iniciar sesión.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="loginPage">
      <div className="loginCard">
        <div className="loginHeader">
          <h1 className="loginTitle">Iniciar sesión</h1>
          <p className="loginSub">Ingresa para continuar con tu compra.</p>
        </div>

        <div className="loginGrid">
          <div className="loginField">
            <label>Correo</label>
            <div className="loginInputWrap">
              <span className="loginIcon">
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

          <div className="loginField">
            <label>Contraseña</label>
            <div className="loginInputWrap">
              <span className="loginIcon">
                <Lock size={18} />
              </span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </div>
          </div>
        </div>

        <div className="loginActions">
          <button
            className="loginBtn loginBtnPrimary"
            onClick={onSubmit}
            disabled={loading}
            type="button"
            style={{ display: "inline-flex", alignItems: "center", gap: 10 }}
          >
            <LogIn size={18} />
            <span>{loading ? "Ingresando..." : "Ingresar"}</span>
          </button>

          <button
            className="loginBtn loginBtnGhost"
            onClick={() => router.push(`/auth/register?next=${encodeURIComponent(next)}`)}
            disabled={loading}
            type="button"
            style={{ display: "inline-flex", alignItems: "center", gap: 10 }}
          >
            <UserPlus size={18} />
            <span>Crear cuenta</span>
          </button>

          <button
            type="button"
            className="loginBtn loginBtnLink"
            onClick={() => router.push(`/auth/forgot-password?next=${encodeURIComponent(next)}`)}
            disabled={loading}
          >
            ¿Olvidaste tu contraseña?
          </button>

        </div>

        {error && (
          <div className="loginError" style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}
      </div>
    </main>
  );
}
