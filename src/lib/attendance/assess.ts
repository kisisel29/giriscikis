import type { AttendanceState, ExitCategory, ExitReasonOption, LocationFix, NfcAssessment, TagMode } from "@/lib/attendance/types";
import { isEntryMode, isExitMode } from "@/lib/attendance/state";
import { parseCustomExitReason } from "@/lib/text";

export function assessNfc(input: {
  tag: { active: boolean; mode: TagMode } | null;
  paired: boolean;
  employeeActive: boolean;
  locationRequired: boolean;
  location: LocationFix;
  duplicate: boolean;
  state: AttendanceState;
}): NfcAssessment {
  if (!input.tag) return { action: "TAG_UNKNOWN" };
  if (!input.tag.active) return { action: "TAG_INACTIVE" };
  if (!input.paired) return { action: "PAIR_REQUIRED" };
  if (!input.employeeActive) return { action: "EMPLOYEE_INACTIVE" };
  if (input.locationRequired && input.location.failure) {
    if (input.location.failure === "OUTSIDE") {
      return { action: "LOCATION_OUTSIDE", distanceMeters: input.location.distanceMeters };
    }
    if (input.location.failure === "INACCURATE") return { action: "LOCATION_INACCURATE" };
    return { action: "LOCATION_MISSING" };
  }
  if (input.duplicate) return { action: "DUPLICATE" };

  if (isEntryMode(input.tag.mode, input.state) && input.tag.mode !== "EXIT") {
    if (input.state === "INSIDE") return { action: "ALREADY_INSIDE" };
    if (input.state === "FINISHED") return { action: "CONFIRM_REENTRY" };
    if (input.state === "NOT_ARRIVED") return { action: "CREATE", eventType: "ENTRY" };
    return { action: "CREATE", eventType: "RETURN" };
  }

  if (isExitMode(input.tag.mode, input.state)) {
    if (input.state === "INSIDE") return { action: "SELECT_EXIT_REASON" };
    return { action: "ALREADY_OUTSIDE" };
  }

  return { action: "ALREADY_OUTSIDE" };
}

export function assessReentry(input: {
  tag: { active: boolean; mode: TagMode } | null;
  paired: boolean;
  employeeActive: boolean;
  locationRequired: boolean;
  location: LocationFix;
  duplicate: boolean;
  state: AttendanceState;
}): NfcAssessment {
  const base = assessNfc({ ...input, duplicate: false });
  if (base.action !== "CONFIRM_REENTRY") return base;
  if (input.duplicate) return { action: "DUPLICATE" };
  return { action: "CREATE", eventType: "ENTRY" };
}

export function assessExit(input: {
  tag: { active: boolean; mode: TagMode } | null;
  paired: boolean;
  employeeActive: boolean;
  locationRequired: boolean;
  location: LocationFix;
  duplicate: boolean;
  state: AttendanceState;
}): NfcAssessment {
  const gate = assessNfc(input);
  if (
    gate.action === "TAG_UNKNOWN" ||
    gate.action === "TAG_INACTIVE" ||
    gate.action === "PAIR_REQUIRED" ||
    gate.action === "EMPLOYEE_INACTIVE" ||
    gate.action === "LOCATION_MISSING" ||
    gate.action === "LOCATION_OUTSIDE" ||
    gate.action === "LOCATION_INACCURATE" ||
    gate.action === "DUPLICATE"
  ) {
    return gate;
  }
  if (input.state !== "INSIDE") return { action: "ALREADY_OUTSIDE" };
  if (input.tag && isExitMode(input.tag.mode, input.state)) return { action: "SELECT_EXIT_REASON" };
  return { action: "ALREADY_OUTSIDE" };
}

export function resolveExitRecord(input: {
  preset: ExitReasonOption | null;
  customRaw: string | null | undefined;
}): {
  eventType: "EXIT" | "END_OF_DAY";
  exitReasonId: string | null;
  customExitReason: string | null;
  exitCategory: ExitCategory;
} {
  const custom = parseCustomExitReason(input.customRaw);
  if (!input.preset && !custom) {
    throw new Error("Hazır bir neden seçin veya kendi nedeninizi yazın.");
  }
  const exitCategory = input.preset?.category ?? "OTHER";
  return {
    eventType: exitCategory === "END_OF_DAY" ? "END_OF_DAY" : "EXIT",
    exitReasonId: input.preset?.id ?? null,
    customExitReason: custom,
    exitCategory,
  };
}

export function orderExitReasons<T extends { code: string; sortOrder: number }>(
  reasons: T[],
  suggestEndOfDay: boolean,
): T[] {
  const sorted = [...reasons].sort((a, b) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code));
  if (!suggestEndOfDay) return sorted;
  return [...sorted.filter((reason) => reason.code === "END_OF_DAY"), ...sorted.filter((reason) => reason.code !== "END_OF_DAY")];
}

export function recordedMessage(eventType: "ENTRY" | "RETURN" | "EXIT" | "END_OF_DAY"): string {
  switch (eventType) {
    case "ENTRY":
      return "Girişiniz kaydedildi";
    case "RETURN":
      return "Dönüşünüz kaydedildi";
    case "END_OF_DAY":
      return "Mesai sonu kaydedildi";
    case "EXIT":
      return "Çıkışınız kaydedildi";
  }
}
