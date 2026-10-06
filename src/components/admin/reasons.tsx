"use client";

import { useEffect, useState } from "react";
import { api } from "@/components/admin/api";
import type { ExitReasonOption } from "@/lib/attendance/types";

export function ReasonsManager() {
  const [rows, setRows] = useState<ExitReasonOption[]>([]);
  const [error, setError] = useState<string | null>(null);

  function load() {
    return api<ExitReasonOption[]>("/api/admin/exit-reasons").then(setRows);
  }

  useEffect(() => {
    void load().catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Liste alınamadı."));
  }, []);

  return (
    <div className="grid gap-4">
      <h1 className="text-3xl font-semibold">Çıkış nedenleri</h1>
      <p className="text-slate-600">Yeni bir hazır neden eklemek için kod değişikliği gerekmez.</p>
      {error ? <p className="text-rose-700">{error}</p> : null}
      <form
        className="grid gap-2 rounded-3xl bg-white p-4 ring-1 ring-slate-200 md:grid-cols-4"
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          void api("/api/admin/exit-reasons", {
            method: "POST",
            body: JSON.stringify({
              name: form.get("name"),
              category: form.get("category"),
              allowNote: true,
              sortOrder: Number(form.get("sortOrder") || 100),
            }),
          })
            .then(() => load())
            .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Eklenemedi."));
          event.currentTarget.reset();
        }}
      >
        <input name="name" required placeholder="Örneğin okul ziyareti" className="min-h-11 rounded-xl border px-3" />
        <select name="category" className="min-h-11 rounded-xl border px-3">
          <option value="OFFICIAL">Resmî</option>
          <option value="MEAL">Yemek</option>
          <option value="HEALTH">Sağlık</option>
          <option value="PERSONAL">Kişisel</option>
          <option value="OTHER">Diğer</option>
          <option value="END_OF_DAY">Mesai sonu</option>
        </select>
        <input name="sortOrder" type="number" placeholder="Sıra" className="min-h-11 rounded-xl border px-3" />
        <button className="min-h-11 rounded-xl bg-teal-800 font-semibold text-white">Neden ekle</button>
      </form>
      {rows.map((row) => (
        <article key={row.id} className="flex items-center justify-between rounded-2xl bg-white px-4 py-3 ring-1 ring-slate-200">
          <div>
            <p className="font-semibold">{row.name}</p>
            <p className="text-sm text-slate-500">{row.category} · {row.code}</p>
          </div>
          <button
            type="button"
            className="text-sm"
            onClick={() => void api(`/api/admin/exit-reasons/${row.id}`, { method: "PATCH", body: JSON.stringify({ active: false }) }).then(() => load())}
          >
            Pasif yap
          </button>
        </article>
      ))}
    </div>
  );
}
