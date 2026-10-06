import "server-only";
import { buildPresence } from "@/lib/attendance/presence";
import { buildReports } from "@/lib/attendance/reports";
import { findCarriedInside, findDayAnomalies } from "@/lib/attendance/review";
import { ANOMALY_LABELS, describeMovement, STATE_LABELS } from "@/lib/attendance/labels";
import type { DomainEvent, ExitCategory } from "@/lib/attendance/types";
import { formatDate, formatDateTime, formatDuration, formatTime, safeTimeZone } from "@/lib/time";
import { createAdminClient } from "@/lib/supabase/admin";
import { endOfWeek, monthRange, startOfDay, startOfWeek } from "@/lib/time";
import { eachDay } from "@/lib/time";
import { asRow, mapEmployee, mapEvent, unwrap, type Employee } from "@/lib/server/rows";
import { getSettings } from "@/lib/server/directory";

const EVENT_COLUMNS =
  "id, employee_id, event_type, event_time, exit_category, custom_exit_reason, nfc_tag_id, exit_reasons(name), employees(full_name, department)";

function rangeFor(params: URLSearchParams, now: Date, timeZone: string): { start: Date; end: Date } {
  const preset = params.get("preset");
  const period = params.get("period") ?? preset ?? "today";
  if (preset === "custom" && params.get("from")) {
    const from = params.get("from") as string;
    const to = params.get("to") ?? from;
    const start = startOfDay(new Date(`${from}T12:00:00+03:00`), timeZone);
    const end = new Date(startOfDay(new Date(`${to}T12:00:00+03:00`), timeZone).getTime() + 24 * 60 * 60 * 1000 - 60_000);
    return { start, end };
  }
  if (period === "yesterday") {
    const start = new Date(startOfDay(now, timeZone).getTime() - 60_000);
    return { start: startOfDay(start, timeZone), end: new Date(startOfDay(now, timeZone).getTime() - 60_000) };
  }
  if (period === "week" || period === "weekly") {
    const anchor = params.get("from") ? new Date(`${params.get("from")}T12:00:00+03:00`) : now;
    return { start: startOfWeek(anchor, timeZone), end: endOfWeek(anchor, timeZone) };
  }
  if (period === "month" || period === "monthly") {
    const year = Number(params.get("year") ?? formatDate(now, timeZone).slice(6));
    const month = Number(params.get("month") ?? formatDate(now, timeZone).slice(3, 5));
    return monthRange(year, month, timeZone);
  }
  if (params.get("date")) {
    const day = params.get("date") as string;
    return {
      start: startOfDay(new Date(`${day}T12:00:00+03:00`), timeZone),
      end: new Date(startOfDay(new Date(`${day}T12:00:00+03:00`), timeZone).getTime() + 24 * 60 * 60 * 1000 - 60_000),
    };
  }
  return { start: startOfDay(now, timeZone), end: now };
}

async function loadEmployees(): Promise<Employee[]> {
  const admin = createAdminClient();
  return (unwrap(await admin.from("employees").select("*").order("full_name")) ?? []).map(mapEmployee);
}

async function loadEvents(start: Date, end: Date): Promise<DomainEvent[]> {
  const admin = createAdminClient();
  const rows = unwrap(
    await admin
      .from("attendance_events")
      .select(EVENT_COLUMNS)
      .gte("event_time", start.toISOString())
      .lte("event_time", end.toISOString())
      .order("event_time", { ascending: true }),
  );
  return (rows ?? []).map((value) => {
    const record = asRow(value);
    const event = mapEvent(value);
    const employee = record.employees;
    return {
      ...event,
      employeeName: employee && typeof employee === "object" && "full_name" in employee ? String((employee as { full_name?: unknown }).full_name ?? "") : "",
      department: employee && typeof employee === "object" && "department" in employee
        ? ((employee as { department?: unknown }).department as string | null) ?? null
        : null,
    };
  });
}

type NamedEvent = DomainEvent & { employeeName: string; department: string | null };

export async function getOverview() {
  const settings = await getSettings();
  const timeZone = safeTimeZone(settings.timezone);
  const now = new Date();
  const start = startOfDay(new Date(startOfDay(now, timeZone).getTime() - 60_000), timeZone);
  const employees = await loadEmployees();
  const events = await loadEvents(start, now);
  const presence = buildPresence({
    employees: employees.map((employee) => ({
      id: employee.id,
      fullName: employee.fullName,
      department: employee.department,
      active: employee.active,
      workEnd: employee.workEnd,
    })),
    events,
    now,
    timeZone,
  });
  const recent = [...events]
    .reverse()
    .slice(0, 12)
    .map((event) => ({
      ...describeMovement(event, timeZone),
      employeeName: (event as NamedEvent).employeeName,
      stateTitle: null,
    }));
  const review = await collectReview(employees, events, now, timeZone, settings.duplicateWindowSeconds);
  return {
    organizationName: settings.organizationName,
    generatedAt: formatDateTime(now, timeZone),
    counts: presence.counts,
    rows: presence.rows.map((row) => ({ ...row, stateLabel: STATE_LABELS[row.state].title })),
    recent,
    reviewCount: review.length,
  };
}

