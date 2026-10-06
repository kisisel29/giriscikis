"use client";

import { useEffect, useState } from "react";
import { api } from "@/components/admin/api";

type Settings = {
  organizationName: string;
  latitude: number;
  longitude: number;
  allowedRadiusMeters: number;
  locationVerificationRequired: boolean;
  timezone: string;
  defaultWorkStart: string;
  defaultWorkEnd: string;
  duplicateWindowSeconds: number;
  endOfDaySuggestionMinutes: number;
  storeRawCoordinates: boolean;
};

export function SettingsForm() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void api<Settings>("/api/admin/settings")
      .then(setSettings)
      .catch((caught: unknown) => setMessage(caught instanceof Error ? caught.message : "Ayarlar alınamadı."));
  }, []);

  if (!settings) return <p>{message ?? "Yükleniyor…"}</p>;

  return (
    <form
      className="grid max-w-xl gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        void api<Settings>("/api/admin/settings", {
          method: "PATCH",
          body: JSON.stringify({
            organizationName: form.get("organizationName"),
            latitude: Number(form.get("latitude")),
            longitude: Number(form.get("longitude")),
            allowedRadiusMeters: Number(form.get("allowedRadiusMeters")),
            locationVerificationRequired: form.get("locationVerificationRequired") === "on",
            timezone: form.get("timezone"),
            defaultWorkStart: form.get("defaultWorkStart"),
            defaultWorkEnd: form.get("defaultWorkEnd"),
            duplicateWindowSeconds: Number(form.get("duplicateWindowSeconds")),
            endOfDaySuggestionMinutes: Number(form.get("endOfDaySuggestionMinutes")),
            storeRawCoordinates: form.get("storeRawCoordinates") === "on",
          }),
        })
          .then((saved) => {
            setSettings(saved);
            setMessage("Ayarlar kaydedildi.");
          })
          .catch((caught: unknown) => setMessage(caught instanceof Error ? caught.message : "Kaydedilemedi."));
      }}
    >
      <h1 className="text-3xl font-semibold">Ayarlar</h1>
      <input name="organizationName" defaultValue={settings.organizationName} className="min-h-11 rounded-xl border px-3" />
      <input name="latitude" type="number" step="any" defaultValue={settings.latitude} className="min-h-11 rounded-xl border px-3" />
      <input name="longitude" type="number" step="any" defaultValue={settings.longitude} className="min-h-11 rounded-xl border px-3" />
      <label className="text-sm">Yarıçap (metre)
        <input name="allowedRadiusMeters" type="number" defaultValue={settings.allowedRadiusMeters} className="mt-1 min-h-11 w-full rounded-xl border px-3" />
      </label>
      <label className="text-sm">Saat dilimi
        <input name="timezone" defaultValue={settings.timezone} className="mt-1 min-h-11 w-full rounded-xl border px-3" />
      </label>
      <input name="defaultWorkStart" type="time" defaultValue={settings.defaultWorkStart} className="min-h-11 rounded-xl border px-3" />
      <input name="defaultWorkEnd" type="time" defaultValue={settings.defaultWorkEnd} className="min-h-11 rounded-xl border px-3" />
      <label className="text-sm">Mükerrer kayıt penceresi (saniye)
        <input name="duplicateWindowSeconds" type="number" defaultValue={settings.duplicateWindowSeconds} className="mt-1 min-h-11 w-full rounded-xl border px-3" />
      </label>
      <label className="text-sm">Mesai sonu önerisi (dakika)
        <input name="endOfDaySuggestionMinutes" type="number" defaultValue={settings.endOfDaySuggestionMinutes} className="mt-1 min-h-11 w-full rounded-xl border px-3" />
      </label>
      <label className="flex gap-2"><input name="locationVerificationRequired" type="checkbox" defaultChecked={settings.locationVerificationRequired} /> Konum doğrulaması zorunlu</label>
      <label className="flex gap-2"><input name="storeRawCoordinates" type="checkbox" defaultChecked={settings.storeRawCoordinates} /> Ham koordinatı sakla (varsayılan kapalı)</label>
      {message ? <p>{message}</p> : null}
      <button className="min-h-12 rounded-2xl bg-teal-800 font-semibold text-white">Kaydet</button>
    </form>
  );
}
