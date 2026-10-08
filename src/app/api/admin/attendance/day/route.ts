import { NextResponse } from "next/server";
import { toErrorResponse } from "@/lib/api-error";
import { deleteDayAttendance } from "@/lib/server/directory";
import { requireAdmin } from "@/lib/server/session";

export const runtime = "nodejs";

export async function DELETE(request: Request) {
  try {
    const admin = await requireAdmin();
    const url = new URL(request.url);
    const date = url.searchParams.get("date") ?? "";
    const employeeId = url.searchParams.get("employeeId");
    return NextResponse.json(await deleteDayAttendance(date, admin.user.id, employeeId));
  } catch (error) {
    return toErrorResponse(error);
  }
}
