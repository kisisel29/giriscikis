import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { ApiError } from "@/lib/api-error";
import { publicEnv } from "@/lib/env";

export function createAdminClient(): SupabaseClient {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new ApiError("Sunucu Supabase anahtarı tanımlı değil.", 500);
  }
  const { url } = publicEnv();
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function pairingPepper(): string {
  const pepper = process.env.PAIRING_CODE_PEPPER;
  if (!pepper || pepper.length < 16) {
    throw new ApiError("Eşleştirme anahtarı sunucuda tanımlı değil.", 500);
  }
  return pepper;
}
