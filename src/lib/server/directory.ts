import "server-only";
import { ApiError } from "@/lib/api-error";
import { buildAuditEntry } from "@/lib/attendance/audit";
import type { ExitCategory, ExitReasonOption } from "@/lib/attendance/types";
import { appBaseUrl } from "@/lib/env";
import { generatePairingCode, hashPairingCode, PAIRING_TTL_MS } from "@/lib/pairing";
import { pairingPepper } from "@/lib/supabase/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeEmployeeCode, parseCustomExitReason, sanitizePlainText, slugCode } from "@/lib/text";
import { correctionSchema, employeeSchema, exitReasonSchema, nfcTagSchema, parseBody, settingsSchema } from "@/lib/validation";
import {
  asRow,
  mapEmployee,
  mapEvent,
  mapReason,
  mapSettings,
  mapTag,
  str,
  strNull,
  unwrap,
  type Employee,
} from "@/lib/server/rows";
import QRCode from "qrcode";

const EVENT_COLUMNS =
  "id, employee_id, event_type, event_time, exit_reason_id, exit_category, custom_exit_reason, nfc_tag_id, note, location_verified, distance_meters, location_accuracy, created_at, corrected_at, corrected_by, exit_reasons(name)";

async function qr(text: string): Promise<string> {
  return QRCode.toDataURL(text, { margin: 1, width: 280 });
}

export async function tagPayload(tag: ReturnType<typeof mapTag>, request?: Request) {
  const url = `${appBaseUrl(request)}/nfc/${tag.publicId}`;
  return { ...tag, url, qr: await qr(url) };
}

export async function listEmployees(): Promise<Employee[]> {
  const admin = createAdminClient();
  const result = await admin.from("employees").select("*").order("full_name");
  return (unwrap(result) ?? []).map(mapEmployee);
}

export async function createEmployee(body: unknown): Promise<Employee> {
  const input = parseBody(employeeSchema, body);
  const admin = createAdminClient();
  const result = await admin
    .from("employees")
    .insert({
      employee_code: normalizeEmployeeCode(input.employeeCode),
      full_name: input.fullName,
      department: input.department || null,
      title: input.title || null,
      work_start_time: input.workStart,
      work_end_time: input.workEnd,
      max_devices: input.maxDevices ?? 1,
      active: input.active ?? true,
    })
    .select("*")
    .single();
  return mapEmployee(unwrap(result));
}

export async function updateEmployee(id: string, body: unknown): Promise<Employee> {
  const input = parseBody(employeeSchema.partial(), body);
  const patch: Record<string, unknown> = {};
  if (input.employeeCode) patch.employee_code = normalizeEmployeeCode(input.employeeCode);
  if (input.fullName) patch.full_name = input.fullName;
  if (input.department !== undefined) patch.department = input.department || null;
  if (input.title !== undefined) patch.title = input.title || null;
  if (input.workStart) patch.work_start_time = input.workStart;
  if (input.workEnd) patch.work_end_time = input.workEnd;
  if (input.maxDevices) patch.max_devices = input.maxDevices;
  if (input.active !== undefined) patch.active = input.active;
  const admin = createAdminClient();
  const result = await admin.from("employees").update(patch).eq("id", id).select("*").maybeSingle();
  const data = unwrap(result);
  if (!data) throw new ApiError("Personel bulunamadı.", 404);
  return mapEmployee(data);
}

export async function listDevices(employeeId: string) {
  const admin = createAdminClient();
  const result = await admin
    .from("employee_devices")
    .select("id, device_name, active, paired_at, last_seen_at")
    .eq("employee_id", employeeId)
    .order("paired_at", { ascending: false });
  return (unwrap(result) ?? []).map((value) => {
    const record = asRow(value);
    return {
      id: str(record, "id"),
      deviceName: strNull(record, "device_name"),
      active: record.active === true,
      pairedAt: str(record, "paired_at"),
      lastSeenAt: strNull(record, "last_seen_at"),
    };
  });
}

export async function deactivateDevice(employeeId: string, deviceId: string) {
  const admin = createAdminClient();
  const result = await admin
    .from("employee_devices")
    .update({ active: false })
    .eq("id", deviceId)
    .eq("employee_id", employeeId)
    .select("id")
    .maybeSingle();
  if (!unwrap(result)) throw new ApiError("Cihaz bulunamadı.", 404);
}

export async function issuePairingCode(employeeId: string) {
  const admin = createAdminClient();
  const employee = unwrap(await admin.from("employees").select("id, active").eq("id", employeeId).maybeSingle());
  if (!employee) throw new ApiError("Personel bulunamadı.", 404);
  const now = new Date().toISOString();
  await admin.from("pairing_codes").update({ expires_at: now }).eq("employee_id", employeeId).is("used_at", null);
  const code = generatePairingCode();
  const expires = new Date(Date.now() + PAIRING_TTL_MS).toISOString();
  const inserted = await admin.from("pairing_codes").insert({
    employee_id: employeeId,
    code_hash: hashPairingCode(code, pairingPepper()),
    expires_at: expires,
  });
  if (inserted.error) {
    console.error(inserted.error);
    throw new ApiError("Eşleştirme kodu oluşturulamadı.", 500);
  }
  return { code, expiresAt: expires };
}

