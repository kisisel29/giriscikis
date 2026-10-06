import { NextResponse } from "next/server";
import { toErrorResponse } from "@/lib/api-error";
import { createReason, listReasons } from "@/lib/server/directory";
import { requireAdmin } from "@/lib/server/session";

export const runtime = "nodejs";

export async function GET() {
  try {
    await requireAdmin();
    return NextResponse.json(await listReasons(true));
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin();
    return NextResponse.json(await createReason(await request.json()));
  } catch (error) {
    return toErrorResponse(error);
  }
}
