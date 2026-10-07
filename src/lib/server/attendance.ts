import "server-only";
import { ApiError } from "@/lib/api-error";
import { assessExit, assessNfc, assessReentry, isFirstArrival, orderExitReasons, recordedMessage, resolveExitRecord, shouldAskLateReason } from "@/lib/attendance/assess";
import { deriveCurrentPresence, eventsOnDay } from "@/lib/attendance/state";
import { calculateDay } from "@/lib/attendance/calculations";
import { measureLocation } from "@/lib/attendance/location";
import { isDeviceRecognized } from "@/lib/attendance/trust";
import { linkDevice } from "@/lib/server/pairing";
import { describeMovement, greeting, STATE_LABELS } from "@/lib/attendance/labels";
import type { DomainEvent, ExitReasonOption, LocationFix, NfcAssessment, NfcSuccessResponse } from "@/lib/attendance/types";
import { sanitizePlainText } from "@/lib/text";
import { clockToMinutes, dayKey, formatDuration, formatTime, previousDayKey, safeTimeZone, shouldSuggestEndOfDay, startOfDay } from "@/lib/time";
import { createAdminClient } from "@/lib/supabase/admin";
import { exitBodySchema, nfcBodySchema, parseBody } from "@/lib/validation";
import { mapEmployee, mapEvent, mapReason, mapSettings, mapTag, unwrap, type Employee, type NfcTag, type Settings } from "@/lib/server/rows";
import { assertRateLimit, requireUser } from "@/lib/server/session";

const EVENT_COLUMNS =
  "id, employee_id, event_type, event_time, exit_category, custom_exit_reason, nfc_tag_id, exit_reasons(name)";

async function loadSettings(): Promise<Settings> {
  const admin = createAdminClient();
  const result = await admin.from("organization_settings").select("*").limit(1).maybeSingle();
  const data = unwrap(result);
  if (!data) throw new ApiError("Kurulum tamamlanmamış. Yönetici kurulum sihirbazını çalıştırmalı.", 409);
  return mapSettings(data);
}

async function loadTag(publicId: string): Promise<NfcTag | null> {
  const admin = createAdminClient();
  const result = await admin.from("nfc_tags").select("*").eq("public_id", publicId).maybeSingle();
  const data = unwrap(result);
  return data ? mapTag(data) : null;
}

async function loadDevice(authUserId: string): Promise<{ id: string; employeeId: string } | null> {
  const admin = createAdminClient();
  const result = await admin
    .from("employee_devices")
    .select("id, employee_id")
    .eq("auth_user_id", authUserId)
    .eq("active", true)
    .maybeSingle();
  const data = unwrap(result);
  if (!data || typeof data !== "object") return null;
  const record = data as { id?: unknown; employee_id?: unknown };
  if (typeof record.id !== "string" || typeof record.employee_id !== "string") return null;
  return { id: record.id, employeeId: record.employee_id };
}

async function loadEmployee(id: string): Promise<Employee> {
  const admin = createAdminClient();
  const result = await admin.from("employees").select("*").eq("id", id).maybeSingle();
  const data = unwrap(result);
  if (!data) throw new ApiError("Personel kaydı bulunamadı.", 404);
  return mapEmployee(data);
}

async function loadRecentEvents(employeeId: string, now: Date, timeZone: string): Promise<DomainEvent[]> {
  const since = startOfDay(new Date(startOfDay(now, timeZone).getTime() - 60_000), timeZone).toISOString();
  const admin = createAdminClient();
  const result = await admin
    .from("attendance_events")
    .select(EVENT_COLUMNS)
    .eq("employee_id", employeeId)
    .gte("event_time", since)
    .order("event_time", { ascending: true });
  return (unwrap(result) ?? []).map(mapEvent);
}

async function loadActiveReasons(): Promise<ExitReasonOption[]> {
  const admin = createAdminClient();
  const result = await admin.from("exit_reasons").select("*").eq("active", true).order("sort_order");
  return (unwrap(result) ?? []).map(mapReason);
}

function locationOf(
  settings: Settings,
  input: { latitude: number | null; longitude: number | null; accuracy: number | null },
): LocationFix {
  return measureLocation({
    siteLat: settings.latitude,
    siteLon: settings.longitude,
    allowedRadius: settings.allowedRadiusMeters,
    latitude: input.latitude,
    longitude: input.longitude,
    accuracy: input.accuracy,
  });
}

async function isDuplicate(employeeId: string, tagId: string, windowSeconds: number): Promise<boolean> {
  const admin = createAdminClient();
  const since = new Date(Date.now() - windowSeconds * 1000).toISOString();
  const result = await admin
    .from("attendance_events")
    .select("id")
    .eq("employee_id", employeeId)
    .eq("nfc_tag_id", tagId)
    .gte("event_time", since)
    .limit(1);
  return (unwrap(result) ?? []).length > 0;
}

