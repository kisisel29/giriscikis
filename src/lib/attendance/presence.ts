import type { AttendanceState, DomainEvent } from "@/lib/attendance/types";
import { deriveCurrentPresence } from "@/lib/attendance/state";
import { describeMovement } from "@/lib/attendance/labels";
import { APP_TIMEZONE } from "@/lib/attendance/types";

export type PresenceEmployee = {
  id: string;
  fullName: string;
  department: string | null;
  active: boolean;
};

export type PresenceRow = {
  employeeId: string;
  fullName: string;
  department: string | null;
  state: AttendanceState;
  carried: boolean;
  lastTime: string | null;
  lastTitle: string | null;
  lastDetail: string | null;
};

const COUNT_KEYS: AttendanceState[] = [
  "INSIDE",
  "OUT_OFFICIAL",
  "OUT_PERSONAL",
  "OUT_HEALTH",
  "OUT_MEAL",
  "NOT_ARRIVED",
  "FINISHED",
];

export function buildPresence(input: {
  employees: PresenceEmployee[];
  events: DomainEvent[];
  now: Date;
  timeZone?: string;
}): { counts: Record<AttendanceState, number>; rows: PresenceRow[] } {
  const timeZone = input.timeZone ?? APP_TIMEZONE;
  const counts = Object.fromEntries(COUNT_KEYS.map((key) => [key, 0])) as Record<AttendanceState, number>;
  counts.OUT_OTHER = 0;

  const rows = input.employees
    .filter((employee) => employee.active)
    .map((employee) => {
      const own = input.events.filter((event) => event.employeeId === employee.id);
      const presence = deriveCurrentPresence(own, input.now, timeZone);
      counts[presence.state] += 1;
      const latest = [...own].sort((a, b) => b.eventTime.localeCompare(a.eventTime))[0];
      const described = latest ? describeMovement(latest, timeZone) : null;
      return {
        employeeId: employee.id,
        fullName: employee.fullName,
        department: employee.department,
        state: presence.state,
        carried: presence.carried,
        lastTime: described?.time ?? null,
        lastTitle: described?.title ?? null,
        lastDetail: described?.detail ?? null,
      };
    })
    .sort((a, b) => a.fullName.localeCompare(b.fullName, "tr"));

  return { counts, rows };
}
