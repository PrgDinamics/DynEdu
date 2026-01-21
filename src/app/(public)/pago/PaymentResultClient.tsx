"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

type Props = {
  mode: "success" | "failure" | "pending";
};

export default function PaymentResultClient({ mode }: Props) {
  const params = useSearchParams();
  const [info, setInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const paymentId = params.get("payment_id") || params.get("payment") || null;
  const status = params.get("status") || null;
  const externalRef = params.get("external_reference") || null;

  useEffect(() => {
    const run = async () => {
      if (!paymentId) return;
      try {
        const res = await fetch(`/api/mercadopago/sync?payment_id=${encodeURIComponent(paymentId)}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || "No se pudo sincronizar el pago.");
        setInfo(`Orden: ${json.order_id} · Estado: ${json.order_status}`);
      } catch (e: any) {
        setError(e?.message || "No se pudo sincronizar el pago.");
      }
    };
    run();
  }, [paymentId]);

  const title =
    mode === "success" ? "Pago aprobado" : mode === "pending" ? "Pago pendiente" : "Pago fallido";

  const subtitle =
    mode === "success"
      ? "¡Listo! Estamos confirmando tu pago."
      : mode === "pending"
      ? "Tu pago quedó en revisión o pendiente."
      : "Tu pago no se completó.";

  return (
    <div className="payres">
      <div className={`payres-card ${mode}`}>
        <h1>{title}</h1>
        <p>{subtitle}</p>

        <div className="payres-meta">
          {externalRef && (
            <div>
              <span>Orden</span>
              <strong>{externalRef}</strong>
            </div>
          )}
          {paymentId && (
            <div>
              <span>Pago</span>
              <strong>{paymentId}</strong>
            </div>
          )}
          {status && (
            <div>
              <span>Estado MP</span>
              <strong>{status}</strong>
            </div>
          )}
        </div>

        {info && <div className="payres-info">{info}</div>}
        {error && <div className="payres-error">{error}</div>}

        <div className="payres-actions">
          <a className="btn" href="/libros">Volver al catálogo</a>
          <a className="btn ghost" href="/carrito">Ver carrito</a>
        </div>
      </div>
    </div>
  );
}