async function collectReview(employees: Employee[], events: DomainEvent[], now: Date, timeZone: string, windowSeconds: number) {
  const names = new Map(employees.map((employee) => [employee.id, employee.fullName]));
  const days = eachDay(startOfDay(new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000), timeZone), now, timeZone);
  const items = employees.flatMap((employee) => {
    const own = events.filter((event) => event.employeeId === employee.id);
    const anomalies = days.flatMap((day) =>
      findDayAnomalies({
        employeeId: employee.id,
        day,
        events: own,
        duplicateWindowSeconds: windowSeconds,
        now,
        timeZone,
        workEnd: employee.workEnd,
      }),
    );
    const carried = findCarriedInside({ employeeId: employee.id, events: own, now, timeZone, workEnd: employee.workEnd });
    return carried ? [...anomalies, carried] : anomalies;
  });
  return items.map((item) => ({
    ...item,
    label: ANOMALY_LABELS[item.code],
    employeeName: names.get(item.employeeId) ?? "Personel",
    dateLabel: item.date.split("-").reverse().join("."),
  }));
}

export async function getReview() {
  const settings = await getSettings();
  const timeZone = safeTimeZone(settings.timezone);
  const now = new Date();
  const start = startOfDay(new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000), timeZone);
  const employees = await loadEmployees();
  const events = await loadEvents(start, now);
  return collectReview(employees, events, now, timeZone, settings.duplicateWindowSeconds);
}

export async function getEvents(params: URLSearchParams) {
  const settings = await getSettings();
  const timeZone = safeTimeZone(settings.timezone);
  const now = new Date();
  const range = rangeFor(params, now, timeZone);
  const employeeId = params.get("employeeId");
  const department = params.get("department");
  const category = params.get("category");
  let events = (await loadEvents(range.start, range.end)) as NamedEvent[];
  if (employeeId) events = events.filter((event) => event.employeeId === employeeId);
  if (department) events = events.filter((event) => event.department === department);
  if (category) events = events.filter((event) => event.exitCategory === (category as ExitCategory));
  return [...events].reverse().map((event) => ({
    id: event.id,
    employeeId: event.employeeId,
    employeeName: event.employeeName,
    department: event.department,
    eventType: event.eventType,
    eventTime: event.eventTime,
    date: formatDate(event.eventTime, timeZone),
    ...describeMovement(event, timeZone),
    category: event.exitCategory,
  }));
}

export async function getReport(params: URLSearchParams) {
  const settings = await getSettings();
  const timeZone = safeTimeZone(settings.timezone);
  const now = new Date();
  const range = rangeFor(params, now, timeZone);
  const employees = await loadEmployees();
  const events = await loadEvents(range.start, range.end);
  const reports = buildReports({
    employees,
    events,
    start: range.start,
    end: range.end,
    now,
    duplicateWindowSeconds: settings.duplicateWindowSeconds,
    timeZone,
  });
  return {
    from: formatDate(range.start, timeZone),
    to: formatDate(range.end, timeZone),
    timeZone,
    reports: reports.map((report) => ({
      ...report,
      physical: formatDuration(report.physicalMs),
      duty: formatDuration(report.dutyMs),
      overtime: formatDuration(report.overtimeMs),
      official: formatDuration(report.officialMs),
      meal: formatDuration(report.mealMs),
      health: formatDuration(report.healthMs),
      personal: formatDuration(report.personalMs),
      other: formatDuration(report.otherMs),
      late: formatDuration(report.lateMs),
      early: formatDuration(report.earlyMs),
      days: report.days.map((day) => ({
        ...day,
        dateLabel: day.date.split("-").reverse().join("."),
        firstEntryLabel: day.firstEntry ? formatTime(day.firstEntry, timeZone) : "—",
        lastExitLabel: day.lastExit ? formatTime(day.lastExit, timeZone) : "—",
        physical: formatDuration(day.physicalMs),
        duty: formatDuration(day.dutyMs),
        overtime: formatDuration(day.overtimeMs),
        official: formatDuration(day.officialMs),
        personal: formatDuration(day.personalMs),
        other: formatDuration(day.otherMs),
        stateLabel: STATE_LABELS[day.state].title,
      })),
      officialDetails: report.officialDetails.map((detail) => ({
        ...detail,
        dateLabel: detail.date.split("-").reverse().join("."),
        duration: formatDuration(detail.ms),
      })),
    })),
  };
}
