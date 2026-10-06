import type { AnomalyCode, AttendanceState, DomainEvent } from "@/lib/attendance/types";
import { deriveState, eventsOnDay, isOpenState } from "@/lib/attendance/state";
import { dayKey, forgottenExitTime, previousDayKey } from "@/lib/time";
import { APP_TIMEZONE } from "@/lib/attendance/types";

export type Anomaly = {
  code: AnomalyCode;
  employeeId: string;
  date: string;
  eventId: string | null;
  detail: string;
};

export function findDayAnomalies(input: {
  employeeId: string;
  day: string;
  events: DomainEvent[];
  duplicateWindowSeconds: number;
  now: Date;
  timeZone?: string;
  workEnd?: string;
}): Anomaly[] {
  const timeZone = input.timeZone ?? APP_TIMEZONE;
  const dayEvents = eventsOnDay(input.events, input.day, timeZone);
  const anomalies: Anomaly[] = [];
  if (dayEvents.length === 0) return anomalies;

  if (dayEvents[0].eventType !== "ENTRY") {
    anomalies.push({
      code: "EXIT_WITHOUT_ENTRY",
      employeeId: input.employeeId,
      date: input.day,
      eventId: dayEvents[0].id,
      detail: "Günün ilk hareketi giriş değil.",
    });
  }

  for (let index = 1; index < dayEvents.length; index += 1) {
    const previous = dayEvents[index - 1];
    const current = dayEvents[index];
    if (previous.eventType === "ENTRY" && current.eventType === "ENTRY") {
      anomalies.push({
        code: "DOUBLE_ENTRY",
        employeeId: input.employeeId,
        date: input.day,
        eventId: current.id,
        detail: "İki giriş kaydı art arda.",
      });
    }
    if (previous.eventType === "EXIT" && current.eventType === "EXIT") {
      anomalies.push({
        code: "DOUBLE_EXIT",
        employeeId: input.employeeId,
        date: input.day,
        eventId: current.id,
        detail: "İki çıkış kaydı art arda.",
      });
    }
    if (previous.eventType === "END_OF_DAY") {
      anomalies.push({
        code: "AFTER_END_OF_DAY",
        employeeId: input.employeeId,
        date: input.day,
        eventId: current.id,
        detail: "Mesai sonundan sonra yeni hareket var.",
      });
    }
    if (previous.nfcTagId && previous.nfcTagId === current.nfcTagId) {
      const delta = new Date(current.eventTime).getTime() - new Date(previous.eventTime).getTime();
      if (delta >= 0 && delta <= input.duplicateWindowSeconds * 1000) {
        anomalies.push({
          code: "DUPLICATE_EVENT",
          employeeId: input.employeeId,
          date: input.day,
          eventId: current.id,
          detail: "Aynı etiket kısa aralıkla yeniden kullanılmış.",
        });
      }
    }
  }

  for (let index = 0; index < dayEvents.length; index += 1) {
    const event = dayEvents[index];
    if (event.eventType !== "EXIT" || event.exitCategory === "END_OF_DAY") continue;
    const next = dayEvents[index + 1];
    if (!next || next.eventType !== "RETURN") {
      anomalies.push({
        code: "EXIT_WITHOUT_RETURN",
        employeeId: input.employeeId,
        date: input.day,
        eventId: event.id,
        detail: event.customExitReason || event.exitReasonName || "Dönüş kaydı yok.",
      });
    }
  }

  const complete = input.day < dayKey(input.now, timeZone);
  const state = deriveState(dayEvents);
  const assumed = forgottenExitTime({
    day: input.day,
    workEnd: input.workEnd ?? "16:45",
    now: input.now,
    timeZone,
    stillInside: state === "INSIDE",
  });
  if (complete && isOpenState(state) && !assumed) {
    anomalies.push({
      code: "OPEN_AT_DAY_END",
      employeeId: input.employeeId,
      date: input.day,
      eventId: dayEvents[dayEvents.length - 1]?.id ?? null,
      detail: "Gün kapanırken personel hâlâ açık durumda.",
    });
  }

  return anomalies;
}

export function findCarriedInside(input: {
  employeeId: string;
  events: DomainEvent[];
  now: Date;
  timeZone?: string;
  workEnd?: string;
}): Anomaly | null {
  const timeZone = input.timeZone ?? APP_TIMEZONE;
  const yesterday = previousDayKey(input.now, timeZone);
  const state: AttendanceState = deriveState(eventsOnDay(input.events, yesterday, timeZone));
  if (state !== "INSIDE") return null;
  if (
    forgottenExitTime({
      day: yesterday,
      workEnd: input.workEnd ?? "16:45",
      now: input.now,
      timeZone,
      stillInside: true,
    })
  ) {
    return null;
  }
  return {
    code: "CARRIED_INSIDE",
    employeeId: input.employeeId,
    date: yesterday,
    eventId: null,
    detail: "Personel önceki günün sonunda kurumda görünüyor.",
  };
}
