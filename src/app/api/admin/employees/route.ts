import { NextResponse } from "next/server";
import { toErrorResponse } from "@/lib/api-error";
import { createEmployee, listEmployees } from "@/lib/server/directory";
import { requireAdmin } from "@/lib/server/session";

export const runtime = "nodejs";

export async function GET() {
  try {
    await requireAdmin();
    return NextResponse.json(await listEmployees());
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin();
    return NextResponse.json(await createEmployee(await request.json()));
  } catch (error) {
    return toErrorResponse(error);
  }
}
