"use client";

import { useEffect, useState } from "react";
import { api } from "@/components/admin/api";

type EventRow = {
  id: string;
  eventTime: string;
  employeeName: string;
  department: string | null;
  time: string;
  date: string;
  title: string;
  detail: string | null;
  eventType: string;
  category: string | null;
};

const presets = [
  ["today", "Bugün"],
  ["yesterday", "Dün"],
  ["week", "Bu hafta"],
  ["month", "Bu ay"],
] as const;

export function EventsFeed() {
  const [preset, setPreset] = useState("today");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [employee, setEmployee] = useState("");
  const [department, setDepartment] = useState("");
  const [category, setCategory] = useState("");
  const [rows, setRows] = useState<EventRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [editing, setEditing] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams({ preset });
    if (from && to) {
      params.set("preset", "custom");
      params.set("from", from);
      params.set("to", to);
    }
    if (department) params.set("department", department);
    if (category) params.set("category", category);
    void api<EventRow[]>(`/api/admin/events?${params.toString()}`)
      .then((items) => setRows(employee ? items.filter((item) => item.employeeName.toLocaleLowerCase("tr").includes(employee.toLocaleLowerCase("tr"))) : items))
      .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Hareketler alınamadı."));
  }, [preset, from, to, employee, department, category]);

  return (
    <div className="grid gap-4">
      <h1 className="text-3xl font-semibold">Hareketler</h1>
      <div className="flex flex-wrap gap-2">
        {presets.map(([value, label]) => (
          <button key={value} type="button" onClick={() => setPreset(value)} className={`rounded-full px-3 py-2 text-sm ${preset === value ? "bg-teal-800 text-white" : "bg-white ring-1 ring-slate-200"}`}>
            {label}
          </button>
        ))}
      </div>
      <div className="grid gap-2 md:grid-cols-5">
        <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="min-h-11 rounded-xl border px-3" />
        <input type="date" value={to} onChange={(event) => setTo(event.target.value)} className="min-h-11 rounded-xl border px-3" />
        <input value={employee} onChange={(event) => setEmployee(event.target.value)} placeholder="Personel" className="min-h-11 rounded-xl border px-3" />
        <input value={department} onChange={(event) => setDepartment(event.target.value)} placeholder="Departman" className="min-h-11 rounded-xl border px-3" />
        <select value={category} onChange={(event) => setCategory(event.target.value)} className="min-h-11 rounded-xl border px-3">
          <option value="">Çıkış kategorisi</option>
          <option value="OFFICIAL">Resmî</option>
          <option value="MEAL">Yemek</option>
          <option value="HEALTH">Sağlık</option>
          <option value="PERSONAL">Kişisel</option>
          <option value="END_OF_DAY">Mesai sonu</option>
          <option value="OTHER">Diğer</option>
        </select>
      </div>
      {error ? <p className="text-rose-700">{error}</p> : null}
      <div className="grid gap-2">
        {rows.map((row) => (
          <article key={row.id} className="rounded-2xl bg-white px-4 py-3 ring-1 ring-slate-200">
            <p>
              {row.date} {row.time} {row.employeeName} — {row.title}
            </p>
            {row.detail ? <p className="text-slate-600">“{row.detail}”</p> : null}
            <button type="button" className="mt-2 text-sm text-teal-800" onClick={() => setEditing(row.id)}>
              Düzelt
            </button>
            {editing === row.id ? (
              <form
                className="mt-2 grid gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  const form = new FormData(event.currentTarget);
                  void api(`/api/admin/attendance/${row.id}`, {
                    method: "PATCH",
                    body: JSON.stringify({
                      eventType: row.eventType,
                      eventTime: row.eventTime,
                      exitCategory: row.category,
                      customExitReason: form.get("custom") || null,
                      note: form.get("note") || null,
                      reason,
                    }),
                  })
                    .then(() => {
                      setEditing(null);
                      setPreset(preset);
                    })
                    .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Düzeltilemedi."));
                }}
              >
                <input name="custom" placeholder="Özel neden" className="min-h-11 rounded-xl border px-3" />
                <input name="note" placeholder="Not" className="min-h-11 rounded-xl border px-3" />
                <input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Düzeltme nedeni" required minLength={5} className="min-h-11 rounded-xl border px-3" />
                <button className="min-h-11 rounded-xl bg-slate-900 font-semibold text-white">Düzeltmeyi kaydet</button>
              </form>
            ) : null}
          </article>
        ))}
      </div>
    </div>
  );
}
