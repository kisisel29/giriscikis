import "server-only";
import type { User } from "@supabase/supabase-js";
import { ApiError } from "@/lib/api-error";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerSupabase } from "@/lib/supabase/server";
import { asRow, str, unwrap } from "@/lib/server/rows";

export async function requireUser(): Promise<User> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    throw new ApiError("Oturum bulunamadı. Sayfayı yenileyip tekrar deneyin.", 401);
  }
  return data.user;
}

export type PanelRole = "admin" | "viewer";

export async function requirePanel(): Promise<{ user: User; fullName: string; email: string; role: PanelRole }> {
  const user = await requireUser();
  const viewer = user.app_metadata?.role === "viewer";
  const admin = createAdminClient();
  const result = await admin
    .from("admin_users")
    .select("full_name, email, active")
    .eq("auth_user_id", user.id)
    .eq("active", true)
    .maybeSingle();
  const data = unwrap(result);
  if (data) {
    const record = asRow(data);
    return {
      user,
      fullName: str(record, "full_name"),
      email: str(record, "email"),
      role: viewer ? "viewer" : "admin",
    };
  }
  if (viewer) {
    const named = user.user_metadata?.full_name;
    return {
      user,
      fullName: typeof named === "string" && named.trim() ? named : "İzleme",
      email: user.email ?? "",
      role: "viewer",
    };
  }
  throw new ApiError("Bu işlem için yönetici yetkisi gerekir.", 403);
}

export async function requireAdmin(): Promise<{ user: User; fullName: string; email: string; role: PanelRole }> {
  const panel = await requirePanel();
  if (panel.role !== "admin") throw new ApiError("Bu işlem için yönetici yetkisi gerekir.", 403);
  return panel;
}

export async function assertRateLimit(authUserId: string): Promise<void> {
  const admin = createAdminClient();
  const since = new Date(Date.now() - 60_000).toISOString();
  const counted = await admin
    .from("attendance_attempts")
    .select("id", { count: "exact", head: true })
    .eq("auth_user_id", authUserId)
    .gte("created_at", since);
  if (counted.error) {
    console.error(counted.error);
    throw new ApiError("İstek sınırı kontrol edilemedi.", 500);
  }
  if ((counted.count ?? 0) >= 20) {
    throw new ApiError("Çok fazla deneme yapıldı. Lütfen bir dakika sonra tekrar deneyin.", 429);
  }
  const inserted = await admin.from("attendance_attempts").insert({ auth_user_id: authUserId });
  if (inserted.error) console.error(inserted.error);
  const old = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  void admin.from("attendance_attempts").delete().eq("auth_user_id", authUserId).lt("created_at", old);
}
