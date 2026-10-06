import { NextResponse } from "next/server";
import { toErrorResponse } from "@/lib/api-error";
import { deactivateDevice } from "@/lib/server/directory";
import { requireAdmin } from "@/lib/server/session";

export const runtime = "nodejs";

export async function DELETE(_request: Request, context: { params: Promise<{ id: string; deviceId: string }> }) {
  try {
    await requireAdmin();
    const { id, deviceId } = await context.params;
    await deactivateDevice(id, deviceId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return toErrorResponse(error);
  }
}
