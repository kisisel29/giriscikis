import { readFileSync } from "node:fs";
import path from "node:path";
import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";

export type ExportTable = {
  title: string;
  subtitle: string;
  columns: string[];
  rows: string[][];
};

const fontPath = path.join(process.cwd(), "assets", "fonts", "NotoSans-Regular.ttf");

export async function renderXlsx(tables: ExportTable[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Giriş Çıkış";
  tables.forEach((table, index) => {
    const sheet = workbook.addWorksheet(table.title.slice(0, 28) || `Sayfa ${index + 1}`);
    sheet.addRow([table.title]);
    sheet.addRow([table.subtitle]);
    sheet.addRow([]);
    const header = sheet.addRow(table.columns);
    header.font = { bold: true };
    table.rows.forEach((row) => sheet.addRow(row));
    sheet.columns.forEach((column) => {
      column.width = 24;
    });
  });
  const data = await workbook.xlsx.writeBuffer();
  return Buffer.from(data);
}

export function renderPdf(tables: ExportTable[]): Promise<Buffer> {
  const font = readFileSync(fontPath);
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 40 });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.font(font);
    tables.forEach((table, index) => {
      if (index > 0) doc.addPage();
      doc.fontSize(16).text(table.title);
      doc.moveDown(0.3);
      doc.fontSize(10).fillColor("#334155").text(table.subtitle);
      doc.fillColor("#0f172a");
      doc.moveDown(0.8);
      doc.fontSize(9).text(table.columns.join(" · "), { width: 515 });
      doc.moveDown(0.4);
      table.rows.forEach((row) => {
        if (doc.y > 760) doc.addPage();
        doc.font(font).fontSize(9).text(row.join("  |  "), { width: 515 });
        doc.moveDown(0.35);
      });
      if (table.rows.length === 0) doc.text("Kayıt yok.");
    });
    doc.end();
  });
}

type ReportShape = {
  from: string;
  to: string;
  reports: Array<{
    fullName: string;
    department: string | null;
    averageEntry: string | null;
    averageExit: string | null;
    physical: string;
    duty: string;
    overtime: string;
    official: string;
    meal: string;
    health: string;
    personal: string;
    other: string;
    lateCount: number;
    late: string;
    earlyCount: number;
    early: string;
    missingCount: number;
    days: Array<{
      dateLabel: string;
      firstEntryLabel: string;
      lastExitLabel: string;
      physical: string;
      duty: string;
      overtime: string;
      official: string;
      personal: string;
      other: string;
      stateLabel: string;
    }>;
    officialDetails: Array<{ dateLabel: string; label: string; custom: string | null; duration: string }>;
  }>;
};

export function reportTables(data: ReportShape, title: string): ExportTable[] {
  const daily = data.from === data.to;
  const summary: ExportTable = {
    title,
    subtitle: `${data.from} – ${data.to}`,
    columns: daily
      ? ["Personel", "Birim", "İlk giriş", "Son çıkış", "Kurumda", "Mesai", "Fazla mesai", "Resmî görev", "Kişisel", "Diğer", "Durum"]
      : ["Personel", "Birim", "Ort. giriş", "Ort. çıkış", "Kurumda", "Mesai", "Fazla mesai", "Resmî görev", "Geç", "Erken", "Eksik"],
    rows: data.reports.map((report) => {
      const day = report.days[0];
      if (daily && day) {
        return [
          report.fullName,
          report.department ?? "—",
          day.firstEntryLabel,
          day.lastExitLabel,
          day.physical,
          day.duty,
          day.overtime,
          day.official,
          day.personal,
          day.other,
          day.stateLabel,
        ];
      }
      return [
        report.fullName,
        report.department ?? "—",
        report.averageEntry ?? "—",
        report.averageExit ?? "—",
        report.physical,
        report.duty,
        report.overtime,
        report.official,
        `${report.lateCount} / ${report.late}`,
        `${report.earlyCount} / ${report.early}`,
        String(report.missingCount),
      ];
    }),
  };
  const details: ExportTable = {
    title: "Resmî görev ayrıntısı",
    subtitle: "Özel yazılan çıkış nedenleri",
    columns: ["Personel", "Tarih", "Neden", "Açıklama", "Süre"],
    rows: data.reports.flatMap((report) =>
      report.officialDetails.map((detail) => [
        report.fullName,
        detail.dateLabel,
        detail.label,
        detail.custom ?? "—",
        detail.duration,
      ]),
    ),
  };
  return [summary, details];
}
