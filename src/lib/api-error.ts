import { NextResponse } from "next/server";

export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function toErrorResponse(error: unknown): NextResponse {
  if (error instanceof ApiError) {
    return NextResponse.json({ error: error.message, code: error.code ?? null }, { status: error.status });
  }
  if (error instanceof SyntaxError) {
    return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });
  }
  if (error instanceof Error && /düz metin|karakter|neden|kodu/i.test(error.message)) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  console.error(error);
  return NextResponse.json({ error: "Beklenmeyen bir hata oluştu." }, { status: 500 });
}
