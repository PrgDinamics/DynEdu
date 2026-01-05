import { Suspense } from "react";
import Hero from "@/components/public/Hero/Hero";
import About from "@/components/public/About/About";
import Books from "@/components/public/Books/Books";
import Contact from "@/components/public/Contact/Contact";

export default function HomePage() {
  return (
    <>
      <Hero />
      <About />
      <Books />
      <Suspense fallback={<div style={{ padding: 24 }}>Cargando...</div>}>
        <Contact />
      </Suspense>
    </>
  );
}