function failure(assessment: NfcAssessment): NfcSuccessResponse | null {
  switch (assessment.action) {
    case "TAG_UNKNOWN":
      throw new ApiError("NFC etiketi tanınmadı.", 404);
    case "TAG_INACTIVE":
      throw new ApiError("Bu NFC etiketi aktif değil.", 403);
    case "EMPLOYEE_INACTIVE":
      throw new ApiError("Personel kaydınız pasif. Yönetici ile görüşün.", 403);
    case "LOCATION_MISSING":
    case "LOCATION_INACCURATE":
      throw new ApiError("Konumunuz doğrulanamadı. Telefonunuzun konum iznini açıp tekrar deneyin.", 400);
    case "LOCATION_OUTSIDE":
      throw new ApiError("İşlem kurum konumu dışında olduğunuz için kaydedilemedi.", 400);
    case "PAIR_REQUIRED":
      return { action: "PAIR_REQUIRED", message: "Personel kodunuzu girin." };
    default:
      return null;
  }
}

function lastExit(events: DomainEvent[], now: Date, timeZone: string, workEnd: string) {
  const presence = deriveCurrentPresence(events, now, timeZone, workEnd);
  if (presence.assumedExit) {
    return {
      time: formatTime(presence.assumedExit, timeZone),
      label: "Mesai sonu",
      detail: "Çıkış kaydı olmadığı için mesai bitişinde çıkmış kabul edildi.",
    };
  }
  const key = presence.carried ? previousDayKey(now, timeZone) : dayKey(now, timeZone);
  const dayEvents = eventsOnDay(events, key, timeZone);
  const event = [...dayEvents].reverse().find((item) => item.eventType === "EXIT" || item.eventType === "END_OF_DAY");
  if (!event) return null;
  const described = describeMovement(event, timeZone);
  return { time: described.time, label: described.title, detail: described.detail };
}

async function touchDevice(deviceId: string) {
  const admin = createAdminClient();
  await admin.from("employee_devices").update({ last_seen_at: new Date().toISOString() }).eq("id", deviceId);
}

async function insertEvent(input: {
  employeeId: string;
  eventType: "ENTRY" | "RETURN" | "EXIT" | "END_OF_DAY";
  tagId: string;
  settings: Settings;
  location: LocationFix;
  latitude: number | null;
  longitude: number | null;
  exitReasonId?: string | null;
  customExitReason?: string | null;
  exitCategory?: string | null;
}) {
  const admin = createAdminClient();
  const result = await admin
    .from("attendance_events")
    .insert({
      employee_id: input.employeeId,
      event_type: input.eventType,
      nfc_tag_id: input.tagId,
      exit_reason_id: input.exitReasonId ?? null,
      custom_exit_reason: input.customExitReason ?? null,
      exit_category: input.exitCategory ?? null,
      location_verified: input.location.verified,
      distance_meters: input.location.distanceMeters,
      location_accuracy: input.location.accuracy,
      latitude: input.settings.storeRawCoordinates ? input.latitude : null,
      longitude: input.settings.storeRawCoordinates ? input.longitude : null,
    })
    .select("event_type, event_time")
    .single();
  const data = unwrap(result);
  const record = data as { event_type?: unknown; event_time?: unknown };
  if (typeof record.event_time !== "string" || typeof record.event_type !== "string") {
    throw new ApiError("Kayıt oluşturulamadı.", 500);
  }
  return { eventType: input.eventType, eventTime: record.event_time };
}

type Prepared = {
  settings: Settings;
  timeZone: string;
  now: Date;
  tag: NfcTag | null;
  device: { id: string; employeeId: string } | null;
  employee: Employee | null;
  events: DomainEvent[];
  location: LocationFix;
  duplicate: boolean;
  recognized: boolean;
  confirmed: boolean;
  state: ReturnType<typeof deriveCurrentPresence>;
};

async function recognitionCounts(employeeId: string): Promise<{ entries: number; exits: number }> {
  const admin = createAdminClient();
  const entries = await admin
    .from("attendance_events")
    .select("id", { count: "exact", head: true })
    .eq("employee_id", employeeId)
    .eq("event_type", "ENTRY");
  const exits = await admin
    .from("attendance_events")
    .select("id", { count: "exact", head: true })
    .eq("employee_id", employeeId)
    .in("event_type", ["EXIT", "END_OF_DAY"]);
  if (entries.error || exits.error) throw new ApiError("Veritabanı işlemi başarısız.", 500);
  return { entries: entries.count ?? 0, exits: exits.count ?? 0 };
}

