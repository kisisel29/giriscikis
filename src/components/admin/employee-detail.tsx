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
    lunchStart: string;
    lunchEnd: string;
    maxDevices: number;
  };
  devices: { id: string; deviceName: string | null; active: boolean; pairedAt: string; lastSeenAt: string | null }[];
  history: {
    id: string;
    eventType: string;
    eventTime: string;
    when: string;
    time: string;
    title: string;
    detail: string | null;
    exitCategory: string | null;
    customExitReason: string | null;
  }[];
};

function dateTimeLocal(iso: string): string {
  const date = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function EmployeeDetail({ id }: { id: string }) {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [reasons, setReasons] = useState<{ id: string; name: string; category: string; active: boolean }[]>([]);

  useEffect(() => {
    void api<{ id: string; name: string; category: string; active: boolean }[]>("/api/admin/exit-reasons")
      .then((items) => setReasons(items.filter((item) => item.active)))
      .catch(() => setReasons([]));
  }, []);

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
              lunchStart: form.get("lunchStart"),
              lunchEnd: form.get("lunchEnd"),
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
        <input name="workStart" type="time" aria-label="Sabah mesai başı" defaultValue={employee.workStart} className="min-h-11 rounded-xl border px-3" />
        <input name="lunchStart" type="time" aria-label="Öğle arası başlangıcı" defaultValue={employee.lunchStart} className="min-h-11 rounded-xl border px-3" />
        <input name="lunchEnd" type="time" aria-label="Öğle arası bitişi" defaultValue={employee.lunchEnd} className="min-h-11 rounded-xl border px-3" />
        <input name="workEnd" type="time" aria-label="Akşam mesai sonu" defaultValue={employee.workEnd} className="min-h-11 rounded-xl border px-3" />
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
          <div key={item.id} className="border-b border-slate-200 py-2 text-sm">
            <p>
              {item.when} — {item.title}
              {item.detail ? ` “${item.detail}”` : ""}
            </p>
            <button type="button" className="mt-1 text-teal-800" onClick={() => setEditing(editing === item.id ? null : item.id)}>
              Saati düzelt
            </button>
            {editing === item.id ? (
              <form
                className="mt-2 grid gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  const form = new FormData(event.currentTarget);
                  void api(`/api/admin/attendance/${item.id}`, {
                    method: "PATCH",
                    body: JSON.stringify({
                      eventType: item.eventType,
                      eventTime: new Date(String(form.get("eventTime"))).toISOString(),
                      exitCategory: item.exitCategory,
                      customExitReason: item.customExitReason,
                      reason: form.get("reason"),
                    }),
                  })
                    .then(() => {
                      setEditing(null);
                      return load();
                    })
                    .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Saat düzeltilemedi."));
                }}
              >
                <input name="eventTime" type="datetime-local" required defaultValue={dateTimeLocal(item.eventTime)} className="min-h-11 rounded-xl border px-3" />
                <input name="reason" required minLength={5} placeholder="Düzeltme nedeni" className="min-h-11 rounded-xl border px-3" />
                <button className="min-h-11 rounded-xl bg-slate-900 font-semibold text-white">Saati kaydet</button>
              </form>
            ) : null}
          </div>
        ))}
        <form
          className="mt-4 grid gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            const formElement = event.currentTarget;
            const form = new FormData(formElement);
            const kind = String(form.get("kind") ?? "ENTRY");
            const exitReasonId = String(form.get("exitReasonId") ?? "");
            if (kind === "EXIT" && !exitReasonId) {
              setError("Çıkış için bir neden seçin.");
              return;
            }
            void api("/api/admin/attendance", {
              method: "POST",
              body: JSON.stringify({
                employeeId: id,
                eventType: kind === "EXIT" ? "EXIT" : "ENTRY",
                eventTime: new Date(String(form.get("eventTime"))).toISOString(),
                exitReasonId: kind === "EXIT" && exitReasonId ? exitReasonId : null,
                reason: form.get("reason"),
              }),
            })
              .then(() => {
                formElement.reset();
                return load();
              })
              .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Kayıt eklenemedi."));
          }}
        >
          <h3 className="font-semibold">Unutulan hareket</h3>
          <select name="kind" className="min-h-11 rounded-xl border px-3" defaultValue="ENTRY">
            <option value="ENTRY">Giriş</option>
            <option value="EXIT">Çıkış</option>
          </select>
          <input name="eventTime" type="datetime-local" required className="min-h-11 rounded-xl border px-3" />
          <select
            key={reasons.find((item) => item.category === "END_OF_DAY")?.id ?? "exit-reason"}
            name="exitReasonId"
            className="min-h-11 rounded-xl border px-3"
            defaultValue={reasons.find((item) => item.category === "END_OF_DAY")?.id ?? ""}
          >
            <option value="">Çıkış nedeni</option>
            {reasons.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          <input name="reason" required minLength={5} placeholder="Neden ekleniyor?" className="min-h-11 rounded-xl border px-3" />
          <button className="min-h-11 rounded-xl bg-teal-800 font-semibold text-white">Kaydı ekle</button>
        </form>
      </section>
    </div>
  );
}
