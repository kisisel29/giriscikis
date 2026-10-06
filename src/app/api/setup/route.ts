import { NextResponse } from "next/server";
import { toErrorResponse } from "@/lib/api-error";
import { runSetup, setupStatus } from "@/lib/server/setup";

export const runtime = "nodejs";

export async function GET() {
  try {
    return NextResponse.json(await setupStatus());
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    return NextResponse.json(await runSetup(await request.json(), request));
  } catch (error) {
    return toErrorResponse(error);
  }
}
