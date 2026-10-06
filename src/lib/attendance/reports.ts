import type { DomainEvent } from "@/lib/attendance/types";
import { averageClock, calculateDay, type DayMetrics, type OfficialDetail } from "@/lib/attendance/calculations";
import { findDayAnomalies } from "@/lib/attendance/review";
import { eachDay } from "@/lib/time";
import { APP_TIMEZONE } from "@/lib/attendance/types";

export type ReportEmployee = {
  id: string;
  fullName: string;
  department: string | null;
  workStart: string;
  workEnd: string;
  lunchStart?: string | null;
  lunchEnd?: string | null;
};

export type EmployeeReport = {
  employeeId: string;
  fullName: string;
  department: string | null;
  days: DayMetrics[];
  physicalMs: number;
  dutyMs: number;
  officialMs: number;
  mealMs: number;
  healthMs: number;
  personalMs: number;
  otherMs: number;
  lateCount: number;
  lateMs: number;
  earlyCount: number;
  earlyMs: number;
  missingCount: number;
  averageEntry: string | null;
  averageExit: string | null;
  officialDetails: OfficialDetail[];
};

function sumDays(days: DayMetrics[], missingCount: number, timeZone: string): Omit<EmployeeReport, "employeeId" | "fullName" | "department" | "days"> {
  const total = (pick: (day: DayMetrics) => number) => days.reduce((sum, day) => sum + pick(day), 0);
  return {
    physicalMs: total((day) => day.physicalMs),
    dutyMs: total((day) => day.dutyMs),
    officialMs: total((day) => day.officialMs),
    mealMs: total((day) => day.mealMs),
    healthMs: total((day) => day.healthMs),
    personalMs: total((day) => day.personalMs),
    otherMs: total((day) => day.otherMs),
    lateCount: days.filter((day) => day.lateMs > 0).length,
    lateMs: total((day) => day.lateMs),
    earlyCount: days.filter((day) => day.earlyMs > 0).length,
    earlyMs: total((day) => day.earlyMs),
    missingCount,
    averageEntry: averageClock(days.map((day) => day.firstEntry), timeZone),
    averageExit: averageClock(days.map((day) => day.lastExit), timeZone),
    officialDetails: days.flatMap((day) => day.officialDetails),
  };
}

export function buildReports(input: {
  employees: ReportEmployee[];
  events: DomainEvent[];
  start: Date;
  end: Date;
  now: Date;
  duplicateWindowSeconds: number;
  timeZone?: string;
}): EmployeeReport[] {
  const timeZone = input.timeZone ?? APP_TIMEZONE;
  const days = eachDay(input.start, input.end, timeZone);
  return input.employees
    .map((employee) => {
      const own = input.events.filter((event) => event.employeeId === employee.id);
      const dayReports = days.map((day) =>
        calculateDay({
          events: own,
          day,
          workStart: employee.workStart,
          workEnd: employee.workEnd,
          lunchStart: employee.lunchStart,
          lunchEnd: employee.lunchEnd,
          now: input.now,
          timeZone,
        }),
      );
      const missingCount = days.reduce(
        (count, day) =>
          count +
          findDayAnomalies({
            employeeId: employee.id,
            day,
            events: own,
            duplicateWindowSeconds: input.duplicateWindowSeconds,
            now: input.now,
            timeZone,
          }).length,
        0,
      );
      return {
        employeeId: employee.id,
        fullName: employee.fullName,
        department: employee.department,
        days: dayReports,
        ...sumDays(dayReports, missingCount, timeZone),
      };
    })
    .sort((a, b) => a.fullName.localeCompare(b.fullName, "tr"));
}
