import { NextResponse } from "next/server";
import { toErrorResponse } from "@/lib/api-error";
import { getMyStatus } from "@/lib/server/attendance";

export const runtime = "nodejs";

export async function GET() {
  try {
    return NextResponse.json(await getMyStatus());
  } catch (error) {
    return toErrorResponse(error);
  }
}