async function prepare(
  userId: string,
  input: { tagPublicId: string; latitude: number | null; longitude: number | null; accuracy: number | null; employeeCode?: string },
): Promise<Prepared> {
  await assertRateLimit(userId);
  const settings = await loadSettings();
  const timeZone = safeTimeZone(settings.timezone);
  const now = new Date();
  const tag = await loadTag(input.tagPublicId);
  let device = await loadDevice(userId);
  if (input.employeeCode) {
    const linked = await linkDevice(userId, input.employeeCode, "Telefon");
    device = linked;
  }
  const employee = device ? await loadEmployee(device.employeeId) : null;
  if (device) await touchDevice(device.id);
  const events = employee ? await loadRecentEvents(employee.id, now, timeZone) : [];
  const counts = employee ? await recognitionCounts(employee.id) : { entries: 0, exits: 0 };
  const recognized = isDeviceRecognized(counts.entries, counts.exits);
  const location = locationOf(settings, input);
  const duplicate = employee && tag ? await isDuplicate(employee.id, tag.id, settings.duplicateWindowSeconds) : false;
  const state = deriveCurrentPresence(events, now, timeZone, employee?.workEnd ?? settings.defaultWorkEnd);
  return {
    settings,
    timeZone,
    now,
    tag,
    device,
    employee,
    events,
    location,
    duplicate,
    recognized,
    confirmed: Boolean(input.employeeCode),
    state,
  };
}

function context(prepared: Prepared) {
  return {
    tag: prepared.tag,
    paired: Boolean(prepared.device && prepared.employee && (prepared.recognized || prepared.confirmed)),
    employeeActive: prepared.employee?.active ?? false,
    locationRequired: false,
    location: prepared.location,
    duplicate: prepared.duplicate,
    state: prepared.state.state,
  };
}

async function respond(prepared: Prepared, assessment: NfcAssessment): Promise<NfcSuccessResponse> {
  const early = failure(assessment);
  if (early) return early;
  const timeZone = prepared.timeZone;
  if (assessment.action === "DUPLICATE") {
    return { action: "DUPLICATE", message: "Bu işlem az önce kaydedildi.", eventTime: null };
  }
  if (assessment.action === "ALREADY_INSIDE") {
    return { action: "ALREADY_INSIDE", message: "Zaten kurumda görünüyorsunuz." };
  }
  if (assessment.action === "ALREADY_OUTSIDE") {
    return {
      action: "ALREADY_OUTSIDE",
      message: "Şu anda kurum dışında görünüyorsunuz.",
      lastExit: lastExit(prepared.events, prepared.now, timeZone, prepared.employee?.workEnd ?? prepared.settings.defaultWorkEnd),
    };
  }
  if (assessment.action === "CONFIRM_REENTRY") {
    return {
      action: "CONFIRM_REENTRY",
      message: "Mesainiz sona ermiş görünüyor. Tekrar giriş yapmak istiyor musunuz?",
    };
  }
  if (assessment.action === "CREATE") {
    throw new ApiError("Kayıt oluşturulamadı.", 500);
  }
  if (assessment.action === "SELECT_EXIT_REASON") {
    const reasons = orderExitReasons(
      await loadActiveReasons(),
      shouldSuggestEndOfDay(
        prepared.now,
        prepared.employee?.workEnd ?? prepared.settings.defaultWorkEnd,
        prepared.settings.endOfDaySuggestionMinutes,
        timeZone,
      ),
    );
    return {
      action: "SELECT_EXIT_REASON",
      suggestEndOfDay: reasons[0]?.code === "END_OF_DAY",
      employeeName: prepared.employee?.fullName ?? "",
      reasons,
    };
  }
  throw new ApiError("İşlem tamamlanamadı.", 400);
}

export async function handleNfcTap(body: unknown): Promise<NfcSuccessResponse> {
  const input = parseBody(nfcBodySchema, body);
  const user = await requireUser();
  const prepared = await prepare(user.id, input);
  const assessment = assessNfc(context(prepared));
  if (assessment.action === "CREATE" && prepared.employee && prepared.tag) {
    const arrival = {
      eventType: assessment.eventType,
      state: prepared.state.state,
      events: prepared.events,
      now: prepared.now,
      timeZone: prepared.timeZone,
    };
    if (shouldAskLateReason(arrival) && !input.lateAnswer) {
      return { action: "ASK_LATE_REASON", message: "Mesaiye geç kalındı. Sebep belirtmek ister misiniz?" };
    }
    const lateReason =
      input.lateAnswer === "yes" ? sanitizePlainText(input.lateReason, { min: 2, max: 250, label: "Geç kalma sebebi" }) : null;
    const saved = await insertEvent({
      employeeId: prepared.employee.id,
      eventType: assessment.eventType,
      tagId: prepared.tag.id,
      settings: prepared.settings,
      location: prepared.location,
      latitude: input.latitude,
      longitude: input.longitude,
      customExitReason: lateReason,
    });
    const morningStart =
      isFirstArrival(arrival) && clockToMinutes(formatTime(saved.eventTime, prepared.timeZone)) >= 7 * 60;
    return {
      action: "RECORDED",
      eventType: saved.eventType,
      eventTime: formatTime(saved.eventTime, prepared.timeZone),
      message: morningStart ? "Mesaiye başladınız" : recordedMessage(saved.eventType),
    };
  }
  return respond(prepared, assessment);
}

