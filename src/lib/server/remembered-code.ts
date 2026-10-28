import "server-only";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ApiError, toErrorResponse } from "@/lib/api-error";

const COOKIE = "isyeri-kod";

export async function withRememberedCode(body: unknown): Promise<unknown> {
  if (!body || typeof body !== "object" || Array.isArray(body)) return body;
  const record = body as Record<string, unknown>;
  if (typeof record.employeeCode === "string" && record.employeeCode.trim()) return body;
  const saved = (await cookies()).get(COOKIE)?.value ?? "";
  if (!/^\d{3}$/.test(saved)) return body;
  return { ...record, employeeCode: saved };
}

export function rememberCodeCookie(response: NextResponse, payload: unknown) {
  if (!payload || typeof payload !== "object") return response;
  const record = payload as { employeeCode?: unknown; deviceUses?: unknown };
  const code = typeof record.employeeCode === "string" ? record.employeeCode : "";
  const uses = typeof record.deviceUses === "number" ? record.deviceUses : 0;
  if (/^\d{3}$/.test(code) && uses > 3) {
    response.cookies.set(COOKIE, code, {
      maxAge: 60 * 60 * 24 * 400,
      path: "/",
      sameSite: "lax",
      secure: true,
      httpOnly: true,
    });
  }
  return response;
}

export function attendanceError(error: unknown) {
  const response = toErrorResponse(error);
  if (error instanceof ApiError && error.message === "Personel kodu bulunamadı.") {
    response.cookies.set(COOKIE, "", {
      maxAge: 0,
      path: "/",
      sameSite: "lax",
      secure: true,
      httpOnly: true,
    });
  }
  return response;
}