export async function listTags(request?: Request) {
  const admin = createAdminClient();
  const rows = (unwrap(await admin.from("nfc_tags").select("*").order("created_at")) ?? []).map(mapTag);
  return Promise.all(rows.map((tag) => tagPayload(tag, request)));
}

export async function createTag(body: unknown, request?: Request) {
  const input = parseBody(nfcTagSchema, body);
  const admin = createAdminClient();
  const created = mapTag(
    unwrap(
      await admin
        .from("nfc_tags")
        .insert({
          name: input.name,
          location_name: input.locationName || null,
          mode: input.mode,
          active: input.active ?? true,
        })
        .select("*")
        .single(),
    ),
  );
  return tagPayload(created, request);
}

export async function updateTag(id: string, body: unknown, request?: Request) {
  const input = parseBody(nfcTagSchema.partial(), body);
  const patch: Record<string, unknown> = {};
  if (input.name) patch.name = input.name;
  if (input.locationName !== undefined) patch.location_name = input.locationName || null;
  if (input.mode) patch.mode = input.mode;
  if (input.active !== undefined) patch.active = input.active;
  const admin = createAdminClient();
  const data = unwrap(await admin.from("nfc_tags").update(patch).eq("id", id).select("*").maybeSingle());
  if (!data) throw new ApiError("NFC etiketi bulunamadı.", 404);
  return tagPayload(mapTag(data), request);
}

export async function listReasons(includeInactive = true): Promise<ExitReasonOption[]> {
  const admin = createAdminClient();
  let query = admin.from("exit_reasons").select("*").order("sort_order");
  if (!includeInactive) query = query.eq("active", true);
  return (unwrap(await query) ?? []).map(mapReason);
}

export async function createReason(body: unknown): Promise<ExitReasonOption> {
  const input = parseBody(exitReasonSchema, body);
  const admin = createAdminClient();
  const base = input.code ? slugCode(input.code) : slugCode(input.name);
  let code = base;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const exists = unwrap(await admin.from("exit_reasons").select("id").eq("code", code).maybeSingle());
    if (!exists) break;
    code = `${base.slice(0, 36)}_${attempt + 2}`;
  }
  return mapReason(
    unwrap(
      await admin
        .from("exit_reasons")
        .insert({
          code,
          name: input.name,
          category: input.category,
          allow_note: input.allowNote ?? true,
          sort_order: input.sortOrder ?? 100,
          active: input.active ?? true,
        })
        .select("*")
        .single(),
    ),
  );
}

export async function updateReason(id: string, body: unknown): Promise<ExitReasonOption> {
  const input = parseBody(exitReasonSchema.partial(), body);
  const admin = createAdminClient();
  const current = unwrap(await admin.from("exit_reasons").select("*").eq("id", id).maybeSingle());
  if (!current) throw new ApiError("Çıkış nedeni bulunamadı.", 404);
  const existing = mapReason(current);
  if (existing.code === "END_OF_DAY") {
    if (input.active === false) throw new ApiError("Mesai sonu nedeni pasif yapılamaz.", 409);
    if (input.category && input.category !== "END_OF_DAY") {
      throw new ApiError("Mesai sonu nedeninin türü değiştirilemez.", 409);
    }
  }
  const patch: Record<string, unknown> = {};
  if (input.name) patch.name = input.name;
  if (input.category) patch.category = input.category;
  if (input.allowNote !== undefined) patch.allow_note = input.allowNote;
  if (input.sortOrder !== undefined) patch.sort_order = input.sortOrder;
  if (input.active !== undefined) patch.active = input.active;
  const data = unwrap(await admin.from("exit_reasons").update(patch).eq("id", id).select("*").maybeSingle());
  if (!data) throw new ApiError("Çıkış nedeni bulunamadı.", 404);
  return mapReason(data);
}

export async function deleteReason(id: string): Promise<void> {
  const admin = createAdminClient();
  const current = unwrap(await admin.from("exit_reasons").select("*").eq("id", id).maybeSingle());
  if (!current) throw new ApiError("Çıkış nedeni bulunamadı.", 404);
  const existing = mapReason(current);
  if (existing.code === "END_OF_DAY") {
    throw new ApiError("Mesai sonu nedeni silinemez. Adını düzenleyebilirsiniz.", 409);
  }
  const used = await admin.from("attendance_events").select("id", { count: "exact", head: true }).eq("exit_reason_id", id);
  if (used.error) throw new ApiError("Veritabanı işlemi başarısız.", 500);
  if ((used.count ?? 0) > 0) {
    throw new ApiError("Bu neden geçmiş çıkışlarda kullanılıyor. Silinemez; düzenleyip pasif yapabilirsiniz.", 409);
  }
  const removed = await admin.from("exit_reasons").delete().eq("id", id);
  if (removed.error) throw new ApiError("Veritabanı işlemi başarısız.", 500);
}

