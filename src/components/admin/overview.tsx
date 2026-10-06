"use client";

import { useCallback, useEffect, useState } from "react";
import { STATE_LABELS } from "@/lib/attendance/labels";
import type { AttendanceState } from "@/lib/attendance/types";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { api } from "@/components/admin/api";

type Row = {
  employeeId: string;
  fullName: string;
  department: string | null;
  state: AttendanceState;
  carried: boolean;
  lastTime: string | null;
  lastTitle: string | null;
  lastDetail: string | null;
  stateLabel: string;
};

type Overview = {
  organizationName: string;
  generatedAt: string;
  counts: Record<AttendanceState, number>;
  rows: Row[];
  recent: { time: string; title: string; detail: string | null; employeeName: string }[];
  reviewCount: number;
};

const cards: { key: AttendanceState; label: string }[] = [
  { key: "INSIDE", label: "Kurumda" },
  { key: "OUT_OFFICIAL", label: "Resmî görevde" },
  { key: "OUT_PERSONAL", label: "Kişisel" },
  { key: "OUT_HEALTH", label: "Sağlık" },
  { key: "OUT_MEAL", label: "Yemekte" },
  { key: "NOT_ARRIVED", label: "Gelmedi" },
  { key: "FINISHED", label: "Mesaisi bitti" },
];

export function OverviewBoard({ mode }: { mode: "dashboard" | "live" | "presence" }) {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setData(await api<Overview>("/api/admin/overview"));
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Liste alınamadı.");
    }
  }, []);

  useEffect(() => {
    const kickoff = window.setTimeout(() => void reload(), 0);
    const timer = window.setInterval(() => void reload(), 20000);
    let channel: ReturnType<ReturnType<typeof createBrowserSupabase>["channel"]> | null = null;
    try {
      const supabase = createBrowserSupabase();
      channel = supabase
        .channel("attendance-live")
        .on("postgres_changes", { event: "*", schema: "public", table: "attendance_events" }, () => {
          void reload();
        })
        .subscribe();
    } catch {
      channel = null;
    }
    return () => {
      window.clearTimeout(kickoff);
      window.clearInterval(timer);
      if (channel) void createBrowserSupabase().removeChannel(channel);
    };
  }, [reload]);

  if (error) return <p className="text-rose-700">{error}</p>;
  if (!data) return <p className="text-slate-500">Yükleniyor…</p>;
  const inside = data.rows.filter((row) => row.state === "INSIDE");
  const official = data.rows.filter((row) => row.state === "OUT_OFFICIAL");
  const other = data.rows.filter((row) => ["OUT_PERSONAL", "OUT_HEALTH", "OUT_MEAL", "OUT_OTHER"].includes(row.state));

  if (mode === "presence") {
    return (
      <div className="grid gap-8">
        <section>
          <p className="text-sm tracking-[0.18em] text-teal-800">ŞU ANDA KURUMDA</p>
          <p className="text-7xl font-semibold">{inside.length}</p>
          <p className="text-lg">personel</p>
          <NameList rows={inside} />
        </section>
        <section>
          <h2 className="text-xl font-semibold">Kurum dışı resmî görevde</h2>
          <NameList rows={official} />
        </section>
        <section>
          <h2 className="text-xl font-semibold">Diğer nedenlerle dışarıda</h2>
          <NameList rows={other} />
        </section>
      </div>
    );
  }

  return (
    <div className="grid gap-5">
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-3xl font-semibold">{mode === "live" ? "Canlı durum" : data.organizationName}</h1>
          <p className="text-sm text-slate-500">Son güncelleme {data.generatedAt}</p>
        </div>
        {mode === "dashboard" ? <p className="rounded-2xl bg-amber-50 px-3 py-2 text-sm">Kontrol gereken: {data.reviewCount}</p> : null}
      </header>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map((card) => (
          <article key={card.key} className="rounded-3xl bg-white p-4 ring-1 ring-slate-200">
            <p className="text-sm text-slate-500">{card.label}</p>
            <p className="text-4xl font-semibold">{data.counts[card.key] ?? 0}</p>
          </article>
        ))}
      </div>
      <section className="overflow-hidden rounded-3xl bg-white ring-1 ring-slate-200">
        {data.rows.map((row) => (
          <article key={row.employeeId} className="grid gap-1 border-b border-slate-100 px-4 py-3 last:border-0 md:grid-cols-[1.4fr_1fr_1fr]">
            <div>
              <p className="font-semibold">{row.fullName}</p>
              <p className="text-sm text-slate-500">{row.department ?? "—"}</p>
            </div>
            <p className={`w-fit rounded-full px-2 py-1 text-sm font-medium ${STATE_LABELS[row.state].chip}`}>
              {row.stateLabel}
              {row.carried ? " · dünden açık" : ""}
            </p>
            <p className="text-sm">
              {row.lastTime ?? "—"} {row.lastTitle ?? ""}
              {row.lastDetail ? <span className="block text-slate-600">“{row.lastDetail}”</span> : null}
            </p>
          </article>
        ))}
      </section>
      {mode === "dashboard" ? (
        <section>
          <h2 className="mb-2 text-lg font-semibold">Son hareketler</h2>
          {data.recent.map((item, index) => (
            <p key={`${item.employeeName}-${index}`} className="border-b border-slate-200 py-2 text-sm">
              {item.time} {item.employeeName} — {item.title}
              {item.detail ? ` “${item.detail}”` : ""}
            </p>
          ))}
        </section>
      ) : null}
    </div>
  );
}

function NameList({ rows }: { rows: Row[] }) {
  if (rows.length === 0) return <p className="mt-2 text-slate-500">Kayıt yok.</p>;
  return (
    <div className="mt-3 grid gap-2">
      {rows.map((row) => (
        <article key={row.employeeId} className="rounded-2xl bg-white px-4 py-3 ring-1 ring-slate-200">
          <p className="text-lg font-semibold">{row.fullName}</p>
          <p className="text-sm text-slate-600">
            {row.stateLabel}
            {row.lastDetail ? ` “${row.lastDetail}”` : ""}
          </p>
          {row.lastTime ? <p className="text-sm text-slate-500">Son hareket {row.lastTime}</p> : null}
        </article>
      ))}
    </div>
  );
}
