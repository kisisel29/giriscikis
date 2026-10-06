import { NextResponse } from "next/server";
import { toErrorResponse } from "@/lib/api-error";
import { correctAttendance } from "@/lib/server/directory";
import { requireAdmin } from "@/lib/server/session";

export const runtime = "nodejs";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();
    const { id } = await context.params;
    return NextResponse.json(await correctAttendance(id, await request.json(), admin.user.id));
  } catch (error) {
    return toErrorResponse(error);
  }
}