export async function getSettings() {
  const admin = createAdminClient();
  const data = unwrap(await admin.from("organization_settings").select("*").limit(1).maybeSingle());
  if (!data) throw new ApiError("Kurulum tamamlanmamış.", 409);
  return mapSettings(data);
}

export async function updateSettings(body: unknown) {
  const input = parseBody(settingsSchema, body);
  const current = await getSettings();
  const admin = createAdminClient();
  const data = unwrap(
    await admin
      .from("organization_settings")
      .update({
        organization_name: input.organizationName,
        latitude: input.latitude,
        longitude: input.longitude,
        allowed_radius_meters: input.allowedRadiusMeters,
        location_verification_required: input.locationVerificationRequired,
        timezone: input.timezone,
        default_work_start: input.defaultWorkStart,
        default_work_end: input.defaultWorkEnd,
        duplicate_window_seconds: input.duplicateWindowSeconds,
        end_of_day_suggestion_minutes: input.endOfDaySuggestionMinutes,
        store_raw_coordinates: input.storeRawCoordinates,
      })
      .eq("id", current.id)
      .select("*")
      .single(),
  );
  return mapSettings(data);
}

export async function employeeHistory(employeeId: string) {
  const admin = createAdminClient();
  const rows = unwrap(
    await admin
      .from("attendance_events")
      .select(EVENT_COLUMNS)
      .eq("employee_id", employeeId)
      .order("event_time", { ascending: false })
      .limit(200),
  );
  return (rows ?? []).map(mapEvent);
}

export async function correctAttendance(id: string, body: unknown, adminUserId: string) {
  const input = parseBody(correctionSchema, body);
  const when = new Date(input.eventTime);
  if (when.getTime() > Date.now() + 5 * 60_000) {
    throw new ApiError("Gelecek bir saat kaydedilemez.", 400);
  }
  const custom = parseCustomExitReason(input.customExitReason);
  const note = sanitizePlainText(input.note, { min: 1, max: 500, label: "Not" });
  let exitCategory: ExitCategory | null = input.exitCategory ?? null;
  if (input.eventType === "ENTRY" || input.eventType === "RETURN") {
    exitCategory = null;
  } else if (input.eventType === "END_OF_DAY") {
    exitCategory = "END_OF_DAY";
  } else if (!exitCategory) {
    exitCategory = "OTHER";
  }
  if ((input.eventType === "EXIT" || input.eventType === "END_OF_DAY") && !input.exitReasonId && !custom) {
    throw new ApiError("Çıkış kaydında hazır neden veya açıklama bulunmalıdır.", 400);
  }
  const admin = createAdminClient();
  const existing = unwrap(await admin.from("attendance_events").select("*").eq("id", id).maybeSingle());
  if (!existing) throw new ApiError("Hareket bulunamadı.", 404);
  const updated = unwrap(
    await admin
      .from("attendance_events")
      .update({
        event_type: input.eventType,
        event_time: when.toISOString(),
        exit_reason_id: input.eventType === "ENTRY" || input.eventType === "RETURN" ? null : input.exitReasonId ?? null,
        custom_exit_reason: input.eventType === "ENTRY" || input.eventType === "RETURN" ? null : custom,
        exit_category: exitCategory,
        note,
        corrected_at: new Date().toISOString(),
        corrected_by: adminUserId,
      })
      .eq("id", id)
      .select("*")
      .single(),
  );
  const audit = buildAuditEntry({
    adminUserId,
    action: "UPDATE",
    tableName: "attendance_events",
    recordId: id,
    oldData: existing,
    newData: updated,
    reason: input.reason,
  });
  const logged = await admin.from("audit_logs").insert(audit);
  if (logged.error) {
    console.error(logged.error);
    throw new ApiError("Kayıt değişti ancak denetim günlüğü yazılamadı.", 500);
  }
  return mapEvent({ ...asRow(updated), exit_reasons: null });
}

export async function listAudit() {
  const admin = createAdminClient();
  const rows = unwrap(await admin.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(200));
  return (rows ?? []).map((value) => {
    const record = asRow(value);
    return {
      id: str(record, "id"),
      adminUserId: str(record, "admin_user_id"),
      action: str(record, "action"),
      tableName: str(record, "table_name"),
      recordId: str(record, "record_id"),
      oldData: record.old_data ?? null,
      newData: record.new_data ?? null,
      reason: str(record, "reason"),
      createdAt: str(record, "created_at"),
    };
  });
}
