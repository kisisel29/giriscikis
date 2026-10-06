"use client";

import { useEffect, useState } from "react";
import { api } from "@/components/admin/api";
import type { ExitCategory, ExitReasonOption } from "@/lib/attendance/types";

const CATEGORIES: Array<[ExitCategory, string]> = [
  ["OFFICIAL", "Resmî"],
  ["MEAL", "Yemek"],
  ["HEALTH", "Sağlık"],
  ["PERSONAL", "Kişisel"],
  ["OTHER", "Diğer"],
  ["END_OF_DAY", "Mesai sonu"],
];

function categoryLabel(category: ExitCategory): string {
  return CATEGORIES.find(([value]) => value === category)?.[1] ?? category;
}

export function ReasonsManager() {
  const [rows, setRows] = useState<ExitReasonOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function load() {
    return api<ExitReasonOption[]>("/api/admin/exit-reasons").then(setRows);
  }

  useEffect(() => {
    void load().catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Liste alınamadı."));
  }, []);

  function fail(caught: unknown, fallback: string) {
    setError(caught instanceof Error ? caught.message : fallback);
  }

  return (
    <div className="grid gap-4">
      <h1 className="text-3xl font-semibold">Çıkış nedenleri</h1>
      <p className="text-slate-600">Hazır nedenleri ekleyebilir, adını ve türünü değiştirebilir, kullanılmayanları silebilirsiniz.</p>
      {error ? <p className="text-rose-700">{error}</p> : null}
      <form
        className="grid gap-2 rounded-3xl bg-white p-4 ring-1 ring-slate-200 md:grid-cols-4"
        onSubmit={(event) => {
          event.preventDefault();
          const form = event.currentTarget;
          const data = new FormData(form);
          setError(null);
          setBusy(true);
          void api("/api/admin/exit-reasons", {
            method: "POST",
            body: JSON.stringify({
              name: data.get("name"),
              category: data.get("category"),
              allowNote: true,
              sortOrder: Number(data.get("sortOrder") || 100),
            }),
          })
            .then(() => {
              form.reset();
              return load();
            })
            .catch((caught: unknown) => fail(caught, "Eklenemedi."))
            .finally(() => setBusy(false));
        }}
      >
        <input name="name" required placeholder="Örneğin okul ziyareti" aria-label="Neden adı" className="min-h-11 rounded-xl border px-3" />
        <select name="category" aria-label="Neden türü" className="min-h-11 rounded-xl border px-3">
          {CATEGORIES.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <input name="sortOrder" type="number" min={0} max={1000} placeholder="Sıra" aria-label="Sıra" className="min-h-11 rounded-xl border px-3" />
        <button disabled={busy} className="min-h-11 rounded-xl bg-teal-800 font-semibold text-white disabled:opacity-60">
          Neden ekle
        </button>
      </form>
      {rows.map((row) =>
        editing === row.id ? (
          <form
            key={row.id}
            className="grid gap-3 rounded-2xl bg-white p-4 ring-1 ring-slate-200"
            onSubmit={(event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              setError(null);
              setBusy(true);
              void api(`/api/admin/exit-reasons/${row.id}`, {
                method: "PATCH",
                body: JSON.stringify({
                  name: data.get("name"),
                  category: row.code === "END_OF_DAY" ? "END_OF_DAY" : data.get("category"),
                  allowNote: data.get("allowNote") === "on",
                  sortOrder: Number(data.get("sortOrder") || 0),
                  active: row.code === "END_OF_DAY" ? true : data.get("active") === "on",
                }),
              })
                .then(() => {
                  setEditing(null);
                  return load();
                })
                .catch((caught: unknown) => fail(caught, "Kaydedilemedi."))
                .finally(() => setBusy(false));
            }}
          >
            <div className="grid gap-2 md:grid-cols-3">
              <input name="name" required defaultValue={row.name} aria-label="Neden adı" className="min-h-11 rounded-xl border px-3" />
              <select
                name="category"
                defaultValue={row.category}
                aria-label="Neden türü"
                disabled={row.code === "END_OF_DAY"}
                className="min-h-11 rounded-xl border px-3 disabled:bg-slate-100"
              >
                {CATEGORIES.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <input
                name="sortOrder"
                type="number"
                min={0}
                max={1000}
                required
                defaultValue={row.sortOrder}
                aria-label="Sıra"
                className="min-h-11 rounded-xl border px-3"
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input name="allowNote" type="checkbox" defaultChecked={row.allowNote} />
              Çıkışta ek açıklama yazılabilsin
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input name="active" type="checkbox" defaultChecked={row.active} disabled={row.code === "END_OF_DAY"} />
              Telefonda görünsün
            </label>
            <div className="flex gap-2">
              <button disabled={busy} className="min-h-11 rounded-xl bg-teal-800 px-4 font-semibold text-white disabled:opacity-60">
                Kaydet
              </button>
              <button type="button" className="min-h-11 rounded-xl px-4 ring-1 ring-slate-200" onClick={() => setEditing(null)}>
                Vazgeç
              </button>
            </div>
          </form>
        ) : (
          <article key={row.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3 ring-1 ring-slate-200">
            <div>
              <p className="font-semibold">
                {row.name}{" "}
                {row.active ? null : <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">Pasif</span>}
              </p>
              <p className="text-sm text-slate-500">
                {categoryLabel(row.category)} · sıra {row.sortOrder}
                {row.code === "END_OF_DAY" ? " · mesai kapanışı, silinemez" : ""}
              </p>
            </div>
            <div className="flex gap-3 text-sm">
              <button type="button" className="font-semibold text-teal-800" onClick={() => setEditing(row.id)}>
                Düzenle
              </button>
              {row.code === "END_OF_DAY" ? null : (
                <button
                  type="button"
                  className="font-semibold text-rose-700"
                  onClick={() => {
                    if (!window.confirm(`“${row.name}” silinsin mi?`)) return;
                    setError(null);
                    setBusy(true);
                    void api(`/api/admin/exit-reasons/${row.id}`, { method: "DELETE" })
                      .then(() => load())
                      .catch((caught: unknown) => fail(caught, "Silinemedi."))
                      .finally(() => setBusy(false));
                  }}
                >
                  Sil
                </button>
              )}
            </div>
          </article>
        ),
      )}
    </div>
  );
}
