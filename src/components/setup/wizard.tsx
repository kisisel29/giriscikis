"use client";

import Image from "next/image";
import { useState } from "react";

type Result = {
  organizationName: string;
  entry: { name: string; url: string; qr: string };
  exit: { name: string; url: string; qr: string };
  employeeCode: string;
  pairingCode: string;
};

const field = "min-h-12 w-full rounded-2xl border border-slate-200 bg-white px-3";

export function SetupWizard() {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  function fillMyLocation(form: HTMLFormElement) {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((position) => {
      const lat = form.elements.namedItem("latitude");
      const lon = form.elements.namedItem("longitude");
      if (lat instanceof HTMLInputElement) lat.value = position.coords.latitude.toFixed(6);
      if (lon instanceof HTMLInputElement) lon.value = position.coords.longitude.toFixed(6);
    });
  }

  if (result) {
    return (
      <main className="mx-auto grid max-w-3xl gap-4 px-4 py-8">
        <h1 className="text-3xl font-semibold">Kurulum tamam</h1>
        <p className="text-slate-600">
          NFC 1 üzerine giriş adresini, NFC 2 üzerine çıkış adresini yazın. Üçüncü etiket şimdilik boş kalır. Eşleştirme kodu yalnızca bu ekranda görünür.
        </p>
        <TagCard title="NFC 1 · Giriş / dönüş" name={result.entry.name} url={result.entry.url} qr={result.entry.qr} />
        <TagCard title="NFC 2 · Çıkış" name={result.exit.name} url={result.exit.url} qr={result.exit.qr} />
        <section className="rounded-3xl bg-white p-4 ring-1 ring-slate-200">
          <p className="text-sm text-slate-500">İlk personel</p>
          <p className="text-xl font-semibold">{result.employeeCode}</p>
          <p className="mt-3 text-sm text-slate-500">Tek kullanımlık eşleştirme kodu · 24 saat</p>
          <p className="text-4xl font-semibold tracking-[0.2em]">{result.pairingCode}</p>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-xl px-4 py-8">
      <h1 className="text-3xl font-semibold">İlk kurulum</h1>
      <p className="mt-2 text-slate-600">Kurum, iki NFC etiketi, yönetici ve ilk personel birlikte oluşturulur.</p>
      <form
        className="mt-6 grid gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          const number = (name: string) => Number(form.get(name));
          setPending(true);
          setError(null);
          void fetch("/api/setup", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              organizationName: form.get("organizationName"),
              latitude: number("latitude"),
              longitude: number("longitude"),
              allowedRadiusMeters: number("allowedRadiusMeters"),
              workStart: form.get("workStart"),
              workEnd: form.get("workEnd"),
              entryTagName: form.get("entryTagName"),
              entryLocation: form.get("entryLocation"),
              exitTagName: form.get("exitTagName"),
              exitLocation: form.get("exitLocation"),
              adminName: form.get("adminName"),
              adminEmail: form.get("adminEmail"),
              adminPassword: form.get("adminPassword"),
              employeeName: form.get("employeeName"),
              employeeCode: form.get("employeeCode"),
              department: form.get("department"),
              title: form.get("title"),
            }),
          })
            .then(async (response) => {
              const payload = (await response.json()) as Result & { error?: string };
              if (!response.ok) setError(payload.error ?? "Kurulum tamamlanamadı.");
              else setResult(payload);
            })
            .catch(() => setError("Kurulum tamamlanamadı."))
            .finally(() => setPending(false));
        }}
      >
        <Field name="organizationName" label="Kurum adı" required />
        <div className="grid grid-cols-2 gap-3">
          <Field name="latitude" label="Enlem" type="number" step="any" required />
          <Field name="longitude" label="Boylam" type="number" step="any" required />
        </div>
        <button type="button" onClick={(event) => fillMyLocation(event.currentTarget.form as HTMLFormElement)} className="text-left text-sm font-medium text-teal-800">
          Konumumu kullan
        </button>
        <Field name="allowedRadiusMeters" label="İzin verilen yarıçap (metre)" type="number" defaultValue="150" required />
        <div className="grid grid-cols-2 gap-3">
          <Field name="workStart" label="Mesai başı" type="time" defaultValue="08:00" required />
          <Field name="workEnd" label="Mesai sonu" type="time" defaultValue="17:00" required />
        </div>
        <Field name="entryTagName" label="Giriş NFC adı" defaultValue="Ana kapı giriş" required />
        <Field name="entryLocation" label="Giriş konumu" defaultValue="Ana kapı" />
        <Field name="exitTagName" label="Çıkış NFC adı" defaultValue="Ana kapı çıkış" required />
        <Field name="exitLocation" label="Çıkış konumu" defaultValue="Ana kapı" />
        <Field name="adminName" label="Yönetici adı" required />
        <Field name="adminEmail" label="Yönetici e-posta" type="email" required />
        <Field name="adminPassword" label="Yönetici şifresi" type="password" required />
        <Field name="employeeName" label="İlk personel" required />
        <Field name="employeeCode" label="Personel kodu" required />
        <Field name="department" label="Birim" />
        <Field name="title" label="Unvan" />
        {error ? <p className="text-rose-700">{error}</p> : null}
        <button disabled={pending} className="min-h-14 rounded-2xl bg-teal-800 font-semibold text-white disabled:opacity-60">
          {pending ? "Kaydediliyor…" : "Kurulumu tamamla"}
        </button>
      </form>
    </main>
  );
}

function Field(props: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  const { label, ...input } = props;
  return (
    <label className="grid gap-1 text-sm font-medium">
      {label}
      <input {...input} className={field} />
    </label>
  );
}

function TagCard({ title, name, url, qr }: { title: string; name: string; url: string; qr: string }) {
  return (
    <section className="grid gap-3 rounded-3xl bg-white p-4 ring-1 ring-slate-200 sm:grid-cols-[1fr_140px]">
      <div>
        <p className="text-sm text-slate-500">{title}</p>
        <h2 className="text-xl font-semibold">{name}</h2>
        <p className="mt-2 break-all text-sm">{url}</p>
        <button type="button" onClick={() => void navigator.clipboard.writeText(url)} className="mt-3 min-h-10 rounded-xl bg-slate-900 px-3 text-sm font-semibold text-white">
          URL’yi kopyala
        </button>
      </div>
      {/* QR, NFC ile aynı adresi açar. */}
      <Image src={qr} alt={`${name} QR kodu`} width={144} height={144} unoptimized />
    </section>
  );
}
