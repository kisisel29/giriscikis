import { describe, expect, it } from "vitest";
import { assessExit, assessNfc, assessReentry, orderExitReasons, resolveExitRecord, shouldAskLateReason } from "@/lib/attendance/assess";
import { buildAuditEntry } from "@/lib/attendance/audit";
import { calculateDay } from "@/lib/attendance/calculations";
import { measureLocation } from "@/lib/attendance/location";
import { buildPresence } from "@/lib/attendance/presence";
import { buildReports } from "@/lib/attendance/reports";
import { findDayAnomalies } from "@/lib/attendance/review";
import { describeMovement } from "@/lib/attendance/labels";
import { deriveCurrentPresence, deriveState } from "@/lib/attendance/state";
import { isDeviceRecognized } from "@/lib/attendance/trust";
import type { DomainEvent, ExitReasonOption, LocationFix } from "@/lib/attendance/types";
import { hashPairingCode, verifyPairingCode } from "@/lib/pairing";
import { parseCustomExitReason } from "@/lib/text";
import { shouldSuggestEndOfDay } from "@/lib/time";

const okLocation: LocationFix = { verified: true, distanceMeters: 12, accuracy: 8, failure: null };

function event(partial: Partial<DomainEvent> & Pick<DomainEvent, "eventType" | "eventTime">): DomainEvent {
  return {
    id: partial.id ?? partial.eventTime,
    employeeId: partial.employeeId ?? "emp-1",
    eventType: partial.eventType,
    eventTime: partial.eventTime,
    exitCategory: partial.exitCategory ?? null,
    exitReasonName: partial.exitReasonName ?? null,
    customExitReason: partial.customExitReason ?? null,
    nfcTagId: partial.nfcTagId ?? "tag",
  };
}

const base = {
  tag: { active: true, mode: "ENTRY" as const },
  paired: true,
  employeeActive: true,
  locationRequired: true,
  location: okLocation,
  duplicate: false,
  state: "NOT_ARRIVED" as const,
};

describe("senaryo 1 giriş çıkış dönüş mesai sonu", () => {
  it("durumları sırayla üretir", () => {
    const events = [
      event({ eventType: "ENTRY", eventTime: "2026-10-06T08:05:00+03:00" }),
      event({ eventType: "EXIT", eventTime: "2026-10-06T10:20:00+03:00", exitCategory: "OFFICIAL" }),
      event({ eventType: "RETURN", eventTime: "2026-10-06T11:15:00+03:00" }),
      event({ eventType: "END_OF_DAY", eventTime: "2026-10-06T17:05:00+03:00", exitCategory: "END_OF_DAY" }),
    ];
    expect(assessNfc({ ...base, state: "NOT_ARRIVED" }).action).toBe("CREATE");
    expect(deriveState(events.slice(0, 1))).toBe("INSIDE");
    expect(assessNfc({ ...base, tag: { active: true, mode: "EXIT" }, state: "INSIDE" }).action).toBe("SELECT_EXIT_REASON");
    expect(deriveState(events.slice(0, 2))).toBe("OUT_OFFICIAL");
    expect(assessNfc({ ...base, state: "OUT_OFFICIAL" })).toMatchObject({ action: "CREATE", eventType: "RETURN" });
    expect(deriveState(events.slice(0, 3))).toBe("INSIDE");
    expect(deriveState(events)).toBe("FINISHED");
  });
});

describe("senaryo 2 ve 3 çıkış nedeni", () => {
  const official: ExitReasonOption = {
    id: "reason-1",
    code: "OFFICIAL_FIELD",
    name: "Resmî görev",
    category: "OFFICIAL",
    allowNote: true,
    sortOrder: 10,
    active: true,
  };

  it("yalnızca özel metni saklar", () => {
    expect(resolveExitRecord({ preset: null, customRaw: "  Kaymakamlık toplantısı " })).toEqual({
      eventType: "EXIT",
      exitReasonId: null,
      customExitReason: "Kaymakamlık toplantısı",
      exitCategory: "OTHER",
    });
  });

  it("hazır neden ve açıklamayı birlikte saklar", () => {
    expect(resolveExitRecord({ preset: official, customRaw: "Kelkit Halk Eğitim Merkezi semineri" })).toMatchObject({
      eventType: "EXIT",
      exitReasonId: "reason-1",
      customExitReason: "Kelkit Halk Eğitim Merkezi semineri",
      exitCategory: "OFFICIAL",
    });
  });

  it("html kabul etmez", () => {
    expect(() => parseCustomExitReason("<script>alert(1)</script>")).toThrow(/düz metin/);
  });
});

