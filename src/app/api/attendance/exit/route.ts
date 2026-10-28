import { NextResponse } from "next/server";
import { handleExit } from "@/lib/server/attendance";
import { attendanceError, rememberCodeCookie, withRememberedCode } from "@/lib/server/remembered-code";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const payload = await handleExit(await withRememberedCode(await request.json()));
    return rememberCodeCookie(NextResponse.json(payload), payload);
  } catch (error) {
    return attendanceError(error);
  }
}
