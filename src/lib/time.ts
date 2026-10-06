import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { APP_TIMEZONE } from "@/lib/attendance/types";

export function dayKey(date: Date, timeZone = APP_TIMEZONE): string {
  return formatInTimeZone(date, timeZone, "yyyy-MM-dd");
}

export function formatDate(date: Date | string, timeZone = APP_TIMEZONE): string {
  return formatInTimeZone(new Date(date), timeZone, "dd.MM.yyyy");
}

export function formatTime(date: Date | string, timeZone = APP_TIMEZONE): string {
  return formatInTimeZone(new Date(date), timeZone, "HH:mm");
}

export function formatDateTime(date: Date | string, timeZone = APP_TIMEZONE): string {
  return formatInTimeZone(new Date(date), timeZone, "dd.MM.yyyy HH:mm");
}

export function startOfDay(date: Date, timeZone = APP_TIMEZONE): Date {
  return fromZonedTime(`${dayKey(date, timeZone)}T00:00:00`, timeZone);
}

export function previousDayKey(date: Date, timeZone = APP_TIMEZONE): string {
  return dayKey(new Date(startOfDay(date, timeZone).getTime() - 60_000), timeZone);
}

export function zonedDateTime(day: string, time: string, timeZone = APP_TIMEZONE): Date {
  const hhmm = time.slice(0, 5);
  return fromZonedTime(`${day}T${hhmm}:00`, timeZone);
}

export function eachDay(start: Date, end: Date, timeZone = APP_TIMEZONE): string[] {
  const days: string[] = [];
  let key = dayKey(start, timeZone);
  const endKey = dayKey(end, timeZone);
  while (key <= endKey) {
    days.push(key);
    const next = new Date(fromZonedTime(`${key}T12:00:00`, timeZone).getTime() + 24 * 60 * 60 * 1000);
    key = dayKey(next, timeZone);
  }
  return days;
}

export function startOfWeek(date: Date, timeZone = APP_TIMEZONE): Date {
  const key = dayKey(date, timeZone);
  const noon = fromZonedTime(`${key}T12:00:00`, timeZone);
  const weekday = Number(formatInTimeZone(noon, timeZone, "i"));
  const monday = new Date(noon.getTime() - (weekday - 1) * 24 * 60 * 60 * 1000);
  return startOfDay(monday, timeZone);
}

export function endOfWeek(date: Date, timeZone = APP_TIMEZONE): Date {
  return new Date(startOfWeek(date, timeZone).getTime() + 6 * 24 * 60 * 60 * 1000 + 12 * 60 * 60 * 1000);
}

export function monthRange(year: number, month: number, timeZone = APP_TIMEZONE): { start: Date; end: Date } {
  const mm = String(month).padStart(2, "0");
  const start = fromZonedTime(`${year}-${mm}-01T00:00:00`, timeZone);
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const nextKey = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`;
  const end = new Date(fromZonedTime(`${nextKey}T00:00:00`, timeZone).getTime() - 60_000);
  return { start, end };
}

export function minutesFromMidnight(date: Date | string, timeZone = APP_TIMEZONE): number {
  const [hour, minute] = formatInTimeZone(new Date(date), timeZone, "HH:mm").split(":").map(Number);
  return hour * 60 + minute;
}

export function minutesToClock(minutes: number): string {
  const rounded = Math.round(minutes);
  const normalized = ((rounded % (24 * 60)) + 24 * 60) % (24 * 60);
  const hour = Math.floor(normalized / 60);
  const minute = normalized % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function clockToMinutes(time: string): number {
  const [hour, minute] = time.slice(0, 5).split(":").map(Number);
  return hour * 60 + minute;
}

export function shouldSuggestEndOfDay(
  now: Date,
  workEnd: string,
  suggestionMinutes: number,
  timeZone = APP_TIMEZONE,
): boolean {
  const end = zonedDateTime(dayKey(now, timeZone), workEnd, timeZone);
  return now.getTime() >= end.getTime() - suggestionMinutes * 60_000;
}

export function safeTimeZone(value: string | null | undefined): string {
  if (!value) return APP_TIMEZONE;
  try {
    formatInTimeZone(new Date(), value, "yyyy-MM-dd");
    return value;
  } catch {
    return APP_TIMEZONE;
  }
}

export function formatDuration(ms: number, padHours = false): string {
  const total = Math.max(0, Math.round(ms / 60_000));
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  const hourText = padHours ? String(hours).padStart(2, "0") : String(hours);
  return `${hourText} sa ${String(minutes).padStart(2, "0")} dk`;
}
