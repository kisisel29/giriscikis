"use client";

import { Fragment, useEffect, useState } from "react";
import { downloadFile, api } from "@/components/admin/api";
import { dayKey } from "@/lib/time";

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
  leaveCount: number;
  days: Day[];
  officialDetails: { dateLabel: string; label: string; custom: string | null; duration: string }[];
};

function labelDay(key: string): string {
  const [year, month, day] = key.split("-");
  if (!year || !month || !day) return key;
  return `${day}.${month}.${year}`;
}

export function ReportView() {
  const todayKey = dayKey(new Date());
  const [from, setFrom] = useState(todayKey);
  const [to, setTo] = useState(todayKey);
  const [rows, setRows] = useState<Report[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [eraseDay, setEraseDay] = useState(todayKey);
  const [removing, setRemoving] = useState(false);
  const [reload, setReload] = useState(0);
  const start = from <= to ? from : to;
  const end = from <= to ? to : from;
  const singleDay = start === end;
  const query = new URLSearchParams({ preset: "custom", from: start, to: end }).toString();

  useEffect(() => {
    setError(null);
    void api<{ reports: Report[] }>(`/api/admin/reports?${query}`)
      .then((data) => setRows(data.reports))
      .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Rapor alınamadı."));
  }, [query, reload]);

  async function removeDay(date: string, employeeId?: string, name?: string) {
    const label = labelDay(date);
    const scope = name ? `${name} için ` : "tüm personelin ";
    if (!window.confirm(`${label} gününde ${scope}giriş ve çıkış kayıtları silinsin mi?`)) return;
    setRemoving(true);
    setError(null);
    try {
      const params = new URLSearchParams({ date });
      if (employeeId) params.set("employeeId", employeeId);
      const result = await api<{ deleted: number }>(`/api/admin/attendance/day?${params}`, { method: "DELETE" });
      if (result.deleted === 0) {
        setError(`${label} gününde silinecek kayıt yok.`);
        return;
      }
      setReload((value) => value + 1);
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "Günün kayıtları silinemedi.");
    } finally {
      setRemoving(false);
    }
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-semibold">Rapor</h1>
        <div className="flex gap-2">
          <button type="button" className="rounded-xl bg-white px-3 py-2 ring-1 ring-slate-200" onClick={() => void downloadFile(`/api/admin/reports/export?format=xlsx&${query}`, "rapor.xlsx")}>
            XLSX
          </button>
          <button type="button" className="rounded-xl bg-white px-3 py-2 ring-1 ring-slate-200" onClick={() => void downloadFile(`/api/admin/reports/export?format=pdf&${query}`, "rapor.pdf")}>
            PDF
          </button>
        </div>
      </div>
      <div className="flex flex-wrap items-end gap-4">
        <label className="grid gap-1 text-sm font-medium">
          Başlangıç
          <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="min-h-11 rounded-xl border px-3" />
        </label>
        <label className="grid gap-1 text-sm font-medium">
          Bitiş
          <input type="date" value={to} onChange={(event) => setTo(event.target.value)} className="min-h-11 rounded-xl border px-3" />
        </label>
        <p className="pb-3 text-sm text-slate-500">
          {labelDay(start)} – {labelDay(end)}
        </p>
        <label className="grid gap-1 text-sm font-medium">
          Silinecek gün
          <input type="date" value={eraseDay} onChange={(event) => setEraseDay(event.target.value)} className="min-h-11 rounded-xl border px-3" />
        </label>
        <button
          type="button"
          disabled={removing || !eraseDay}
          onClick={() => void removeDay(eraseDay)}
          className="min-h-11 rounded-xl bg-rose-800 px-4 font-semibold text-white disabled:opacity-50"
        >
          Günün kayıtlarını sil
        </button>
      </div>
      {error ? <p className="text-rose-700">{error}</p> : null}
      <div className="overflow-x-auto rounded-3xl bg-white ring-1 ring-slate-200">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="text-slate-500">
            <tr>
              <th className="px-3 py-3">Personel</th>
              <th>{singleDay ? "İlk giriş" : "Ort. giriş"}</th>
              <th>{singleDay ? "Son çıkış" : "Ort. çıkış"}</th>
              <th>Kurumda</th>
              <th>Resmî görev</th>
              <th>Kişisel</th>
              <th>Diğer</th>
              <th>{singleDay ? "Durum" : "Eksik gün"}</th>
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
                    <td>{singleDay ? day?.firstEntryLabel : row.averageEntry ?? "—"}</td>
                    <td>{singleDay ? day?.lastExitLabel : row.averageExit ?? "—"}</td>
                    <td>{singleDay ? day?.physical : row.physical}</td>
                    <td>{singleDay ? day?.official : row.official}</td>
                    <td>{singleDay ? day?.personal : row.personal}</td>
                    <td>{singleDay ? day?.other : row.other}</td>
                    <td>{singleDay ? day?.stateLabel : `${row.missingCount} eksik`}</td>
                  </tr>
                  {open === row.employeeId ? (
                    <tr key={`${row.employeeId}-detail`}>
                      <td colSpan={8} className="bg-slate-50 px-3 py-3">
                        <p>
                          Mesai kapsamı {row.duty}. Fazla mesai {row.overtime}. Geç giriş {row.lateCount} ({row.late}). Erken çıkış {row.earlyCount} ({row.early}). İzinli gün {row.leaveCount}.
                        </p>
                        {singleDay
                          ? null
                          : row.days.map((item) => (
                              <p key={item.date} className="mt-1 flex flex-wrap items-center gap-2">
                                <span>
                                  {item.dateLabel}: giriş {item.firstEntryLabel}, çıkış {item.lastExitLabel}, kurumda {item.physical}, {item.stateLabel}
                                </span>
                                <button
                                  type="button"
                                  disabled={removing}
                                  onClick={() => void removeDay(item.date, row.employeeId, row.fullName)}
                                  className="rounded-lg px-2 py-1 text-rose-800 ring-1 ring-rose-200 disabled:opacity-50"
                                >
                                  Sil
                                </button>
                              </p>
                            ))}
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
