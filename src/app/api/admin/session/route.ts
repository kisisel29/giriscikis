import { NextResponse } from "next/server";
import { toErrorResponse } from "@/lib/api-error";
import { requireAdmin } from "@/lib/server/session";

export const runtime = "nodejs";

export async function GET() {
  try {
    const admin = await requireAdmin();
    return NextResponse.json({ fullName: admin.fullName, email: admin.email });
  } catch (error) {
    return toErrorResponse(error);
  }
}
