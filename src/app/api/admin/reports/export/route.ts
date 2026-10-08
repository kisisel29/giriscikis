import { NextResponse } from "next/server";
import { toErrorResponse } from "@/lib/api-error";
import { renderPdf, renderXlsx, reportTables } from "@/lib/export/files";
import { getReport } from "@/lib/server/reporting";
import { requirePanel } from "@/lib/server/session";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    await requirePanel();
    const params = new URL(request.url).searchParams;
    const format = params.get("format") === "pdf" ? "pdf" : "xlsx";
    const data = await getReport(params);
    const tables = reportTables(data, "Rapor");
    const buffer = format === "pdf" ? await renderPdf(tables) : await renderXlsx(tables);
    const filename = `rapor.${format}`;
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type":
          format === "pdf"
            ? "application/pdf"
            : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
