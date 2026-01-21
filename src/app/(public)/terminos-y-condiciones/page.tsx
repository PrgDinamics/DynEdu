import "./terms.css";

export const metadata = {
  title: "Términos y Condiciones | PRG Dinamics / DynEdu",
  description: "Términos y condiciones de compra y uso del sitio.",
};

export default function TermsPage() {
  return (
    <main className="terms-wrap">
      <h1 className="terms-title">Términos y Condiciones</h1>
      <section className="terms-section">
        <h2 className="terms-h2">1. Identificación</h2>
        <p className="terms-p">
          El presente documento regula el acceso y uso del sitio web de{" "}
          <strong>PRG Dinamics / DynEdu</strong> (en adelante, “la Plataforma”),
          así como las condiciones aplicables a la compra de productos ofrecidos
          a través de la Plataforma.
        </p>
      </section>

      <section className="terms-section">
        <h2 className="terms-h2">2. Aceptación</h2>
        <p className="terms-p">
          Al registrarte, navegar y/o realizar una compra, declaras haber leído y
          aceptado estos Términos y Condiciones. Si no estás de acuerdo, debes
          abstenerte de usar la Plataforma.
        </p>
      </section>

      <section className="terms-section">
        <h2 className="terms-h2">3. Registro y cuenta</h2>
        <ul className="terms-ul">
          <li>Para comprar, el usuario debe contar con una cuenta registrada.</li>
          <li>El usuario es responsable de mantener la confidencialidad de sus credenciales.</li>
          <li>Los datos proporcionados deben ser veraces y estar actualizados.</li>
        </ul>
      </section>

      <section className="terms-section">
        <h2 className="terms-h2">4. Productos y disponibilidad</h2>
        <ul className="terms-ul">
          <li>Las imágenes son referenciales y pueden variar levemente según edición o impresión.</li>
          <li>La disponibilidad puede cambiar sin previo aviso.</li>
        </ul>
      </section>

      <section className="terms-section">
        <h2 className="terms-h2">5. Precios, pagos y comprobantes</h2>
        <ul className="terms-ul">
          <li>Los precios se muestran en soles (PEN), e incluyen impuestos cuando corresponda.</li>
          <li>Los pagos se procesan mediante pasarelas de pago de terceros.</li>
          <li>Una compra se considera confirmada cuando el pago sea aprobado y se registre en la Plataforma.</li>
        </ul>
      </section>

      <section className="terms-section">
        <h2 className="terms-h2">6. Envíos, entregas y recojo</h2>
        <ul className="terms-ul">
          <li>El usuario debe ingresar una dirección completa y datos de contacto válidos.</li>
          <li>Los plazos de entrega son estimados y pueden variar por factores externos.</li>
          <li>En caso de recojo, se informará el punto y horario correspondiente.</li>
        </ul>
      </section>

      <section className="terms-section">
        <h2 className="terms-h2">7. Cambios, devoluciones y reclamos</h2>
        <ul className="terms-ul">
          <li>Si el producto llegó dañado o con falla de fabricación, el usuario podrá solicitar evaluación.</li>
          <li>Para gestionar un reclamo, se puede solicitar evidencia (fotos, número de pedido, etc.).</li>
          <li>No aplican devoluciones por cambio de opinión si el producto fue abierto/dañado, salvo normativa aplicable.</li>
        </ul>
      </section>

      <section className="terms-section">
        <h2 className="terms-h2">8. Uso permitido</h2>
        <p className="terms-p">
          El usuario se compromete a no utilizar la Plataforma para actividades ilícitas, fraude,
          abuso o acciones que afecten la disponibilidad del servicio.
        </p>
      </section>

      <section className="terms-section">
        <h2 className="terms-h2">9. Protección de datos</h2>
        <p className="terms-p">
          Los datos personales se tratarán conforme a la Política de Privacidad de la Plataforma.
        </p>
      </section>

      <section className="terms-section">
        <h2 className="terms-h2">10. Modificaciones</h2>
        <p className="terms-p">
          PRG Dinamics / DynEdu puede actualizar estos Términos y Condiciones. Los cambios entran en
          vigencia desde su publicación.
        </p>
      </section>

      <section className="terms-section">
        <h2 className="terms-h2">11. Contacto</h2>
        <p className="terms-p">
          Para consultas o soporte, contáctanos a través de los canales oficiales indicados en “Contacto”.
        </p>
        <p className="terms-note">
          Sugerencia: aquí puedes colocar email/teléfono cuando definas los datos finales.
        </p>
      </section>
    </main>
  );
}
