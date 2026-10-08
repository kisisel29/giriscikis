import { NextResponse } from "next/server";
import { toErrorResponse } from "@/lib/api-error";
import { createManualAttendance } from "@/lib/server/directory";
import { requireAdmin } from "@/lib/server/session";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();
    return NextResponse.json(await createManualAttendance(await request.json(), admin.user.id));
  } catch (error) {
    return toErrorResponse(error);
  }
}
