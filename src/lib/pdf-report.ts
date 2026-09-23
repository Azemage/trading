import PDFDocument from "pdfkit";

type Run = { text: string; style: "normal" | "bold" | "code" };

/** Découpe un fragment HTML simple (<p>, <strong>, <code>) en paragraphes de
 * runs de texte stylés — suffisant pour le contenu généré par nos propres
 * templates email/messages, jamais du HTML arbitraire externe. */
function parseParagraphs(bodyHtml: string): Run[][] {
  return bodyHtml
    .split(/<\/p>/)
    .map((p) => p.replace(/<p>/g, "").trim())
    .filter(Boolean)
    .map((paragraph) => {
      const runs: Run[] = [];
      const regex = /<(strong|code)>(.*?)<\/\1>/g;
      let lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = regex.exec(paragraph))) {
        if (match.index > lastIndex) runs.push({ text: paragraph.slice(lastIndex, match.index), style: "normal" });
        runs.push({ text: match[2], style: match[1] === "strong" ? "bold" : "code" });
        lastIndex = match.index + match[0].length;
      }
      if (lastIndex < paragraph.length) runs.push({ text: paragraph.slice(lastIndex), style: "normal" });
      return runs;
    });
}

/** Génère un PDF simple (une page, texte) à partir du sujet/corps d'un
 * message client (voir lib/client-messages.ts) — pour le téléchargement
 * "PDF" dans la boîte de réception interne. */
export function generateReportPdf(title: string, bodyHtml: string, dateLabel: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fontSize(18).font("Helvetica-Bold").fillColor("#0a0d12").text("Ledger Capital");
    doc.moveDown(0.2);
    doc.fontSize(10).font("Helvetica").fillColor("#8b95a5").text(dateLabel);
    doc.moveDown(1);

    doc.fontSize(14).font("Helvetica-Bold").fillColor("#0a0d12").text(title);
    doc.moveDown(0.8);

    doc.fontSize(11);
    for (const runs of parseParagraphs(bodyHtml)) {
      runs.forEach((run, i) => {
        doc
          .font(run.style === "bold" ? "Helvetica-Bold" : run.style === "code" ? "Courier" : "Helvetica")
          .fillColor("#1a1a1a")
          .text(run.text, { continued: i < runs.length - 1 });
      });
      doc.moveDown(0.8);
    }

    doc.end();
  });
}
