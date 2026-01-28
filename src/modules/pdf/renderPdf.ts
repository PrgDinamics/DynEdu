// src/modules/pdf/renderPdf.ts
import PDFDocument from "pdfkit";
import { attachHeaderFooter, type PdfBranding } from "./drawCompanyHeaderFooter";

type PdfDoc = InstanceType<typeof PDFDocument>;

export type PdfMetaRow = { label: string; value: string };

export type PdfTable = {
  title?: string;
  columns: Array<{
    key: string;
    header: string;
    width?: number;
    align?: "left" | "center" | "right";
  }>;
  rows: Array<Record<string, string | number | null | undefined>>;
};

export type RenderPdfInput = {
  title: string;
  subtitle?: string;
  meta?: PdfMetaRow[];
  tables?: PdfTable[];
  // notes?: string; // ✅ ya no lo usamos como “footer”
  branding: PdfBranding;
};

function docToBuffer(doc: PdfDoc): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on("data", (c: any) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.end();
  });
}

function drawInfoCard(doc: any, title: string, rows: Array<{ label: string; value: string }>) {
  const left = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;
  const w = right - left;

  const padding = 10;
  const lineH = 14;

  // layout 2 columnas
  const colGap = 18;
  const colW = (w - padding * 2 - colGap) / 2;

  const startY = doc.y;

  // calcular alto
  const lines = Math.ceil(rows.length / 2);
  const cardH = padding * 2 + 20 + lines * lineH;

  // card background
  doc.save();
  doc.roundedRect(left, startY, w, cardH, 10).fill("#f6f7fb");
  doc.restore();

  // title
  doc.fontSize(10).fillColor("#111").text(title, left + padding, startY + padding);

  // rows
  doc.fontSize(9);
  let y = startY + padding + 18;

  rows.forEach((r, i) => {
    const isLeft = i % 2 === 0;
    const x = left + padding + (isLeft ? 0 : colW + colGap);
    if (!isLeft) {
      // misma fila
    } else if (i !== 0) {
      // nueva fila cada 2 items
      // (pero como i es par, avanzamos y)
      // y ya se incrementó al final del par anterior
    }

    const label = r.label + ": ";
    const value = r.value || "—";

    doc.fillColor("#666").text(label, x, y, { continued: true, width: colW });
    doc.fillColor("#111").text(value, { width: colW });

    if (!isLeft) y += lineH;
  });

  doc.y = startY + cardH + 14; // espacio después de la card
}


// Keep content below header line
function ensureContentTop(doc: PdfDoc) {
  doc.y = Math.max(doc.y, doc.page.margins.top + 40);
}

// Avoid writing too close to footer
function bottomLimit(doc: PdfDoc) {
  return doc.page.height - doc.page.margins.bottom - 50;
}

function drawTitle(doc: PdfDoc, input: RenderPdfInput) {
  const left = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;

  ensureContentTop(doc);

  doc.fontSize(16).fillColor("#111").text(input.title, left, doc.y, {
    width: right - left,
  });

  if (input.subtitle) {
    doc.moveDown(0.2);
    doc.fontSize(10).fillColor("#666").text(input.subtitle, left, doc.y, {
      width: right - left,
    });
  }

  doc.moveDown(0.5);
}

function drawMeta(doc: PdfDoc, meta: PdfMetaRow[]) {
  if (!meta.length) return;

  const left = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;

  doc.fontSize(10).fillColor("#111").text("Resumen", left, doc.y);
  doc.moveDown(0.2);

  for (const row of meta) {
    doc
      .fontSize(9)
      .fillColor("#666")
      .text(`${row.label}: `, left, doc.y, { continued: true })
      .fillColor("#111")
      .text(row.value || "—", { width: right - left });
  }

  doc.moveDown(0.6);
  doc
    .moveTo(left, doc.y)
    .lineTo(right, doc.y)
    .lineWidth(1)
    .strokeColor("#e9e9ef")
    .stroke();

  doc.moveDown(0.6);
}

function drawTable(doc: PdfDoc, table: PdfTable) {
  const left = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;
  const fullW = right - left;

  const rowH = 18;
  const headerH = rowH;

  const explicit = table.columns.reduce((acc, c) => acc + (c.width ?? 0), 0);
  const autoCols = table.columns.filter((c) => !c.width).length;
  const autoW = autoCols > 0 ? Math.max(40, (fullW - explicit) / autoCols) : 0;

  const cols = table.columns.map((c) => ({
    ...c,
    width: c.width ?? autoW,
    align: c.align ?? "left",
  }));

  const drawTableTitle = () => {
    if (!table.title) return;
    doc.fontSize(11).fillColor("#111").text(table.title, left, doc.y);
    doc.moveDown(0.3);
  };

  const drawHeader = () => {
    const headerY = doc.y;

    doc.rect(left, headerY, fullW, headerH).fillColor("#f6f7fb").fill();
    doc.fillColor("#111").fontSize(9);

    let x = left;
    const yText = headerY + 5;

    for (const c of cols) {
      doc.text(c.header, x + 6, yText, { width: c.width - 12, align: c.align });
      x += c.width;
    }

    doc.y = headerY + headerH;
  };

  drawTableTitle();
  drawHeader();

  doc.fontSize(9).fillColor("#111");

  for (const r of table.rows) {
    if (doc.y + rowH + 10 > bottomLimit(doc)) {
      doc.addPage();
      ensureContentTop(doc);
      drawHeader();
    }

    doc
      .moveTo(left, doc.y)
      .lineTo(right, doc.y)
      .lineWidth(1)
      .strokeColor("#efeff5")
      .stroke();

    let x = left;
    const rowY = doc.y + 5;

    for (const c of cols) {
      const val = r[c.key];
      const text = val === null || val === undefined || val === "" ? "—" : String(val);
      doc.text(text, x + 6, rowY, { width: c.width - 12, align: c.align });
      x += c.width;
    }

    doc.y += rowH;
  }

  doc
    .moveTo(left, doc.y)
    .lineTo(right, doc.y)
    .lineWidth(1)
    .strokeColor("#e9e9ef")
    .stroke();

  doc.moveDown(0.6);
}

export async function renderPdf(input: RenderPdfInput): Promise<Buffer> {
  const doc: PdfDoc = new PDFDocument({
    size: "A4",
    margin: 40,
    autoFirstPage: true,
  }) as PdfDoc;

  attachHeaderFooter(doc, input.branding);

  // start content below header line
  doc.x = doc.page.margins.left;
  doc.y = doc.page.margins.top + 90;


  drawTitle(doc, input);
  if (input.meta?.length) drawMeta(doc, input.meta);
  for (const t of input.tables ?? []) drawTable(doc, t);

  return await docToBuffer(doc);
}
