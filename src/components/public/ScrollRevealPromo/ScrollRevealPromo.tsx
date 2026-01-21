"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./ScrollRevealPromo.module.css";

type Props = {
  imageSrc?: string;
  height?: number;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export default function ScrollRevealPromo({
  imageSrc = "/images/web/readers.png",
  height = 360,
}: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [progress, setProgress] = useState(0); // 0..1

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let raf = 0;

    const update = () => {
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight;

      /**
       * We want:
       * - progress = 0 when section is just below viewport (not started)
       * - progress = 1 when section is fully passed a certain point
       *
       * Start revealing when top reaches 85% viewport height.
       * Finish when top reaches 25% viewport height.
       */
      const start = vh * 0.85;
      const end = vh * 0.25;

      const raw = (start - rect.top) / (start - end); // increases as you scroll down
      setProgress(clamp(raw, 0, 1));
    };

    const onScroll = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);

    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  // Image starts lower and goes up as progress increases
  const translateY = (1 - progress) * 35; // % (tweak)

  return (
    <section
      ref={ref}
      className={styles.wrap}
      style={{ ["--promo-h" as any]: `${height}px` }}
      aria-label="Promoción"
    >
      <div className={styles.card}>
        {/* Mask viewport */}
        <div className={styles.viewport}>
          {/* Moving image */}
          <div
            className={styles.bg}
            style={{
              backgroundImage: `url(${imageSrc})`,
              transform: `translateY(${translateY}%)`,
            }}
          />
          <div className={styles.overlay} />
          <div
            className={styles.content}
            style={{
              opacity: 0.65 + progress * 0.35,
              transform: `translateY(${(1 - progress) * 10}px)`,
            }}
          >

          </div>
        </div>

        {/* tiny progress bar (optional, se ve pro) */}
        <div className={styles.progress}>
          <div className={styles.progressFill} style={{ width: `${progress * 100}%` }} />
        </div>
      </div>
    </section>
  );
}
