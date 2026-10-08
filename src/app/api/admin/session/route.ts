import { NextResponse } from "next/server";
import { toErrorResponse } from "@/lib/api-error";
import { requirePanel } from "@/lib/server/session";

export const runtime = "nodejs";

export async function GET() {
  try {
    const panel = await requirePanel();
    return NextResponse.json({ fullName: panel.fullName, email: panel.email, role: panel.role });
  } catch (error) {
    return toErrorResponse(error);
  }
}
