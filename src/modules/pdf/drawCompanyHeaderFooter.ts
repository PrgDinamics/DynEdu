// src/modules/pdf/drawCompanyHeaderFooter.ts
import PDFDocument from "pdfkit";

type PdfDoc = InstanceType<typeof PDFDocument>;

export type CompanyInfo = {
  name: string;
  tradeName: string;
  ruc: string;
  address: string;
  phone: string;
  email: string;
};

export type PdfBranding = {
  company: CompanyInfo;
  logoDataUrl: string | null; // "data:image/png;base64,..."
};

function dataUrlToBuffer(dataUrl: string): Buffer {
  const base64 = dataUrl.split(",")[1] ?? "";
  return Buffer.from(base64, "base64");
}

export function attachHeaderFooter(doc: PdfDoc, branding: PdfBranding) {
  const draw = () => {
    const prevX = doc.x;
    const prevY = doc.y;

    doc.save();
    try {
      const { company, logoDataUrl } = branding;

      const left = doc.page.margins.left;
      const right = doc.page.width - doc.page.margins.right;

      // Header (fixed)
      const headerY = 18;

      if (logoDataUrl) {
        try {
          const buf = dataUrlToBuffer(logoDataUrl);
          doc.image(buf, left, headerY, { width: 128 });
        } catch {
          // ignore
        }
      }

      doc.fontSize(12).fillColor("#111").text(
        company.tradeName || company.name || "—",
        left + 450,
        headerY + 20,
        { width: right - (left + 80), lineBreak: false }
      );

      doc.fontSize(9).fillColor("#666").text(
        `RUC: ${company.ruc || "—"}`,
        left + 450,
        headerY + 35,
        { lineBreak: false }
      );

      doc
        .moveTo(left, headerY + 74)
        .lineTo(right, headerY + 74)
        .lineWidth(1)
        .strokeColor("#e9e9ef")
        .stroke();

      // Footer (INSIDE printable area + does not move cursor)
      const footerLine1 = [company.address, company.email, company.phone]
        .filter(Boolean)
        .join(" • ");
      const footerLine2 = "Documento generado por DynEdu (PRG Dinamics).";

      // ✅ OJO: ahora va DENTRO del margen (restamos, no sumamos)
      const footerY2 = doc.page.height - doc.page.margins.bottom - 10; // línea abajo
      const footerY1 = footerY2 - 10; // línea arriba

      doc.fontSize(7).fillColor("#777");

      doc.text(footerLine1 || "—", left, footerY1, {
        width: right - left,
        align: "center",
        lineBreak: false,
      });

      doc.text(footerLine2, left, footerY2, {
        width: right - left,
        align: "center",
        lineBreak: false,
      });
    } finally {
      doc.restore();
      // ✅ devuelve el cursor a donde estaba, para que NO afecte el contenido
      doc.x = prevX;
      doc.y = prevY;
      doc.fillColor("#111");
    }
  };

  draw();
  doc.on("pageAdded", draw);
}
