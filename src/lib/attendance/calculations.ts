import type { AttendanceState, DomainEvent, ExitCategory } from "@/lib/attendance/types";
import { eventsOnDay, deriveState } from "@/lib/attendance/state";
import { clockToMinutes, dayKey, minutesFromMidnight, minutesToClock, zonedDateTime } from "@/lib/time";
import { APP_TIMEZONE } from "@/lib/attendance/types";

export type SpanKind = "INSIDE" | "OFFICIAL" | "MEAL" | "HEALTH" | "PERSONAL" | "OTHER";

export type Span = {
  kind: SpanKind;
  start: string;
  end: string;
  reasonName: string | null;
  custom: string | null;
};

export type OfficialDetail = {
  date: string;
  label: string;
  custom: string | null;
  ms: number;
};

const OUTSIDE_KIND: Record<Exclude<ExitCategory, "END_OF_DAY">, SpanKind> = {
  OFFICIAL: "OFFICIAL",
  MEAL: "MEAL",
  HEALTH: "HEALTH",
  PERSONAL: "PERSONAL",
  OTHER: "OTHER",
};

export function buildSpans(events: DomainEvent[], closeOpenAt: Date | null): Span[] {
  const sorted = [...events].sort((a, b) => a.eventTime.localeCompare(b.eventTime));
  const spans: Span[] = [];
  let open: { kind: SpanKind; start: string; reasonName: string | null; custom: string | null } | null = null;

  const close = (end: string) => {
    if (!open) return;
    if (new Date(end).getTime() > new Date(open.start).getTime()) {
      spans.push({ ...open, end });
    }
    open = null;
  };

  for (const event of sorted) {
    if (event.eventType === "ENTRY" || event.eventType === "RETURN") {
      close(event.eventTime);
      open = { kind: "INSIDE", start: event.eventTime, reasonName: null, custom: null };
      continue;
    }
    if (event.eventType === "END_OF_DAY") {
      close(event.eventTime);
      continue;
    }
    close(event.eventTime);
    const category = event.exitCategory ?? "OTHER";
    if (category === "END_OF_DAY") continue;
    open = {
      kind: OUTSIDE_KIND[category],
      start: event.eventTime,
      reasonName: event.exitReasonName,
      custom: event.customExitReason,
    };
  }

  if (open && closeOpenAt) close(closeOpenAt.toISOString());
  return spans;
}

export function sumKind(spans: Span[], kind: SpanKind): number {
  return spans
    .filter((span) => span.kind === kind)
    .reduce((total, span) => total + (new Date(span.end).getTime() - new Date(span.start).getTime()), 0);
}

export type DayMetrics = {
  date: string;
  firstEntry: string | null;
  lastExit: string | null;
  physicalMs: number;
  dutyMs: number;
  officialMs: number;
  mealMs: number;
  healthMs: number;
  personalMs: number;
  otherMs: number;
  lateMs: number;
  earlyMs: number;
  state: AttendanceState;
  officialDetails: OfficialDetail[];
};

export function calculateDay(input: {
  events: DomainEvent[];
  day: string;
  workStart: string;
  workEnd: string;
  now: Date;
  timeZone?: string;
}): DayMetrics {
  const timeZone = input.timeZone ?? APP_TIMEZONE;
  const dayEvents = eventsOnDay(input.events, input.day, timeZone);
  const closeOpenAt = input.day === dayKey(input.now, timeZone) ? input.now : null;
  const spans = buildSpans(dayEvents, closeOpenAt);
  const physicalMs = sumKind(spans, "INSIDE");
  const officialMs = sumKind(spans, "OFFICIAL");
  const firstEntry = dayEvents.find((event) => event.eventType === "ENTRY")?.eventTime ?? null;
  const lastExitEvent = [...dayEvents].reverse().find((event) => event.eventType === "EXIT" || event.eventType === "END_OF_DAY");
  const lastEvent = dayEvents[dayEvents.length - 1];
  const workStartAt = zonedDateTime(input.day, input.workStart, timeZone);
  const workEndAt = zonedDateTime(input.day, input.workEnd, timeZone);
  const lateMs =
    firstEntry && new Date(firstEntry).getTime() > workStartAt.getTime()
      ? new Date(firstEntry).getTime() - workStartAt.getTime()
      : 0;
  const earlyMs =
    lastEvent?.eventType === "END_OF_DAY" && new Date(lastEvent.eventTime).getTime() < workEndAt.getTime()
      ? workEndAt.getTime() - new Date(lastEvent.eventTime).getTime()
      : 0;

  const officialDetails: OfficialDetail[] = spans
    .filter((span) => span.kind === "OFFICIAL")
    .map((span) => ({
      date: input.day,
      label: span.reasonName || "Resmî görev",
      custom: span.custom,
      ms: new Date(span.end).getTime() - new Date(span.start).getTime(),
    }));

  return {
    date: input.day,
    firstEntry,
    lastExit: lastExitEvent?.eventTime ?? null,
    physicalMs,
    dutyMs: physicalMs + officialMs,
    officialMs,
    mealMs: sumKind(spans, "MEAL"),
    healthMs: sumKind(spans, "HEALTH"),
    personalMs: sumKind(spans, "PERSONAL"),
    otherMs: sumKind(spans, "OTHER"),
    lateMs,
    earlyMs,
    state: deriveState(dayEvents),
    officialDetails,
  };
}

export function averageClock(values: Array<string | null>, timeZone = APP_TIMEZONE): string | null {
  const minutes = values.filter((value): value is string => Boolean(value)).map((value) => minutesFromMidnight(value, timeZone));
  if (minutes.length === 0) return null;
  return minutesToClock(minutes.reduce((total, value) => total + value, 0) / minutes.length);
}

export function clockMinutes(time: string): number {
  return clockToMinutes(time);
}
