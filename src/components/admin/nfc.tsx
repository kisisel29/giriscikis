"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { api } from "@/components/admin/api";

type Tag = {
  id: string;
  name: string;
  locationName: string | null;
  mode: "ENTRY" | "EXIT" | "UNIVERSAL";
  active: boolean;
  url: string;
  qr: string;
};

export function NfcManager() {
  const [rows, setRows] = useState<Tag[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  function load() {
    return api<Tag[]>("/api/admin/nfc").then(setRows);
  }

  useEffect(() => {
    void load().catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Etiketler alınamadı."));
  }, []);

  return (
    <div className="grid gap-4">
      <h1 className="text-3xl font-semibold">NFC etiketleri</h1>
      <p className="max-w-2xl text-slate-600">Yeni etiket eklemek kod değiştirmez. Üretilen adresi fiziksel etikete NDEF URL olarak yazın. Üçüncü etiketi yedek bırakabilirsiniz.</p>
      {error ? <p className="text-rose-700">{error}</p> : null}
      <form
        className="grid gap-2 rounded-3xl bg-white p-4 ring-1 ring-slate-200 md:grid-cols-4"
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          void api("/api/admin/nfc", {
            method: "POST",
            body: JSON.stringify({
              name: form.get("name"),
              locationName: form.get("locationName"),
              mode: form.get("mode"),
              active: true,
            }),
          })
            .then(() => load())
            .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Eklenemedi."));
          event.currentTarget.reset();
        }}
      >
        <input name="name" required placeholder="Ad" className="min-h-11 rounded-xl border px-3" />
        <input name="locationName" placeholder="Konum" className="min-h-11 rounded-xl border px-3" />
        <select name="mode" className="min-h-11 rounded-xl border px-3">
          <option value="ENTRY">ENTRY</option>
          <option value="EXIT">EXIT</option>
          <option value="UNIVERSAL">UNIVERSAL</option>
        </select>
        <button className="min-h-11 rounded-xl bg-teal-800 font-semibold text-white">Etiket ekle</button>
      </form>
      <div className="grid gap-3">
        {rows.map((tag) => (
          <article key={tag.id} className="grid gap-3 rounded-3xl bg-white p-4 ring-1 ring-slate-200 md:grid-cols-[1fr_140px]">
            <div>
              <p className="text-sm text-slate-500">{tag.mode} · {tag.active ? "Aktif" : "Pasif"} · {tag.locationName ?? "Konum yok"}</p>
              <h2 className="text-xl font-semibold">{tag.name}</h2>
              <p className="mt-2 break-all text-sm">{tag.url}</p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white"
                  onClick={() => {
                    void navigator.clipboard.writeText(tag.url);
                    setCopied(tag.id);
                  }}
                >
                  {copied === tag.id ? "Kopyalandı" : "URL’yi kopyala"}
                </button>
                <button
                  type="button"
                  className="rounded-xl px-3 py-2 text-sm ring-1 ring-slate-200"
                  onClick={() => void api(`/api/admin/nfc/${tag.id}`, { method: "PATCH", body: JSON.stringify({ active: !tag.active }) }).then(() => load())}
                >
                  {tag.active ? "Pasif yap" : "Aktif yap"}
                </button>
              </div>
            </div>
            <Image src={tag.qr} alt={`${tag.name} QR`} width={128} height={128} unoptimized />
          </article>
        ))}
      </div>
    </div>
  );
}
