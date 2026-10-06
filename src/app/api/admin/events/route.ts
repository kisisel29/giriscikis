import { NextResponse } from "next/server";
import { toErrorResponse } from "@/lib/api-error";
import { getEvents } from "@/lib/server/reporting";
import { requireAdmin } from "@/lib/server/session";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    await requireAdmin();
    return NextResponse.json(await getEvents(new URL(request.url).searchParams));
  } catch (error) {
    return toErrorResponse(error);
  }
}
