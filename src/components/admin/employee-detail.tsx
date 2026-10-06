"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/components/admin/api";

type Payload = {
  employee: {
    id: string;
    employeeCode: string;
    fullName: string;
    department: string | null;
    title: string | null;
    active: boolean;
    workStart: string;
    workEnd: string;
    maxDevices: number;
  };
  devices: { id: string; deviceName: string | null; active: boolean; pairedAt: string; lastSeenAt: string | null }[];
  history: { id: string; when: string; time: string; title: string; detail: string | null }[];
};

export function EmployeeDetail({ id }: { id: string }) {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => api<Payload>(`/api/admin/employees/${id}`).then(setData), [id]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void load().catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Kayıt alınamadı."));
    }, 0);
    return () => window.clearTimeout(handle);
  }, [load]);

  if (error) return <p className="text-rose-700">{error}</p>;
  if (!data) return <p>Yükleniyor…</p>;
  const employee = data.employee;

  return (
    <div className="grid gap-5">
      <h1 className="text-3xl font-semibold">{employee.fullName}</h1>
      <form
        className="grid gap-2 rounded-3xl bg-white p-4 ring-1 ring-slate-200 md:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          void api(`/api/admin/employees/${id}`, {
            method: "PATCH",
            body: JSON.stringify({
              fullName: form.get("fullName"),
              employeeCode: form.get("employeeCode"),
              department: form.get("department"),
              title: form.get("title"),
              workStart: form.get("workStart"),
              workEnd: form.get("workEnd"),
              maxDevices: Number(form.get("maxDevices")),
              active: form.get("active") === "on",
            }),
          })
            .then(() => load())
            .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Kaydedilemedi."));
        }}
      >
        <input name="fullName" defaultValue={employee.fullName} className="min-h-11 rounded-xl border px-3" />
        <input name="employeeCode" defaultValue={employee.employeeCode} className="min-h-11 rounded-xl border px-3" />
        <input name="department" defaultValue={employee.department ?? ""} className="min-h-11 rounded-xl border px-3" />
        <input name="title" defaultValue={employee.title ?? ""} className="min-h-11 rounded-xl border px-3" />
        <input name="workStart" type="time" defaultValue={employee.workStart} className="min-h-11 rounded-xl border px-3" />
        <input name="workEnd" type="time" defaultValue={employee.workEnd} className="min-h-11 rounded-xl border px-3" />
        <input name="maxDevices" type="number" min={1} max={10} defaultValue={employee.maxDevices} className="min-h-11 rounded-xl border px-3" />
        <label className="flex items-center gap-2">
          <input name="active" type="checkbox" defaultChecked={employee.active} /> Aktif
        </label>
        <button className="min-h-11 rounded-xl bg-teal-800 font-semibold text-white">Kaydet</button>
      </form>
      <section className="rounded-3xl bg-white p-4 ring-1 ring-slate-200">
        <h2 className="text-lg font-semibold">Cihazlar</h2>
        <p className="mt-1 text-sm text-slate-500">Telefon ilk kez giriş etiketine dokununca personel koduyla bağlanır.</p>
        {data.devices.map((device) => (
          <div key={device.id} className="mt-3 flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
            <div>
              <p>{device.deviceName ?? "Telefon"}</p>
              <p className="text-sm text-slate-500">{device.active ? "Bağlı" : "Kaldırıldı"}</p>
            </div>
            {device.active ? (
              <button
                type="button"
                className="text-sm text-rose-700"
                onClick={() => {
                  void api(`/api/admin/employees/${id}/devices/${device.id}`, { method: "DELETE" }).then(() => load());
                }}
              >
                Cihaz bağlantısını kaldır
              </button>
            ) : null}
          </div>
        ))}
      </section>
      <section>
        <h2 className="text-lg font-semibold">Hareketler</h2>
        {data.history.map((item) => (
          <p key={item.id} className="border-b border-slate-200 py-2 text-sm">
            {item.when} — {item.title}
            {item.detail ? ` “${item.detail}”` : ""}
          </p>
        ))}
      </section>
    </div>
  );
}
