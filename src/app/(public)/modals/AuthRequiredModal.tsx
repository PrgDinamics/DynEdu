"use client";

import Link from "next/link";
import styles from "./AuthRequiredModal.module.css";

type Props = {
  open: boolean;
  onClose: () => void;
  message?: string;
  nextPath?: string;
};

export default function AuthRequiredModal({
  open,
  onClose,
  message = "Regístrate o inicia sesión para agregar items al carrito.",
  nextPath = "/libros",
}: Props) {
  if (!open) return null;

  const loginHref = `/auth/login?next=${encodeURIComponent(nextPath)}`;
  const registerHref = `/auth/register?next=${encodeURIComponent(nextPath)}`;

  return (
    <div className={styles.backdrop} onClick={onClose} role="dialog" aria-modal="true">
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.title}>Authentication required</div>
          <button className={styles.xBtn} onClick={onClose} aria-label="Close modal" type="button">
            ✕
          </button>
        </div>

        <div className={styles.body}>{message}</div>

        <div className={styles.actions}>
          <Link className={styles.primaryBtn} href={loginHref}>
            Login
          </Link>

          <Link className={styles.secondaryBtn} href={registerHref}>
            Register
          </Link>

          <button className={styles.ghostBtn} onClick={onClose} type="button">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
