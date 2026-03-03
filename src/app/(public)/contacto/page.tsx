import { Suspense } from "react";
import Contact from "@/components/public/Contact/Contact";

export const metadata = {
  title: "Contacto | DynEdu",
  description: "Coordina tu campaña escolar y solicita cotizaciones con Dynamic Education.",
};

export default function Page() {
  return (
    <Suspense fallback={<div style={{ padding: 24 }}>Cargando...</div>}>
      <Contact />
    </Suspense>
  );
}

