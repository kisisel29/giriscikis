"use client";

import { useEffect, useState } from "react";
import { api } from "@/components/admin/api";

type Item = { code: string; label: string; employeeName: string; dateLabel: string; detail: string };

export function ReviewList() {
  const [rows, setRows] = useState<Item[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void api<Item[]>("/api/admin/review")
      .then(setRows)
      .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Liste alınamadı."));
  }, []);

  return (
    <div className="grid gap-3">
      <h1 className="text-3xl font-semibold">Kontrol edilmesi gereken kayıtlar</h1>
      <p className="text-slate-600">Bu liste yalnızca uyarır. Kayıtlar otomatik silinmez veya değiştirilmez.</p>
      {error ? <p className="text-rose-700">{error}</p> : null}
      {rows.length === 0 ? <p>Şu an kontrol gerektiren kayıt yok.</p> : null}
      {rows.map((row, index) => (
        <article key={`${row.code}-${index}`} className="rounded-2xl bg-white px-4 py-3 ring-1 ring-slate-200">
          <p className="font-semibold">{row.label}</p>
          <p className="text-sm text-slate-600">
            {row.employeeName} · {row.dateLabel}
          </p>
          <p className="text-sm">{row.detail}</p>
        </article>
      ))}
    </div>
  );
}
