import { NextResponse } from "next/server";
import { toErrorResponse } from "@/lib/api-error";
import { listAudit } from "@/lib/server/directory";
import { requireAdmin } from "@/lib/server/session";

export const runtime = "nodejs";

export async function GET() {
  try {
    await requireAdmin();
    return NextResponse.json(await listAudit());
  } catch (error) {
    return toErrorResponse(error);
  }
}