describe("senaryo 4 6 7 8", () => {
  it("kısa sürede ikinci dokunuşu yok sayar", () => {
    expect(assessNfc({ ...base, duplicate: true }).action).toBe("DUPLICATE");
  });

  it("kurumdayken yeniden giriş açmaz", () => {
    expect(assessNfc({ ...base, state: "INSIDE" }).action).toBe("ALREADY_INSIDE");
  });

  it("dışarıdayken çıkış açmaz", () => {
    expect(assessExit({ ...base, tag: { active: true, mode: "EXIT" }, state: "OUT_OFFICIAL" }).action).toBe("ALREADY_OUTSIDE");
  });

  it("eşleşmemiş cihazda personel bağlamaz", () => {
    expect(assessNfc({ ...base, paired: false }).action).toBe("PAIR_REQUIRED");
  });

  it("mesai bitince yeniden giriş onayı ister ve onayda ENTRY üretir", () => {
    expect(assessNfc({ ...base, state: "FINISHED" }).action).toBe("CONFIRM_REENTRY");
    expect(assessReentry({ ...base, state: "FINISHED" })).toMatchObject({ action: "CREATE", eventType: "ENTRY" });
  });
});

describe("cihaz tanıma", () => {
  it("aynı cihazda üçten fazla giriş veya çıkış varsa tanınır", () => {
    expect(isDeviceRecognized(3, 3)).toBe(false);
    expect(isDeviceRecognized(4, 0)).toBe(true);
    expect(isDeviceRecognized(0, 4)).toBe(true);
  });
});

describe("senaryo 5 konum", () => {
  it("radius dışını reddeder", () => {
    const fix = measureLocation({
      siteLat: 40.0,
      siteLon: 39.0,
      allowedRadius: 150,
      latitude: 41.0,
      longitude: 39.0,
      accuracy: 20,
    });
    expect(fix.failure).toBe("OUTSIDE");
    expect(assessNfc({ ...base, location: fix }).action).toBe("LOCATION_OUTSIDE");
  });

  it("konum yoksa kaydetmez", () => {
    const fix = measureLocation({
      siteLat: 40,
      siteLon: 39,
      allowedRadius: 150,
      latitude: null,
      longitude: null,
      accuracy: null,
    });
    expect(assessNfc({ ...base, location: fix }).action).toBe("LOCATION_MISSING");
  });
});

describe("senaryo 9 denetim", () => {
  it("neden yoksa düzeltmeyi kabul etmez ve eski veriyi saklar", () => {
    const oldData = { event_type: "ENTRY", event_time: "2026-10-06T05:00:00.000Z" };
    expect(() =>
      buildAuditEntry({
        adminUserId: "admin",
        action: "UPDATE",
        tableName: "attendance_events",
        recordId: "1",
        oldData,
        newData: { event_type: "EXIT" },
        reason: "  ",
      }),
    ).toThrow(/zorunlu/);
    const entry = buildAuditEntry({
      adminUserId: "admin",
      action: "UPDATE",
      tableName: "attendance_events",
      recordId: "1",
      oldData,
      newData: { event_type: "EXIT" },
      reason: "Personel girişte NFC okutmayı unutmuş.",
    });
    expect(entry.old_data).toEqual(oldData);
    expect(entry.reason).toContain("unutmuş");
  });
});

