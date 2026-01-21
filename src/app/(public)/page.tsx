import { Suspense } from "react";
import Hero from "@/components/public/Hero/Hero";
import About from "@/components/public/About/About";
import Books from "@/components/public/Books/Books";
import Contact from "@/components/public/Contact/Contact";
import ScrollRevealPromo from "@/components/public/ScrollRevealPromo/ScrollRevealPromo";

export default function HomePage() {
  return (
    <>
      <div className="heroScene">
        <Hero />
        <ScrollRevealPromo imageSrc="/images/web/readers.png"/>
      </div>

      <About />

      <About />
      <Books />
      <Suspense fallback={<div style={{ padding: 24 }}>Cargando...</div>}>
        <Contact />
      </Suspense>
    </>
  );
}
