import "./contact.css";

export default function Contact() {
  return (
    <section className="contact-section fade-in-up" id="contacto">
      <h2 className="contact-title">Contacto</h2>

      <p className="contact-intro">
        Ponte en contacto con nosotros para cotizaciones, consultas o información 
        sobre nuestros servicios para colegios.
      </p>

      <div className="contact-container">

        {/* FORMULARIO */}
        <form className="contact-form">
          <input type="text" placeholder="Tu nombre" required />
          <input type="email" placeholder="Correo electrónico" required />
          <input type="text" placeholder="Nombre del colegio (opcional)" />
          <textarea placeholder="Escribe tu mensaje..." required></textarea>

          <button type="submit" className="contact-btn">
            Enviar mensaje
          </button>
        </form>

        {/* INFORMACIÓN */}
        <div className="contact-info">
          <h3>Información directa</h3>

          <p><strong>Email:</strong> contacto@prgdynamics.com</p>
          <p><strong>Teléfono:</strong> +51 999 999 999</p>
          <p><strong>Dirección:</strong> Lima, Perú</p>

          <div className="info-box">
            <p>Atendemos de lunes a viernes</p>
            <p>9:00 AM – 6:00 PM</p>
          </div>
        </div>

      </div>
    </section>
  );
}