describe("süre hesabı", () => {
  it("resmî görevi fiziksel süreye katmaz, mesai süresine katar", () => {
    const events = [
      event({ eventType: "ENTRY", eventTime: "2026-10-06T08:00:00+03:00" }),
      event({
        eventType: "EXIT",
        eventTime: "2026-10-06T10:00:00+03:00",
        exitCategory: "OFFICIAL",
        exitReasonName: "Resmî görev",
        customExitReason: "Kelkit Halk Eğitim Merkezi semineri",
      }),
      event({ eventType: "RETURN", eventTime: "2026-10-06T12:00:00+03:00" }),
      event({ eventType: "END_OF_DAY", eventTime: "2026-10-06T17:00:00+03:00", exitCategory: "END_OF_DAY" }),
    ];
    const day = calculateDay({
      events,
      day: "2026-10-06",
      workStart: "08:00",
      workEnd: "17:00",
      now: new Date("2026-10-06T18:00:00+03:00"),
    });
    expect(day.physicalMs).toBe(7 * 60 * 60 * 1000);
    expect(day.officialMs).toBe(2 * 60 * 60 * 1000);
    expect(day.dutyMs).toBe(9 * 60 * 60 * 1000);
    expect(day.officialDetails[0]?.custom).toBe("Kelkit Halk Eğitim Merkezi semineri");
    expect(day.lateMs).toBe(0);
    expect(day.earlyMs).toBe(0);
  });

  it("öğle arasını kurumda sayar, mesai dilimlerine katmaz", () => {
    const events = [
      event({ eventType: "ENTRY", eventTime: "2026-10-06T08:30:00+03:00" }),
      event({ eventType: "END_OF_DAY", eventTime: "2026-10-06T16:45:00+03:00", exitCategory: "END_OF_DAY" }),
    ];
    const day = calculateDay({
      events,
      day: "2026-10-06",
      workStart: "08:30",
      workEnd: "16:45",
      lunchStart: "11:50",
      lunchEnd: "13:10",
      now: new Date("2026-10-06T18:00:00+03:00"),
    });
    expect(day.physicalMs).toBe((8 * 60 + 15) * 60 * 1000);
    expect(day.dutyMs).toBe((6 * 60 + 55) * 60 * 1000);
    expect(day.lateMs).toBe(0);
    expect(day.earlyMs).toBe(0);
    expect(day.overtimeMs).toBe(0);
  });

  it("mesai bitiminden sonraki çıkışı fazla mesai sayar", () => {
    const events = [
      event({ eventType: "ENTRY", eventTime: "2026-10-06T08:30:00+03:00" }),
      event({ eventType: "END_OF_DAY", eventTime: "2026-10-06T18:00:00+03:00", exitCategory: "END_OF_DAY" }),
    ];
    const day = calculateDay({
      events,
      day: "2026-10-06",
      workStart: "08:30",
      workEnd: "16:45",
      lunchStart: "11:50",
      lunchEnd: "13:10",
      now: new Date("2026-10-06T18:10:00+03:00"),
    });
    expect(day.physicalMs).toBe((9 * 60 + 30) * 60 * 1000);
    expect(day.overtimeMs).toBe((1 * 60 + 15) * 60 * 1000);
    expect(day.dutyMs).toBe((8 * 60 + 10) * 60 * 1000);
    expect(day.state).toBe("FINISHED");
    const later = calculateDay({
      events,
      day: "2026-10-06",
      workStart: "08:30",
      workEnd: "16:45",
      lunchStart: "11:50",
      lunchEnd: "13:10",
      now: new Date("2026-10-06T23:30:00+03:00"),
    });
    expect(later.lastExit).toBe("2026-10-06T18:00:00+03:00");
    expect(later.overtimeMs).toBe((1 * 60 + 15) * 60 * 1000);
  });

  it("23:00'te hâlâ içerideyse çıkışı mesai bitişine alır", () => {
    const events = [event({ eventType: "ENTRY", eventTime: "2026-10-06T08:30:00+03:00" })];
    const open = calculateDay({
      events,
      day: "2026-10-06",
      workStart: "08:30",
      workEnd: "16:45",
      lunchStart: "11:50",
      lunchEnd: "13:10",
      now: new Date("2026-10-06T22:00:00+03:00"),
    });
    expect(open.state).toBe("INSIDE");
    expect(open.overtimeMs).toBe((5 * 60 + 15) * 60 * 1000);

    const closed = calculateDay({
      events,
      day: "2026-10-06",
      workStart: "08:30",
      workEnd: "16:45",
      lunchStart: "11:50",
      lunchEnd: "13:10",
      now: new Date("2026-10-06T23:00:00+03:00"),
    });
    expect(closed.state).toBe("FINISHED");
    expect(closed.lastExit).toBe(new Date("2026-10-06T16:45:00+03:00").toISOString());
    expect(closed.physicalMs).toBe((8 * 60 + 15) * 60 * 1000);
    expect(closed.dutyMs).toBe((6 * 60 + 55) * 60 * 1000);
    expect(closed.overtimeMs).toBe(0);
  });

  it("mesai sonuna 30 dakika kala önerir", () => {
    expect(shouldSuggestEndOfDay(new Date("2026-10-06T16:30:00+03:00"), "17:00", 30)).toBe(true);
    expect(shouldSuggestEndOfDay(new Date("2026-10-06T16:29:00+03:00"), "17:00", 30)).toBe(false);
    const ordered = orderExitReasons(
      [
        { code: "OFFICIAL_FIELD", sortOrder: 10 },
        { code: "END_OF_DAY", sortOrder: 80 },
      ],
      true,
    );
    expect(ordered[0]?.code).toBe("END_OF_DAY");
  });
});

