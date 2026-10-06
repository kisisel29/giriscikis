import { NextResponse } from "next/server";
import { toErrorResponse } from "@/lib/api-error";
import { handlePairing } from "@/lib/server/pairing";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    return NextResponse.json(await handlePairing(await request.json(), request.headers.get("user-agent")));
  } catch (error) {
    return toErrorResponse(error);
  }
}
