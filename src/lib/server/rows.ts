import "server-only";
import { ApiError } from "@/lib/api-error";
import type { DomainEvent, EventType, ExitCategory, ExitReasonOption, TagMode } from "@/lib/attendance/types";
import { EVENT_TYPES, EXIT_CATEGORIES, TAG_MODES } from "@/lib/attendance/types";

export type Row = Record<string, unknown>;

export type Settings = {
  id: string;
  organizationName: string;
  latitude: number;
  longitude: number;
  allowedRadiusMeters: number;
  locationVerificationRequired: boolean;
  timezone: string;
  defaultWorkStart: string;
  defaultWorkEnd: string;
  lunchStart: string;
  lunchEnd: string;
  duplicateWindowSeconds: number;
  endOfDaySuggestionMinutes: number;
  storeRawCoordinates: boolean;
};

export type Employee = {
  id: string;
  employeeCode: string;
  fullName: string;
  department: string | null;
  title: string | null;
  active: boolean;
  workStart: string;
  workEnd: string;
  lunchStart: string;
  lunchEnd: string;
  maxDevices: number;
};

export type NfcTag = {
  id: string;
  publicId: string;
  name: string;
  locationName: string | null;
  mode: TagMode;
  active: boolean;
};

export function asRow(value: unknown): Row {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ApiError("Beklenmeyen veritabanı yanıtı.", 500);
  }
  return value as Row;
}

export function unwrap<T>(result: { data: T; error: { message: string; code?: string } | null }): T {
  if (result.error) {
    console.error(result.error);
    if (result.error.message.includes("DUPLICATE_EVENT") || result.error.code === "P0001") {
      throw new ApiError("Bu işlem az önce kaydedildi.", 409, "DUPLICATE");
    }
    if (result.error.code === "23505") {
      throw new ApiError("Bu kayıt zaten var.", 409);
    }
    throw new ApiError("Veritabanı işlemi başarısız.", 500);
  }
  return result.data;
}

function required(record: Row, key: string): unknown {
  if (!(key in record)) throw new ApiError("Beklenmeyen veritabanı yanıtı.", 500);
  return record[key];
}

export function str(record: Row, key: string): string {
  const value = required(record, key);
  if (typeof value !== "string" || value.length === 0) throw new ApiError("Beklenmeyen veritabanı yanıtı.", 500);
  return value;
}

export function strNull(record: Row, key: string): string | null {
  const value = required(record, key);
  if (value == null) return null;
  if (typeof value !== "string") throw new ApiError("Beklenmeyen veritabanı yanıtı.", 500);
  return value;
}

export function num(record: Row, key: string): number {
  const value = required(record, key);
  if (typeof value !== "number" || !Number.isFinite(value)) throw new ApiError("Beklenmeyen veritabanı yanıtı.", 500);
  return value;
}

export function numNull(record: Row, key: string): number | null {
  const value = required(record, key);
  if (value == null) return null;
  if (typeof value !== "number") throw new ApiError("Beklenmeyen veritabanı yanıtı.", 500);
  return value;
}

export function bool(record: Row, key: string): boolean {
  const value = required(record, key);
  if (typeof value !== "boolean") throw new ApiError("Beklenmeyen veritabanı yanıtı.", 500);
  return value;
}

function clock(record: Row, key: string): string {
  return str(record, key).slice(0, 5);
}

function clockOr(record: Row, key: string, fallback: string): string {
  const value = record[key];
  if (typeof value !== "string" || value.length < 5) return fallback;
  return value.slice(0, 5);
}

function oneOf<T extends string>(value: string, allowed: readonly T[], label: string): T {
  if ((allowed as readonly string[]).includes(value)) return value as T;
  throw new ApiError(`${label} geçersiz.`, 500);
}

export function mapSettings(value: unknown): Settings {
  const record = asRow(value);
  return {
    id: str(record, "id"),
    organizationName: str(record, "organization_name"),
    latitude: num(record, "latitude"),
    longitude: num(record, "longitude"),
    allowedRadiusMeters: num(record, "allowed_radius_meters"),
    locationVerificationRequired: bool(record, "location_verification_required"),
    timezone: str(record, "timezone"),
    defaultWorkStart: clock(record, "default_work_start"),
    defaultWorkEnd: clock(record, "default_work_end"),
    lunchStart: clockOr(record, "lunch_start", "11:50"),
    lunchEnd: clockOr(record, "lunch_end", "13:10"),
    duplicateWindowSeconds: num(record, "duplicate_window_seconds"),
    endOfDaySuggestionMinutes: num(record, "end_of_day_suggestion_minutes"),
    storeRawCoordinates: bool(record, "store_raw_coordinates"),
  };
}

export function mapEmployee(value: unknown): Employee {
  const record = asRow(value);
  return {
    id: str(record, "id"),
    employeeCode: str(record, "employee_code"),
    fullName: str(record, "full_name"),
    department: strNull(record, "department"),
    title: strNull(record, "title"),
    active: bool(record, "active"),
    workStart: clock(record, "work_start_time"),
    workEnd: clock(record, "work_end_time"),
    lunchStart: clockOr(record, "lunch_start", "11:50"),
    lunchEnd: clockOr(record, "lunch_end", "13:10"),
    maxDevices: num(record, "max_devices"),
  };
}

export function mapTag(value: unknown): NfcTag {
  const record = asRow(value);
  return {
    id: str(record, "id"),
    publicId: str(record, "public_id"),
    name: str(record, "name"),
    locationName: strNull(record, "location_name"),
    mode: oneOf(str(record, "mode"), TAG_MODES, "NFC modu"),
    active: bool(record, "active"),
  };
}

export function mapReason(value: unknown): ExitReasonOption {
  const record = asRow(value);
  return {
    id: str(record, "id"),
    code: str(record, "code"),
    name: str(record, "name"),
    category: oneOf(str(record, "category"), EXIT_CATEGORIES, "Kategori"),
    allowNote: bool(record, "allow_note"),
    sortOrder: num(record, "sort_order"),
    active: bool(record, "active"),
  };
}

function reasonName(value: unknown): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const name = (value as Row).name;
  return typeof name === "string" ? name : null;
}

export function mapEvent(value: unknown): DomainEvent {
  const record = asRow(value);
  return {
    id: str(record, "id"),
    employeeId: str(record, "employee_id"),
    eventType: oneOf(str(record, "event_type"), EVENT_TYPES, "Hareket"),
    eventTime: str(record, "event_time"),
    exitCategory: strNull(record, "exit_category")
      ? oneOf(str(record, "exit_category"), EXIT_CATEGORIES, "Kategori")
      : null,
    exitReasonName: reasonName(record.exit_reasons),
    customExitReason: strNull(record, "custom_exit_reason"),
    nfcTagId: strNull(record, "nfc_tag_id"),
  };
}

export function mapEventType(value: string): EventType {
  return oneOf(value, EVENT_TYPES, "Hareket");
}

export function mapCategory(value: string): ExitCategory {
  return oneOf(value, EXIT_CATEGORIES, "Kategori");
}
