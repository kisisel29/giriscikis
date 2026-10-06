"use client";

import { useEffect, useState } from "react";
import { ensureDeviceSession } from "@/lib/supabase/browser";
import { STATE_LABELS } from "@/lib/attendance/labels";
import type { AttendanceState } from "@/lib/attendance/types";

type Status = {
  paired: boolean;
  organizationName?: string;
  greeting?: string;
  banner?: string;
  state?: AttendanceState;
  carried?: boolean;
  firstEntry?: string | null;
  physical?: string;
  duty?: string;
  movements?: { time: string; title: string; detail: string | null }[];
};

export function MeScreen() {
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        await ensureDeviceSession();
        const response = await fetch("/api/me");
        const payload = (await response.json()) as Status & { error?: string };
        if (!response.ok) {
          setError(payload.error ?? "Durum alınamadı.");
          return;
        }
        setStatus(payload);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Durum alınamadı.");
      }
    })();
  }, []);

  if (error) return <main className="grid min-h-full place-items-center px-5 text-center text-lg">{error}</main>;
  if (!status) return <main className="grid min-h-full place-items-center text-slate-500">Yükleniyor…</main>;
  if (!status.paired) {
    return (
      <main className="mx-auto grid min-h-full max-w-md place-items-center px-5 text-center">
        <div>
          <h1 className="text-2xl font-semibold">Cihaz henüz bağlı değil</h1>
          <p className="mt-3 text-slate-600">Giriş etiketine telefonunuzu yaklaştırın ve personel kodunuzla eşleştirin.</p>
        </div>
      </main>
    );
  }
  const tone = status.state ? STATE_LABELS[status.state] : null;
  return (
    <main className="mx-auto flex min-h-full w-full max-w-md flex-col gap-5 px-4 py-8">
      <p className="text-sm text-slate-500">{status.organizationName}</p>
      <h1 className="text-3xl font-semibold">{status.greeting}</h1>
      <div className={`rounded-3xl px-4 py-5 ${tone?.chip ?? "bg-white"}`}>
        <p className="text-sm font-medium tracking-wide">Şu anki durum</p>
        <p className="mt-1 text-2xl font-semibold">{status.banner}</p>
        {status.carried ? <p className="mt-2 text-sm">Dünden açık bir kayıt var.</p> : null}
      </div>
      <div className="grid grid-cols-1 gap-3">
        <Info label="Bugünkü ilk giriş" value={status.firstEntry ?? "—"} />
        <Info label="Bugün fiziksel olarak kurumda" value={status.physical ?? "—"} />
        <Info label="Mesai kapsamında" value={status.duty ?? "—"} />
      </div>
      <section>
        <h2 className="text-lg font-semibold">Bugünkü hareketler</h2>
        <div className="mt-3 grid gap-2">
          {status.movements?.length ? (
            status.movements.map((item, index) => (
              <article key={`${item.time}-${index}`} className="rounded-2xl bg-white px-4 py-3 ring-1 ring-slate-200">
                <p className="font-semibold">
                  {item.time} {item.title}
                </p>
                {item.detail ? <p className="text-slate-600">“{item.detail}”</p> : null}
              </article>
            ))
          ) : (
            <p className="text-slate-500">Bugün henüz hareket yok.</p>
          )}
        </div>
      </section>
    </main>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white px-4 py-3 ring-1 ring-slate-200">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}
