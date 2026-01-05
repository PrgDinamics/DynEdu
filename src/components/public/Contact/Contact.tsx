"use client";

import "./contact.css";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Mail, Phone, MapPin, Send } from "lucide-react";

type FormState = "idle" | "sending" | "success" | "error";

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export default function Contact() {
  const params = useSearchParams();

  const prefillProduct = useMemo(() => {
    return params.get("producto") || params.get("book") || "";
  }, [params]);

  const prefillId = useMemo(() => params.get("id") || "", [params]);

  const [state, setState] = useState<FormState>("idle");
  const [errorMsg, setErrorMsg] = useState<string>("");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [school, setSchool] = useState("");
  const [message, setMessage] = useState("");

  const [topic, setTopic] = useState<string>("campaign");
  const [product, setProduct] = useState<string>("");

  useEffect(() => {
    if (prefillProduct) {
      setProduct(prefillProduct);
      setTopic("quote");
      setMessage((m) => {
        const base = m.trim().length ? m : "";
        const line1 = `Hola, quiero cotizar este producto: ${prefillProduct}${
          prefillId ? ` (ID: ${prefillId})` : ""
        }.`;
        const line2 = "Por favor indíquenme disponibilidad, packs y fechas de entrega.";
        return base ? `${line1}\n${line2}\n\n${base}` : `${line1}\n${line2}`;
      });
    }
  }, [prefillProduct, prefillId]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg("");

    if (!name.trim()) return setErrorMsg("Por favor ingresa tu nombre.");
    if (!isEmail(email)) return setErrorMsg("Por favor ingresa un correo válido.");
    if (!message.trim()) return setErrorMsg("Cuéntanos lo que necesitas en el mensaje.");

    setState("sending");

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          phone,
          school,
          topic,
          product,
          message,
          source: "public_site",
        }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || "No se pudo enviar el mensaje.");
      }

      setState("success");
    } catch (err: any) {
      setState("error");
      setErrorMsg(err?.message || "Ocurrió un error al enviar. Intenta de nuevo.");
    }
  }

  return (
    <section className="contact">
      <div className="contact-inner fade-in-up">
        <div className="contact-left">
          <div className="contact-pill">CONTACTO</div>

          <h2 className="contactTitle">
            Coordina tu campaña con <span>PRG Dinamics</span>
          </h2>

          <p className="contact-subtitle">
            Escríbenos y te ayudamos a organizar el catálogo, packs por grado y el cronograma de
            entrega.
          </p>

          <div className="contact-info card">
            <div className="info-item">
              <span className="infoIcon" aria-hidden="true">
                <Mail size={18} />
              </span>
              <div>
                <div className="info-label">Correo</div>
                <div className="info-value">contacto@prgdynamics.com</div>
              </div>
            </div>

            <div className="info-item">
              <span className="infoIcon" aria-hidden="true">
                <Phone size={18} />
              </span>
              <div>
                <div className="info-label">Teléfono</div>
                <div className="info-value">+51 999 999 999</div>
              </div>
            </div>

            <div className="info-item">
              <span className="infoIcon" aria-hidden="true">
                <MapPin size={18} />
              </span>
              <div>
                <div className="info-label">Ubicación</div>
                <div className="info-value">Lima, Perú</div>
              </div>
            </div>
          </div>

          <div className="contact-note">
           
          </div>
        </div>

        <div className="contact-right card">
          <form className="contact-form" onSubmit={onSubmit}>
            <div className="form-row">
              <div className="field">
                <label>Nombre</label>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Tu nombre" />
              </div>

              <div className="field">
                <label>Correo</label>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@correo.com"
                  inputMode="email"
                />
              </div>
            </div>

            <div className="form-row">
              <div className="field">
                <label>Teléfono</label>
                <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+51 ..." />
              </div>

              <div className="field">
                <label>Colegio / Institución</label>
                <input
                  value={school}
                  onChange={(e) => setSchool(e.target.value)}
                  placeholder="Nombre del colegio"
                />
              </div>
            </div>

            <div className="form-row">
              <div className="field">
                <label>Motivo</label>
                <select value={topic} onChange={(e) => setTopic(e.target.value)}>
                  <option value="campaign">Coordinar campaña</option>
                  <option value="quote">Cotización de producto</option>
                  <option value="general">Consulta general</option>
                </select>
              </div>

              <div className="field">
                <label>Producto (opcional)</label>
                <input value={product} onChange={(e) => setProduct(e.target.value)} placeholder="Ej: Matemática 5to" />
              </div>
            </div>

            <div className="field">
              <label>Mensaje</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Cuéntanos qué necesitas (grado, cantidad aproximada, fechas, etc.)"
                rows={6}
              />
            </div>

            {errorMsg ? <div className="form-error">{errorMsg}</div> : null}

            <button className="submit" type="submit" disabled={state === "sending"}>
              <span className="submitInner">
                <Send size={18} aria-hidden="true" />
                {state === "sending" ? "Enviando..." : state === "success" ? "Enviado ✓" : "Enviar mensaje"}
              </span>
            </button>

            {state === "success" ? (
              <div className="form-success">Listo. Recibimos tu mensaje y te responderemos a la brevedad.</div>
            ) : null}
          </form>
        </div>
      </div>
    </section>
  );
}
