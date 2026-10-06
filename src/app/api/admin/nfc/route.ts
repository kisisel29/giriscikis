import { NextResponse } from "next/server";
import { toErrorResponse } from "@/lib/api-error";
import { createTag, listTags } from "@/lib/server/directory";
import { requireAdmin } from "@/lib/server/session";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    await requireAdmin();
    return NextResponse.json(await listTags(request));
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin();
    return NextResponse.json(await createTag(await request.json(), request));
  } catch (error) {
    return toErrorResponse(error);
  }
}
