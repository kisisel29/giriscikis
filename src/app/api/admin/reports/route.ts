import { NextResponse } from "next/server";
import { toErrorResponse } from "@/lib/api-error";
import { getReport } from "@/lib/server/reporting";
import { requirePanel } from "@/lib/server/session";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    await requirePanel();
    return NextResponse.json(await getReport(new URL(request.url).searchParams));
  } catch (error) {
    return toErrorResponse(error);
  }
}
