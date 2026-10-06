import { ApiError } from "@/lib/api-error";

export function publicEnv(): { url: string; anonKey: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new ApiError("Supabase bağlantı bilgileri eksik. .env dosyasını kontrol edin.", 500);
  }
  return { url, anonKey };
}

export function appBaseUrl(request?: Request): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (configured) return configured;
  if (request) return new URL(request.url).origin;
  return "http://localhost:3000";
}