describe("canlı durum ve rapor", () => {
  it("kurumdakileri sayar", () => {
    const now = new Date("2026-10-06T15:00:00+03:00");
    const presence = buildPresence({
      employees: [
        { id: "a", fullName: "Ahmet Yılmaz", department: "Birim", active: true },
        { id: "b", fullName: "Bilgen Karacan", department: "Birim", active: true },
      ],
      events: [
        event({ employeeId: "a", eventType: "ENTRY", eventTime: "2026-10-06T08:12:00+03:00" }),
        event({
          employeeId: "b",
          eventType: "ENTRY",
          eventTime: "2026-10-06T08:00:00+03:00",
        }),
        event({
          employeeId: "b",
          eventType: "EXIT",
          eventTime: "2026-10-06T10:18:00+03:00",
          exitCategory: "OFFICIAL",
          customExitReason: "Kaymakamlık toplantısı",
          exitReasonName: "Resmî görev",
        }),
      ],
      now,
    });
    expect(presence.counts.INSIDE).toBe(1);
    expect(presence.counts.OUT_OFFICIAL).toBe(1);
    expect(presence.rows.find((row) => row.employeeId === "b")?.lastDetail).toBe("Kaymakamlık toplantısı");
  });

  it("haftalık toplamı aynı kuralla üretir", () => {
    const events = [
      event({ eventType: "ENTRY", eventTime: "2026-10-05T08:00:00+03:00" }),
      event({ eventType: "END_OF_DAY", eventTime: "2026-10-05T17:00:00+03:00", exitCategory: "END_OF_DAY" }),
      event({ eventType: "ENTRY", eventTime: "2026-10-06T08:10:00+03:00" }),
      event({ eventType: "END_OF_DAY", eventTime: "2026-10-06T16:40:00+03:00", exitCategory: "END_OF_DAY" }),
    ];
    const [report] = buildReports({
      employees: [{ id: "emp-1", fullName: "Ahmet Yılmaz", department: null, workStart: "08:00", workEnd: "17:00" }],
      events,
      start: new Date("2026-10-05T00:00:00+03:00"),
      end: new Date("2026-10-06T23:00:00+03:00"),
      now: new Date("2026-10-07T09:00:00+03:00"),
      duplicateWindowSeconds: 30,
    });
    expect(report?.physicalMs).toBe(17 * 60 * 60 * 1000 + 30 * 60 * 1000);
    expect(report?.lateCount).toBe(1);
    expect(report?.earlyCount).toBe(1);
  });

  it("giriş ve çıkış olmayan günü izinde sayar ve ortalamadan çıkarır", () => {
    const events = [
      event({ eventType: "RETURN", eventTime: "2026-10-07T08:10:00+03:00" }),
      event({ eventType: "END_OF_DAY", eventTime: "2026-10-07T16:45:00+03:00", exitCategory: "END_OF_DAY" }),
    ];
    const [report] = buildReports({
      employees: [{ id: "emp-1", fullName: "Azade Toksoy", department: null, workStart: "08:30", workEnd: "16:45" }],
      events,
      start: new Date("2026-10-07T00:00:00+03:00"),
      end: new Date("2026-10-08T23:00:00+03:00"),
      now: new Date("2026-10-08T08:38:00+03:00"),
      duplicateWindowSeconds: 30,
    });
    expect(report?.days.find((day) => day.date === "2026-10-08")?.onLeave).toBe(true);
    expect(report?.days.find((day) => day.date === "2026-10-07")?.onLeave).toBe(false);
    expect(report?.leaveCount).toBe(1);
    expect(report?.missingCount).toBe(0);
    expect(report?.averageEntry).toBe("08:10");
    expect(report?.averageExit).toBe("16:45");
    expect(report?.physicalMs).toBe(report?.days.find((day) => day.date === "2026-10-07")?.physicalMs);
  });
});

describe("eşleştirme kodu", () => {
  it("düz metni saklamaz", () => {
    const hash = hashPairingCode("827194", "pepper-value-123456");
    expect(hash).not.toContain("827194");
    expect(verifyPairingCode("827194", hash, "pepper-value-123456")).toBe(true);
    expect(verifyPairingCode("000000", hash, "pepper-value-123456")).toBe(false);
  });
});

