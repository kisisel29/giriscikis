"use client";

import { createBrowserClient } from "@supabase/ssr";

export function createBrowserSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error("Supabase bağlantı bilgileri eksik.");
  }
  return createBrowserClient(url, anonKey);
}

export async function ensureDeviceSession() {
  const supabase = createBrowserSupabase();
  const { data } = await supabase.auth.getSession();
  if (!data.session) {
    const { error } = await supabase.auth.signInAnonymously();
    if (error) {
      throw new Error("Cihaz oturumu açılamadı. Supabase anonim girişini açın.");
    }
  }
  return supabase;
}
