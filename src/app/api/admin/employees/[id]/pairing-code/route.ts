import { NextResponse } from "next/server";
import { toErrorResponse } from "@/lib/api-error";
import { issuePairingCode } from "@/lib/server/directory";
import { requireAdmin } from "@/lib/server/session";

export const runtime = "nodejs";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await context.params;
    return NextResponse.json(await issuePairingCode(id));
  } catch (error) {
    return toErrorResponse(error);
  }
}
