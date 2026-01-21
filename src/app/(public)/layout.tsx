import "../global.css";
import Navbar from "@/components/public/Navbar/Navbar";
import Footer from "@/components/public/Footer/Footer";
export const metadata = {
  title: "PRG Dinamics",
  description: "Soluciones Editoriales para Instituciones Educativas.",
};

export default function PublicLayout({ children }) {
  return (
    <html lang="es">
      <body>
        <Navbar />
        <main className="public-main">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
