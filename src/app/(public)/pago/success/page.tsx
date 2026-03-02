import "../PaymentResult.css";
import PaymentResultClient from "../PaymentResultClient";
import { Suspense } from "react";

export default function Page() {
  return (
    <Suspense fallback={<div className="payres">Cargando resultado…</div>}>
      <PaymentResultClient mode="success" />
    </Suspense>
  );
}
