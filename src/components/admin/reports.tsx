"use client";

import { Fragment, useEffect, useState } from "react";
import { downloadFile, api } from "@/components/admin/api";
import { dayKey, endOfWeek, startOfWeek } from "@/lib/time";

type Day = {
  date: string;
  dateLabel: string;
  firstEntryLabel: string;
  lastExitLabel: string;
  physical: string;
  official: string;
  personal: string;
  other: string;
  stateLabel: string;
};

type Report = {
  employeeId: string;
  fullName: string;
  department: string | null;
  physical: string;
  duty: string;
  overtime: string;
  official: string;
  personal: string;
  other: string;
  averageEntry: string | null;
  averageExit: string | null;
  lateCount: number;
  late: string;
  earlyCount: number;
  early: string;
  missingCount: number;
  days: Day[];
  officialDetails: { dateLabel: string; label: string; custom: string | null; duration: string }[];
};

function shiftDay(key: string, days: number): string {
  return dayKey(new Date(new Date(`${key}T12:00:00+03:00`).getTime() + days * 24 * 60 * 60 * 1000));
}

function labelDay(key: string): string {
  const [year, month, day] = key.split("-");
  if (!year || !month || !day) return key;
  return `${day}.${month}.${year}`;
}

function DayField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="grid gap-1 text-sm font-medium">
      <span>{label}</span>
      <span className="flex flex-wrap items-center gap-2">
        <button type="button" className="min-h-11 rounded-xl bg-white px-3 ring-1 ring-slate-200" onClick={() => onChange(shiftDay(value, -1))}>
          Önceki gün
        </button>
        <input type="date" value={value} aria-label={label} onChange={(event) => onChange(event.target.value)} className="min-h-11 rounded-xl border px-3" />
        <button type="button" className="min-h-11 rounded-xl bg-white px-3 ring-1 ring-slate-200" onClick={() => onChange(shiftDay(value, 1))}>
          Sonraki gün
        </button>
        <span className="text-slate-600">{labelDay(value)}</span>
      </span>
    </div>
  );
}

export function ReportView({ period }: { period: "daily" | "weekly" | "monthly" }) {
  const todayKey = dayKey(new Date());
  const [date, setDate] = useState(todayKey);
  const [from, setFrom] = useState(dayKey(startOfWeek(new Date())));
  const [to, setTo] = useState(dayKey(endOfWeek(new Date())));
  const [anchor, setAnchor] = useState(todayKey);
  const [rows, setRows] = useState<Report[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const params = new URLSearchParams({ period });
  if (period === "daily") params.set("date", date);
  if (period === "weekly" && from && to) {
    params.set("preset", "custom");
    params.set("from", from <= to ? from : to);
    params.set("to", from <= to ? to : from);
  }
  if (period === "monthly") {
    params.set("year", anchor.slice(0, 4));
    params.set("month", String(Number(anchor.slice(5, 7))));
  }
  const query = params.toString();

  useEffect(() => {
    setError(null);
    void api<{ reports: Report[] }>(`/api/admin/reports?${query}`)
      .then((data) => setRows(data.reports))
      .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Rapor alınamadı."));
  }, [query]);

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-semibold">{period === "daily" ? "Günlük rapor" : period === "weekly" ? "Haftalık rapor" : "Aylık rapor"}</h1>
        <div className="flex gap-2">
          <button type="button" className="rounded-xl bg-white px-3 py-2 ring-1 ring-slate-200" onClick={() => void downloadFile(`/api/admin/reports/export?format=xlsx&${query}`, `${period}-rapor.xlsx`)}>
            XLSX
          </button>
          <button type="button" className="rounded-xl bg-white px-3 py-2 ring-1 ring-slate-200" onClick={() => void downloadFile(`/api/admin/reports/export?format=pdf&${query}`, `${period}-rapor.pdf`)}>
            PDF
          </button>
        </div>
      </div>
      {period === "daily" ? (
        <div className="flex flex-wrap items-end gap-2">
          <DayField label="Rapor günü" value={date} onChange={setDate} />
          <button type="button" className="min-h-11 rounded-xl bg-white px-3 ring-1 ring-slate-200" onClick={() => setDate(todayKey)}>
            Bugün
          </button>
        </div>
      ) : null}
      {period === "weekly" ? (
        <div className="flex flex-wrap items-end gap-4">
          <DayField label="Başlangıç günü" value={from} onChange={setFrom} />
          <DayField label="Bitiş günü" value={to} onChange={setTo} />
        </div>
      ) : null}
      {period === "monthly" ? (
        <div className="flex flex-wrap items-end gap-2">
          <DayField label="Ayın herhangi bir günü" value={anchor} onChange={setAnchor} />
          <p className="pb-3 text-sm text-slate-500">Seçilen günün ayı raporlanır.</p>
        </div>
      ) : null}
      {error ? <p className="text-rose-700">{error}</p> : null}
      <div className="overflow-x-auto rounded-3xl bg-white ring-1 ring-slate-200">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="text-slate-500">
            <tr>
              <th className="px-3 py-3">Personel</th>
              <th>İlk giriş</th>
              <th>Son çıkış</th>
              <th>Kurumda</th>
              <th>Resmî görev</th>
              <th>Kişisel</th>
              <th>Diğer</th>
              <th>Durum</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const day = row.days[0];
              return (
                <Fragment key={row.employeeId}>
                  <tr className="border-t border-slate-100">
                    <td className="px-3 py-3">
                      <button type="button" className="font-semibold" onClick={() => setOpen(open === row.employeeId ? null : row.employeeId)}>
                        {row.fullName}
                      </button>
                      <p className="text-slate-500">{row.department ?? "—"}</p>
                    </td>
                    <td>{period === "daily" ? day?.firstEntryLabel : row.averageEntry ?? "—"}</td>
                    <td>{period === "daily" ? day?.lastExitLabel : row.averageExit ?? "—"}</td>
                    <td>{period === "daily" ? day?.physical : row.physical}</td>
                    <td>{period === "daily" ? day?.official : row.official}</td>
                    <td>{period === "daily" ? day?.personal : row.personal}</td>
                    <td>{period === "daily" ? day?.other : row.other}</td>
                    <td>{period === "daily" ? day?.stateLabel : `${row.missingCount} eksik`}</td>
                  </tr>
                  {open === row.employeeId ? (
                    <tr key={`${row.employeeId}-detail`}>
                      <td colSpan={8} className="bg-slate-50 px-3 py-3">
                        <p>
                          Mesai kapsamı {row.duty}. Fazla mesai {row.overtime}. Geç giriş {row.lateCount} ({row.late}). Erken çıkış {row.earlyCount} ({row.early}).
                        </p>
                        {period !== "daily"
                          ? row.days.map((item) => (
                              <p key={item.date} className="mt-1">
                                {item.dateLabel}: giriş {item.firstEntryLabel}, çıkış {item.lastExitLabel}, kurumda {item.physical}, {item.stateLabel}
                              </p>
                            ))
                          : null}
                        {row.officialDetails.map((detail, index) => (
                          <p key={`${detail.dateLabel}-${index}`} className="mt-1">
                            {detail.dateLabel} {detail.label}
                            {detail.custom ? ` “${detail.custom}”` : ""} · {detail.duration}
                          </p>
                        ))}
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
