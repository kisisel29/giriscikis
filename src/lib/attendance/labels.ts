import type { AnomalyCode, AttendanceState, DomainEvent, EventType } from "@/lib/attendance/types";
import { formatTime } from "@/lib/time";

export const STATE_LABELS: Record<AttendanceState, { title: string; banner: string; dot: string; chip: string }> = {
  NOT_ARRIVED: {
    title: "Gelmedi",
    banner: "HENÜZ GİRİŞ YOK",
    dot: "bg-slate-400",
    chip: "bg-slate-100 text-slate-700",
  },
  INSIDE: {
    title: "Kurumda",
    banner: "KURUMDASINIZ",
    dot: "bg-emerald-500",
    chip: "bg-emerald-50 text-emerald-800",
  },
  OUT_OFFICIAL: {
    title: "Resmî görevde",
    banner: "RESMÎ GÖREVDESİNİZ",
    dot: "bg-sky-500",
    chip: "bg-sky-50 text-sky-800",
  },
  OUT_PERSONAL: {
    title: "Kişisel çıkışta",
    banner: "KİŞİSEL ÇIKIŞTASINIZ",
    dot: "bg-amber-500",
    chip: "bg-amber-50 text-amber-900",
  },
  OUT_HEALTH: {
    title: "Sağlık nedeniyle dışarıda",
    banner: "SAĞLIK NEDENİYLE DIŞARIDASINIZ",
    dot: "bg-rose-500",
    chip: "bg-rose-50 text-rose-800",
  },
  OUT_MEAL: {
    title: "Yemekte",
    banner: "YEMEKTESİNİZ",
    dot: "bg-orange-500",
    chip: "bg-orange-50 text-orange-900",
  },
  OUT_OTHER: {
    title: "Diğer nedenle dışarıda",
    banner: "DİĞER NEDENLE DIŞARIDASINIZ",
    dot: "bg-violet-500",
    chip: "bg-violet-50 text-violet-800",
  },
  FINISHED: {
    title: "Mesaisi bitti",
    banner: "MESAİNİZ BİTTİ",
    dot: "bg-zinc-500",
    chip: "bg-zinc-100 text-zinc-700",
  },
};

export const ANOMALY_LABELS: Record<AnomalyCode, string> = {
  EXIT_WITHOUT_ENTRY: "Giriş olmadan çıkış",
  DOUBLE_ENTRY: "Arka arkaya iki giriş",
  DOUBLE_EXIT: "Arka arkaya iki çıkış",
  EXIT_WITHOUT_RETURN: "Çıkış sonrası dönüş yok",
  OPEN_AT_DAY_END: "Gün sonunda açık kalan kayıt",
  CARRIED_INSIDE: "Önceki günden içeride kalan kişi",
  DUPLICATE_EVENT: "Kısa sürede mükerrer kayıt",
  AFTER_END_OF_DAY: "Mesai sonu sonrası olağandışı kayıt",
};

export const EVENT_LABELS: Record<EventType, string> = {
  ENTRY: "Giriş",
  EXIT: "Çıkış",
  RETURN: "Dönüş",
  END_OF_DAY: "Mesai sonu",
};

export function movementTitle(event: Pick<DomainEvent, "eventType" | "exitReasonName" | "customExitReason">): string {
  if (event.eventType === "ENTRY") return "Giriş";
  if (event.eventType === "RETURN") return "Dönüş";
  if (event.eventType === "END_OF_DAY") return event.customExitReason ? "Mesai sonu" : "Mesai sonu";
  return event.exitReasonName || event.customExitReason || "Çıkış";
}

export function movementDetail(event: Pick<DomainEvent, "eventType" | "exitReasonName" | "customExitReason">): string | null {
  if (!event.customExitReason) return null;
  if (event.eventType === "ENTRY" || event.eventType === "RETURN") return null;
  if (event.exitReasonName && event.exitReasonName !== event.customExitReason) return event.customExitReason;
  if (!event.exitReasonName) return null;
  return event.customExitReason;
}

export function describeMovement(event: DomainEvent, timeZone?: string): { time: string; title: string; detail: string | null } {
  const title = movementTitle(event);
  const detail =
    event.customExitReason && title !== event.customExitReason ? event.customExitReason : movementDetail(event);
  return {
    time: formatTime(event.eventTime, timeZone),
    title,
    detail: detail && detail !== title ? detail : null,
  };
}

export function greeting(fullName: string, now: Date, timeZone?: string): string {
  const hour = Number(formatTime(now, timeZone).slice(0, 2));
  const hello = hour < 11 ? "Günaydın" : hour < 18 ? "İyi günler" : "İyi akşamlar";
  const first = fullName.trim().split(/\s+/)[0] || fullName;
  return `${hello} ${first}`;
}