describe("hatalı kayıtlar", () => {
  it("girişsiz çıkışı ve açık günü işaretler", () => {
    const events = [event({ eventType: "EXIT", eventTime: "2026-10-05T10:00:00+03:00", exitCategory: "PERSONAL" })];
    const anomalies = findDayAnomalies({
      employeeId: "emp-1",
      day: "2026-10-05",
      events,
      duplicateWindowSeconds: 30,
      now: new Date("2026-10-06T09:00:00+03:00"),
    });
    expect(anomalies.map((item) => item.code)).toEqual(
      expect.arrayContaining(["EXIT_WITHOUT_ENTRY", "EXIT_WITHOUT_RETURN", "OPEN_AT_DAY_END"]),
    );
  });
});

describe("dün içeride kalan", () => {
  it("23:00 geçince unutulan çıkışı mesai bitişine alır ve ertesi gün taşımaz", () => {
    const events = [event({ eventType: "ENTRY", eventTime: "2026-10-05T08:30:00+03:00" })];
    expect(deriveCurrentPresence(events, new Date("2026-10-05T22:30:00+03:00"), "Europe/Istanbul", "16:45")).toEqual({
      state: "INSIDE",
      carried: false,
      assumedExit: null,
    });
    expect(deriveCurrentPresence(events, new Date("2026-10-05T23:00:00+03:00"), "Europe/Istanbul", "16:45").state).toBe(
      "FINISHED",
    );
    expect(deriveCurrentPresence(events, new Date("2026-10-06T09:00:00+03:00"), "Europe/Istanbul", "16:45")).toEqual({
      state: "NOT_ARRIVED",
      carried: false,
      assumedExit: null,
    });
  });

  it("23:00 sonrası dışarıda kalan uyarısını ertesi güne taşımaz", () => {
    const events = [
      event({ eventType: "ENTRY", eventTime: "2026-10-05T08:30:00+03:00" }),
      event({ eventType: "EXIT", eventTime: "2026-10-05T13:54:00+03:00", exitCategory: "OTHER", exitReasonName: "Diğer" }),
    ];
    expect(deriveCurrentPresence(events, new Date("2026-10-05T22:00:00+03:00")).state).toBe("OUT_OTHER");
    expect(deriveCurrentPresence(events, new Date("2026-10-05T23:00:00+03:00"))).toEqual({
      state: "NOT_ARRIVED",
      carried: false,
      assumedExit: null,
    });
    expect(deriveCurrentPresence(events, new Date("2026-10-06T08:24:00+03:00"))).toEqual({
      state: "NOT_ARRIVED",
      carried: false,
      assumedExit: null,
    });
  });
});

describe("sabah mesai başlangıcı", () => {
  it("07:00 ve sonrasındaki ilk gelişe mesaiye başladı yazar", () => {
    const arrival = event({ id: "in", eventType: "RETURN", eventTime: "2026-10-07T08:10:00+03:00" });
    expect(describeMovement(arrival, "Europe/Istanbul", [arrival]).title).toBe("Mesaiye başladı");
    const later = event({ id: "back", eventType: "RETURN", eventTime: "2026-10-07T14:00:00+03:00" });
    const day = [event({ id: "in", eventType: "ENTRY", eventTime: "2026-10-07T08:10:00+03:00" }), later];
    expect(describeMovement(later, "Europe/Istanbul", day).title).toBe("Dönüş");
  });

  it("09:00 ve sonrasındaki ilk gelişte geç kalma sebebi sorar", () => {
    const base = {
      eventType: "ENTRY" as const,
      state: "NOT_ARRIVED" as const,
      events: [],
      timeZone: "Europe/Istanbul",
    };
    expect(shouldAskLateReason({ ...base, now: new Date("2026-10-07T08:59:00+03:00") })).toBe(false);
    expect(shouldAskLateReason({ ...base, now: new Date("2026-10-07T09:00:00+03:00") })).toBe(true);
    expect(
      shouldAskLateReason({
        eventType: "RETURN",
        state: "OUT_PERSONAL",
        events: [event({ eventType: "ENTRY", eventTime: "2026-10-07T08:30:00+03:00" })],
        now: new Date("2026-10-07T10:00:00+03:00"),
      }),
    ).toBe(false);
  });
});
