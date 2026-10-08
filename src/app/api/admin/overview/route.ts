import { NextResponse } from "next/server";
import { toErrorResponse } from "@/lib/api-error";
import { getOverview } from "@/lib/server/reporting";
import { requirePanel } from "@/lib/server/session";

export const runtime = "nodejs";

export async function GET() {
  try {
    await requirePanel();
    return NextResponse.json(await getOverview());
  } catch (error) {
    return toErrorResponse(error);
  }
}
