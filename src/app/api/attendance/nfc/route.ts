import { NextResponse } from "next/server";
import { toErrorResponse } from "@/lib/api-error";
import { handleNfcTap } from "@/lib/server/attendance";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    return NextResponse.json(await handleNfcTap(await request.json()));
  } catch (error) {
    return toErrorResponse(error);
  }
}
