"use client";

import { Fragment, useEffect, useState } from "react";
import { downloadFile, api } from "@/components/admin/api";

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

export function ReportView({ period }: { period: "daily" | "weekly" | "monthly" }) {
  const today = new Date();
  const [date, setDate] = useState(today.toISOString().slice(0, 10));
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [rows, setRows] = useState<Report[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const params = new URLSearchParams({ period });
  if (period === "daily") params.set("date", date);
  if (period === "weekly" && from && to) {
    params.set("preset", "custom");
    params.set("from", from);
    params.set("to", to);
  }
  if (period === "monthly") {
    params.set("year", String(year));
    params.set("month", String(month));
  }
  const query = params.toString();

  useEffect(() => {
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
      {period === "daily" ? <input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="min-h-11 max-w-xs rounded-xl border px-3" /> : null}
      {period === "weekly" ? (
        <div className="flex flex-wrap gap-2">
          <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="min-h-11 rounded-xl border px-3" />
          <input type="date" value={to} onChange={(event) => setTo(event.target.value)} className="min-h-11 rounded-xl border px-3" />
          <p className="self-center text-sm text-slate-500">Boş bırakılırsa bu hafta, Pazartesi-Pazar.</p>
        </div>
      ) : null}
      {period === "monthly" ? (
        <div className="flex gap-2">
          <input type="number" value={month} min={1} max={12} onChange={(event) => setMonth(Number(event.target.value))} className="min-h-11 w-24 rounded-xl border px-3" />
          <input type="number" value={year} onChange={(event) => setYear(Number(event.target.value))} className="min-h-11 w-32 rounded-xl border px-3" />
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
