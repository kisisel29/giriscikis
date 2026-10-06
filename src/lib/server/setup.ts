import "server-only";
import QRCode from "qrcode";
import { ApiError } from "@/lib/api-error";
import { appBaseUrl } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeEmployeeCode } from "@/lib/text";
import { parseBody, setupSchema } from "@/lib/validation";
import { mapTag, unwrap } from "@/lib/server/rows";

export async function setupStatus() {
  const admin = createAdminClient();
  const settingsResult = await admin.from("organization_settings").select("organization_name").limit(1).maybeSingle();
  if (settingsResult.error) throw new ApiError("Kurulum durumu okunamadı.", 500);
  const adminResult = await admin.from("admin_users").select("id", { count: "exact", head: true });
  if (adminResult.error) throw new ApiError("Kurulum durumu okunamadı.", 500);
  const settings = settingsResult.data;
  const name =
    settings && typeof settings === "object" && "organization_name" in settings
      ? String((settings as { organization_name?: unknown }).organization_name ?? "")
      : null;
  return {
    complete: Boolean(settings) && (adminResult.count ?? 0) > 0,
    organizationName: name,
  };
}

async function adminCount(): Promise<number> {
  const admin = createAdminClient();
  const result = await admin.from("admin_users").select("id", { count: "exact", head: true });
  if (result.error) throw new ApiError("Kurulum durumu okunamadı.", 500);
  return result.count ?? 0;
}

export async function runSetup(body: unknown, request: Request) {
  if ((await adminCount()) > 0) {
    throw new ApiError("Kurulum zaten tamamlanmış.", 409);
  }
  const input = parseBody(setupSchema, body);
  const admin = createAdminClient();
  const settings = unwrap(
    await admin
      .from("organization_settings")
      .upsert(
        {
          singleton: true,
          organization_name: input.organizationName,
          latitude: input.latitude,
          longitude: input.longitude,
          allowed_radius_meters: input.allowedRadiusMeters,
          location_verification_required: false,
          timezone: "Europe/Istanbul",
          default_work_start: input.workStart,
          default_work_end: input.workEnd,
          duplicate_window_seconds: 30,
          end_of_day_suggestion_minutes: 30,
          store_raw_coordinates: false,
        },
        { onConflict: "singleton" },
      )
      .select("id")
      .single(),
  );
  if (!settings) throw new ApiError("Kurum ayarları kaydedilemedi.", 500);

  async function ensureTag(mode: "ENTRY" | "EXIT", name: string, location: string | null | undefined) {
    const existing = unwrap(
      await admin.from("nfc_tags").select("*").eq("mode", mode).eq("active", true).order("created_at").limit(1).maybeSingle(),
    );
    if (existing) return mapTag(existing);
    return mapTag(
      unwrap(
        await admin
          .from("nfc_tags")
          .insert({ name, location_name: location || null, mode, active: true })
          .select("*")
          .single(),
      ),
    );
  }

  const entry = await ensureTag("ENTRY", input.entryTagName, input.entryLocation);
  const exit = await ensureTag("EXIT", input.exitTagName, input.exitLocation);
  const base = appBaseUrl(request);
  const entryUrl = `${base}/nfc/${entry.publicId}`;
  const exitUrl = `${base}/nfc/${exit.publicId}`;

  const createdUser = await admin.auth.admin.createUser({
    email: input.adminEmail,
    password: input.adminPassword,
    email_confirm: true,
    user_metadata: { full_name: input.adminName },
  });
  let adminAuthId = createdUser.data.user?.id ?? null;
  if (!adminAuthId) {
    const listed = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    adminAuthId = listed.data.users.find((user) => user.email?.toLowerCase() === input.adminEmail.toLowerCase())?.id ?? null;
  }
  if (!adminAuthId) {
    throw new ApiError("Yönetici hesabı oluşturulamadı.", 400);
  }
  const adminRow = await admin.from("admin_users").insert({
    auth_user_id: adminAuthId,
    email: input.adminEmail,
    full_name: input.adminName,
    active: true,
  });
  if (adminRow.error) {
    console.error(adminRow.error);
    throw new ApiError("Yönetici kaydı yazılamadı.", 500);
  }

  const code = normalizeEmployeeCode(input.employeeCode);
  let employee = unwrap(await admin.from("employees").select("id, full_name").eq("employee_code", code).maybeSingle());
  if (!employee) {
    employee = unwrap(
      await admin
        .from("employees")
        .insert({
          employee_code: code,
          full_name: input.employeeName,
          department: input.department || null,
          title: input.title || null,
          work_start_time: input.workStart,
          work_end_time: input.workEnd,
          max_devices: 1,
          active: true,
        })
        .select("id, full_name")
        .single(),
    );
  }
  const employeeId = employee && typeof employee === "object" && "id" in employee ? String((employee as { id: unknown }).id) : "";
  if (!employeeId) throw new ApiError("Personel kaydı oluşturulamadı.", 500);

  return {
    organizationName: input.organizationName,
    entry: { name: entry.name, url: entryUrl, qr: await QRCode.toDataURL(entryUrl, { margin: 1, width: 280 }) },
    exit: { name: exit.name, url: exitUrl, qr: await QRCode.toDataURL(exitUrl, { margin: 1, width: 280 }) },
    employeeCode: code,
  };
}
