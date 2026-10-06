export const APP_TIMEZONE = "Europe/Istanbul";

export const ATTENDANCE_STATES = [
  "NOT_ARRIVED",
  "INSIDE",
  "OUT_OFFICIAL",
  "OUT_PERSONAL",
  "OUT_HEALTH",
  "OUT_MEAL",
  "OUT_OTHER",
  "FINISHED",
] as const;

export type AttendanceState = (typeof ATTENDANCE_STATES)[number];

export const EVENT_TYPES = ["ENTRY", "EXIT", "RETURN", "END_OF_DAY"] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export const EXIT_CATEGORIES = [
  "OFFICIAL",
  "MEAL",
  "HEALTH",
  "PERSONAL",
  "END_OF_DAY",
  "OTHER",
] as const;
export type ExitCategory = (typeof EXIT_CATEGORIES)[number];

export const TAG_MODES = ["ENTRY", "EXIT", "UNIVERSAL"] as const;
export type TagMode = (typeof TAG_MODES)[number];

export const ANOMALY_CODES = [
  "EXIT_WITHOUT_ENTRY",
  "DOUBLE_ENTRY",
  "DOUBLE_EXIT",
  "EXIT_WITHOUT_RETURN",
  "OPEN_AT_DAY_END",
  "CARRIED_INSIDE",
  "DUPLICATE_EVENT",
  "AFTER_END_OF_DAY",
] as const;
export type AnomalyCode = (typeof ANOMALY_CODES)[number];

export type DomainEvent = {
  id: string;
  employeeId: string;
  eventType: EventType;
  eventTime: string;
  exitCategory: ExitCategory | null;
  exitReasonName: string | null;
  customExitReason: string | null;
  nfcTagId: string | null;
};

export type ExitReasonOption = {
  id: string;
  code: string;
  name: string;
  category: ExitCategory;
  allowNote: boolean;
  sortOrder: number;
};

export type LocationFix = {
  verified: boolean;
  distanceMeters: number | null;
  accuracy: number | null;
  failure: null | "MISSING" | "OUTSIDE" | "INACCURATE";
};

export type NfcAssessment =
  | { action: "TAG_UNKNOWN" }
  | { action: "TAG_INACTIVE" }
  | { action: "PAIR_REQUIRED" }
  | { action: "EMPLOYEE_INACTIVE" }
  | { action: "LOCATION_MISSING" }
  | { action: "LOCATION_OUTSIDE"; distanceMeters: number | null }
  | { action: "LOCATION_INACCURATE" }
  | { action: "DUPLICATE" }
  | { action: "ALREADY_INSIDE" }
  | { action: "ALREADY_OUTSIDE" }
  | { action: "CONFIRM_REENTRY" }
  | { action: "SELECT_EXIT_REASON" }
  | { action: "CREATE"; eventType: "ENTRY" | "RETURN" };

export type RecordedResponse = {
  action: "RECORDED";
  eventType: EventType;
  eventTime: string;
  message: string;
};

export type LastExitInfo = {
  time: string;
  label: string;
  detail: string | null;
};

export type NfcSuccessResponse =
  | RecordedResponse
  | {
      action: "SELECT_EXIT_REASON";
      suggestEndOfDay: boolean;
      employeeName: string;
      reasons: ExitReasonOption[];
    }
  | { action: "ALREADY_INSIDE"; message: string }
  | { action: "ALREADY_OUTSIDE"; message: string; lastExit: LastExitInfo | null }
  | { action: "CONFIRM_REENTRY"; message: string }
  | { action: "DUPLICATE"; message: string; eventTime: string | null }
  | { action: "PAIR_REQUIRED"; message: string };