export async function handleExit(body: unknown): Promise<NfcSuccessResponse> {
  const input = parseBody(exitBodySchema, body);
  const user = await requireUser();
  const prepared = await prepare(user.id, input);
  const assessment = assessExit(context(prepared));
  if (assessment.action !== "SELECT_EXIT_REASON") return respond(prepared, assessment);
  if (!prepared.employee || !prepared.tag) throw new ApiError("Kayıt oluşturulamadı.", 500);
  const reasons = await loadActiveReasons();
  const preset = input.exitReasonId ? reasons.find((reason) => reason.id === input.exitReasonId) ?? null : null;
  if (input.exitReasonId && !preset) throw new ApiError("Seçilen çıkış nedeni bulunamadı.", 400);
  const resolved = resolveExitRecord({ preset, customRaw: input.customExitReason });
  const saved = await insertEvent({
    employeeId: prepared.employee.id,
    eventType: resolved.eventType,
    tagId: prepared.tag.id,
    settings: prepared.settings,
    location: prepared.location,
    latitude: input.latitude,
    longitude: input.longitude,
    exitReasonId: resolved.exitReasonId,
    customExitReason: resolved.customExitReason,
    exitCategory: resolved.exitCategory,
  });
  return {
    action: "RECORDED",
    eventType: saved.eventType,
    eventTime: formatTime(saved.eventTime, prepared.timeZone),
    message: recordedMessage(saved.eventType),
  };
}

export async function handleReentry(body: unknown): Promise<NfcSuccessResponse> {
  const input = parseBody(nfcBodySchema, body);
  const user = await requireUser();
  const prepared = await prepare(user.id, input);
  const assessment = assessReentry(context(prepared));
  if (assessment.action !== "CREATE") return respond(prepared, assessment);
  if (!prepared.employee || !prepared.tag) throw new ApiError("Kayıt oluşturulamadı.", 500);
  const saved = await insertEvent({
    employeeId: prepared.employee.id,
    eventType: "ENTRY",
    tagId: prepared.tag.id,
    settings: prepared.settings,
    location: prepared.location,
    latitude: input.latitude,
    longitude: input.longitude,
  });
  return {
    action: "RECORDED",
    eventType: "ENTRY",
    eventTime: formatTime(saved.eventTime, prepared.timeZone),
    message: recordedMessage("ENTRY"),
  };
}

export async function getMyStatus() {
  const user = await requireUser();
  const device = await loadDevice(user.id);
  if (!device) return { paired: false as const };
  const employee = await loadEmployee(device.employeeId);
  const settings = await loadSettings();
  const timeZone = safeTimeZone(settings.timezone);
  const now = new Date();
  const events = await loadRecentEvents(employee.id, now, timeZone);
  const todayKey = dayKey(now, timeZone);
  const today = eventsOnDay(events, todayKey, timeZone);
  const presence = deriveCurrentPresence(events, now, timeZone, employee.workEnd);
  const metrics = calculateDay({
    events,
    day: todayKey,
    workStart: employee.workStart,
    workEnd: employee.workEnd,
    lunchStart: employee.lunchStart,
    lunchEnd: employee.lunchEnd,
    now,
    timeZone,
  });
  return {
    paired: true as const,
    organizationName: settings.organizationName,
    greeting: greeting(employee.fullName, now, timeZone),
    fullName: employee.fullName,
    department: employee.department,
    state: presence.state,
    banner: STATE_LABELS[presence.state].banner,
    carried: presence.carried,
    firstEntry: metrics.firstEntry ? formatTime(metrics.firstEntry, timeZone) : null,
    physical: formatDuration(metrics.physicalMs, true),
    duty: formatDuration(metrics.dutyMs, true),
    overtime: metrics.overtimeMs > 0 ? formatDuration(metrics.overtimeMs, true) : null,
    movements: [
      ...today.map((event) => describeMovement(event, timeZone, today)),
      ...(presence.assumedExit
        ? [
            {
              time: formatTime(presence.assumedExit, timeZone),
              title: "Mesai sonu",
              detail: "Çıkış kaydı olmadığı için mesai bitişinde çıkmış kabul edildi.",
            },
          ]
        : []),
    ],
  };
}
