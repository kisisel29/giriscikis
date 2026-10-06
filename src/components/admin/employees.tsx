"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/components/admin/api";

type Employee = {
  id: string;
  employeeCode: string;
  fullName: string;
  department: string | null;
  title: string | null;
  active: boolean;
  workStart: string;
  workEnd: string;
  lunchStart: string;
  lunchEnd: string;
  maxDevices: number;
};

const input = "min-h-11 rounded-xl border border-slate-200 px-3";

export function EmployeesManager() {
  const [rows, setRows] = useState<Employee[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setRows(await api<Employee[]>("/api/admin/employees"));
  }

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void load().catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Liste alınamadı."));
    }, 0);
    return () => window.clearTimeout(handle);
  }, []);

  return (
    <div className="grid gap-5">
      <h1 className="text-3xl font-semibold">Personel</h1>
      {error ? <p className="text-rose-700">{error}</p> : null}
      <form
        className="grid gap-2 rounded-3xl bg-white p-4 ring-1 ring-slate-200 md:grid-cols-3"
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          void api("/api/admin/employees", {
            method: "POST",
            body: JSON.stringify({
              employeeCode: form.get("employeeCode"),
              fullName: form.get("fullName"),
              department: form.get("department"),
              title: form.get("title"),
              workStart: form.get("workStart"),
              workEnd: form.get("workEnd"),
              lunchStart: "11:50",
              lunchEnd: "13:10",
              maxDevices: Number(form.get("maxDevices") || 1),
            }),
          })
            .then(() => load())
            .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Kaydedilemedi."));
          event.currentTarget.reset();
        }}
      >
        <input name="fullName" required placeholder="Ad soyad" className={input} />
        <input name="employeeCode" required placeholder="Personel kodu" className={input} />
        <input name="department" placeholder="Birim" className={input} />
        <input name="title" placeholder="Unvan" className={input} />
        <input name="workStart" type="time" defaultValue="08:30" className={input} />
        <input name="workEnd" type="time" defaultValue="16:45" className={input} />
        <input name="maxDevices" type="number" min={1} max={10} defaultValue={1} className={input} />
        <button className="min-h-11 rounded-xl bg-teal-800 font-semibold text-white">Personel ekle</button>
      </form>
      <div className="grid gap-2">
        {rows.map((row) => (
          <Link key={row.id} href={`/admin/employees/${row.id}`} className="rounded-2xl bg-white px-4 py-3 ring-1 ring-slate-200">
            <p className="font-semibold">{row.fullName}</p>
            <p className="text-sm text-slate-500">
              {row.employeeCode} · {row.department ?? "Birim yok"} · {row.workStart}–{row.lunchStart} / {row.lunchEnd}–{row.workEnd} · {row.active ? "Aktif" : "Pasif"}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
