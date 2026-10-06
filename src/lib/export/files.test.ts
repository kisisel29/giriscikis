import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { renderPdf, renderXlsx, reportTables } from "@/lib/export/files";

const data = {
  from: "06.10.2026",
  to: "06.10.2026",
  reports: [
    {
      fullName: "Ahmet Yılmaz",
      department: "Öğretmen",
      averageEntry: "08:07",
      averageExit: "17:05",
      physical: "7 sa 00 dk",
      duty: "9 sa 00 dk",
      official: "2 sa 00 dk",
      meal: "0 sa 00 dk",
      health: "0 sa 00 dk",
      personal: "0 sa 00 dk",
      other: "0 sa 00 dk",
      lateCount: 1,
      late: "0 sa 07 dk",
      earlyCount: 0,
      early: "0 sa 00 dk",
      missingCount: 0,
      days: [
        {
          dateLabel: "06.10.2026",
          firstEntryLabel: "08:07",
          lastExitLabel: "17:05",
          physical: "7 sa 00 dk",
          official: "2 sa 00 dk",
          personal: "0 sa 00 dk",
          other: "0 sa 00 dk",
          stateLabel: "Mesaisi bitti",
        },
      ],
      officialDetails: [
        {
          dateLabel: "06.10.2026",
          label: "Resmî görev",
          custom: "Kelkit Halk Eğitim Merkezi semineri",
          duration: "2 sa 00 dk",
        },
      ],
    },
  ],
};

describe("dışa aktarma", () => {
  it("xlsx içinde Türkçe karakterleri korur", async () => {
    const buffer = await renderXlsx(reportTables(data, "Günlük rapor"));
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);
    const sheet = workbook.getWorksheet("Resmî görev ayrıntısı");
    const values = sheet?.getRow(5).values;
    expect(JSON.stringify(values)).toContain("Kelkit Halk Eğitim Merkezi semineri");
    expect(JSON.stringify(values)).toContain("Resmî görev");
  });

  it("pdf dosyası Türkçe font ile üretilir", async () => {
    const buffer = await renderPdf(reportTables(data, "Günlük rapor"));
    expect(buffer.subarray(0, 5).toString()).toBe("%PDF-");
    expect(buffer.toString("latin1")).toContain("NotoSans");
  });
});
