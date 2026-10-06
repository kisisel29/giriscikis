import { NextResponse } from "next/server";
import { toErrorResponse } from "@/lib/api-error";
import { getSettings, updateSettings } from "@/lib/server/directory";
import { requireAdmin } from "@/lib/server/session";

export const runtime = "nodejs";

export async function GET() {
  try {
    await requireAdmin();
    return NextResponse.json(await getSettings());
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    await requireAdmin();
    return NextResponse.json(await updateSettings(await request.json()));
  } catch (error) {
    return toErrorResponse(error);
  }
}
