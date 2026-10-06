import type { AttendanceState, DomainEvent, ExitCategory, TagMode } from "@/lib/attendance/types";
import { dayKey, previousDayKey } from "@/lib/time";
import { APP_TIMEZONE } from "@/lib/attendance/types";

export function outsideState(category: ExitCategory): AttendanceState {
  switch (category) {
    case "OFFICIAL":
      return "OUT_OFFICIAL";
    case "PERSONAL":
      return "OUT_PERSONAL";
    case "HEALTH":
      return "OUT_HEALTH";
    case "MEAL":
      return "OUT_MEAL";
    case "END_OF_DAY":
      return "FINISHED";
    case "OTHER":
      return "OUT_OTHER";
  }
}

export function isOpenState(state: AttendanceState): boolean {
  return state === "INSIDE" || state.startsWith("OUT_");
}

export function deriveState(events: Pick<DomainEvent, "eventType" | "exitCategory">[]): AttendanceState {
  let state: AttendanceState = "NOT_ARRIVED";
  for (const event of events) {
    if (event.eventType === "ENTRY" || event.eventType === "RETURN") {
      state = "INSIDE";
      continue;
    }
    if (event.eventType === "END_OF_DAY") {
      state = "FINISHED";
      continue;
    }
    state = outsideState(event.exitCategory ?? "OTHER");
  }
  return state;
}

export function eventsOnDay(events: DomainEvent[], key: string, timeZone = APP_TIMEZONE): DomainEvent[] {
  return events
    .filter((event) => dayKey(new Date(event.eventTime), timeZone) === key)
    .sort((a, b) => a.eventTime.localeCompare(b.eventTime));
}

export function deriveCurrentPresence(
  events: DomainEvent[],
  now: Date,
  timeZone = APP_TIMEZONE,
): { state: AttendanceState; carried: boolean } {
  const today = eventsOnDay(
    events.filter((event) => new Date(event.eventTime).getTime() <= now.getTime()),
    dayKey(now, timeZone),
    timeZone,
  );
  if (today.length > 0) {
    return { state: deriveState(today), carried: false };
  }
  const yesterday = eventsOnDay(events, previousDayKey(now, timeZone), timeZone);
  const yesterdayState = deriveState(yesterday);
  if (isOpenState(yesterdayState)) {
    return { state: yesterdayState, carried: true };
  }
  return { state: "NOT_ARRIVED", carried: false };
}

export function isEntryMode(mode: TagMode, state: AttendanceState): boolean {
  if (mode === "ENTRY") return true;
  if (mode === "UNIVERSAL") return state !== "INSIDE";
  return false;
}

export function isExitMode(mode: TagMode, state: AttendanceState): boolean {
  if (mode === "EXIT") return true;
  if (mode === "UNIVERSAL") return state === "INSIDE";
  return false;
}
