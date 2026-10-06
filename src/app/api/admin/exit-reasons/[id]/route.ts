import { NextResponse } from "next/server";
import { toErrorResponse } from "@/lib/api-error";
import { deleteReason, updateReason } from "@/lib/server/directory";
import { requireAdmin } from "@/lib/server/session";

export const runtime = "nodejs";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await context.params;
    return NextResponse.json(await updateReason(id, await request.json()));
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await context.params;
    await deleteReason(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return toErrorResponse(error);
  }
}
