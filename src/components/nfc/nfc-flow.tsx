"use client";

import { useEffect, useRef, useState } from "react";
import { ensureDeviceSession } from "@/lib/supabase/browser";
import type { ExitReasonOption, NfcSuccessResponse } from "@/lib/attendance/types";

type Phase =
  | { kind: "loading"; text: string }
  | { kind: "error"; text: string }
  | { kind: "recorded"; message: string; time: string }
  | { kind: "inside" }
  | { kind: "outside"; lastExit: { time: string; label: string; detail: string | null } | null }
  | { kind: "reentry" }
  | { kind: "pair" }
  | { kind: "exit"; employeeName: string; suggestEndOfDay: boolean; reasons: ExitReasonOption[] };

async function postJson(url: string, body: unknown): Promise<{ ok: boolean; payload: NfcSuccessResponse & { error?: string } }> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = (await response.json()) as NfcSuccessResponse & { error?: string };
  return { ok: response.ok, payload };
}

export function NfcFlow({ publicId }: { publicId: string }) {
  const [phase, setPhase] = useState<Phase>({ kind: "loading", text: "İşlem kontrol ediliyor" });
  const [custom, setCustom] = useState("");
  const [note, setNote] = useState("");
  const [selected, setSelected] = useState<ExitReasonOption | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [pairError, setPairError] = useState<string | null>(null);
  const employeeCode = useRef("");
  const timer = useRef<number | null>(null);

  async function tap(path: string, extra?: Record<string, unknown>) {
    await ensureDeviceSession();
    return postJson(path, {
      tagPublicId: publicId,
      latitude: null,
      longitude: null,
      accuracy: null,
      ...(employeeCode.current ? { employeeCode: employeeCode.current } : {}),
      ...extra,
    });
  }

  function apply(result: { ok: boolean; payload: NfcSuccessResponse & { error?: string } }) {
    if (!result.ok) {
      employeeCode.current = "";
      setPhase({ kind: "error", text: result.payload.error ?? "İşlem kaydedilemedi." });
      return;
    }
    const payload = result.payload;
    if (payload.action === "RECORDED") setPhase({ kind: "recorded", message: payload.message, time: payload.eventTime });
    else if (payload.action === "ALREADY_INSIDE") setPhase({ kind: "inside" });
    else if (payload.action === "ALREADY_OUTSIDE") setPhase({ kind: "outside", lastExit: payload.lastExit });
    else if (payload.action === "CONFIRM_REENTRY") setPhase({ kind: "reentry" });
    else if (payload.action === "PAIR_REQUIRED") setPhase({ kind: "pair" });
    else if (payload.action === "DUPLICATE") setPhase({ kind: "error", text: payload.message });
    else if (payload.action === "SELECT_EXIT_REASON") {
      setPhase({
        kind: "exit",
        employeeName: payload.employeeName,
        suggestEndOfDay: payload.suggestEndOfDay,
        reasons: payload.reasons,
      });
    }
  }

  async function start() {
    try {
      apply(await tap("/api/attendance/nfc"));
    } catch (error) {
      setPhase({ kind: "error", text: error instanceof Error ? error.message : "İşlem tamamlanamadı." });
    }
  }

  useEffect(() => {
    const kickoff = window.setTimeout(() => void start(), 0);
    return () => {
      window.clearTimeout(kickoff);
      if (timer.current) window.clearTimeout(timer.current);
    };
    // NFC sayfası açıldığında bir kez çalışır.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [publicId]);

  async function saveExit(reason: ExitReasonOption | null, customText: string) {
    setSaving(true);
    setPending(null);
    try {
      apply(
        await tap("/api/attendance/exit", {
          exitReasonId: reason?.id ?? null,
          customExitReason: customText.trim() || null,
        }),
      );
    } catch (error) {
      setPhase({ kind: "error", text: error instanceof Error ? error.message : "Çıkış kaydedilemedi." });
    } finally {
      setSaving(false);
    }
  }

  function chooseReason(reason: ExitReasonOption) {
    if (timer.current) window.clearTimeout(timer.current);
    setSelected(reason);
    setPending(reason.name);
    timer.current = window.setTimeout(() => {
      void saveExit(reason, note);
    }, 1000);
  }

  async function pair(formData: FormData) {
    setSaving(true);
    setPairError(null);
    employeeCode.current = String(formData.get("employeeCode") ?? "").trim();
    try {
      apply(await tap("/api/attendance/nfc"));
    } catch (error) {
      setPhase({ kind: "error", text: error instanceof Error ? error.message : "Eşleştirme başarısız." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-full w-full max-w-md flex-col px-4 py-8">
      {phase.kind === "loading" ? <Centered title={phase.text} /> : null}
      {phase.kind === "error" ? (
        <Centered title={phase.text}>
          <button type="button" onClick={() => void start()} className="mt-6 min-h-14 w-full rounded-2xl bg-teal-800 font-semibold text-white">
            Tekrar dene
          </button>
        </Centered>
      ) : null}
      {phase.kind === "recorded" ? (
        <Centered>
          <p className="text-6xl text-emerald-700">✓</p>
          <h1 className="mt-4 text-2xl font-semibold">{phase.message}</h1>
          <p className="mt-3 text-5xl font-semibold tabular-nums">{phase.time}</p>
        </Centered>
      ) : null}
      {phase.kind === "inside" ? <Centered title="Zaten kurumda görünüyorsunuz." /> : null}
      {phase.kind === "outside" ? (
        <Centered title="Şu anda kurum dışında görünüyorsunuz.">
          {phase.lastExit ? (
            <div className="mt-6 rounded-2xl bg-white p-4 text-left ring-1 ring-slate-200">
              <p className="text-sm text-slate-500">Son çıkış {phase.lastExit.time}</p>
              <p className="mt-1 text-lg font-semibold">{phase.lastExit.label}</p>
              {phase.lastExit.detail ? <p className="mt-1 text-slate-700">“{phase.lastExit.detail}”</p> : null}
            </div>
          ) : null}
        </Centered>
      ) : null}
      {phase.kind === "reentry" ? (
        <Centered title="Mesainiz sona ermiş görünüyor. Tekrar giriş yapmak istiyor musunuz?">
          <button
            type="button"
            disabled={saving}
            onClick={() => void tap("/api/attendance/reentry").then(apply)}
            className="mt-6 min-h-14 w-full rounded-2xl bg-teal-800 font-semibold text-white disabled:opacity-60"
          >
            Evet, girişimi kaydet
          </button>
        </Centered>
      ) : null}
      {phase.kind === "pair" ? (
        <form
          className="flex flex-1 flex-col justify-center gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            void pair(new FormData(event.currentTarget));
          }}
        >
          <h1 className="text-3xl font-semibold">Cihazı bağla</h1>
          <p className="text-slate-600">Personel kodunuzu girin. Üç giriş ve üç çıkıştan sonra bu telefon kod sormadan tanınır.</p>
          <label className="grid gap-1 text-sm font-medium">
            Personel kodu
            <input name="employeeCode" required autoCapitalize="characters" className="min-h-14 rounded-2xl border border-slate-200 px-4 text-lg" />
          </label>
          {pairError ? <p className="text-rose-700">{pairError}</p> : null}
          <button disabled={saving} className="min-h-14 rounded-2xl bg-teal-800 font-semibold text-white disabled:opacity-60">
            Eşleştir
          </button>
        </form>
      ) : null}
      {phase.kind === "exit" ? (
        <div className="flex flex-col gap-3 pb-28">
          <p className="text-sm text-slate-500">{phase.employeeName}</p>
          <h1 className="text-3xl font-semibold">Neden çıkıyorsunuz?</h1>
          {phase.reasons.map((reason, index) => {
            const featured = phase.suggestEndOfDay && index === 0 && reason.code === "END_OF_DAY";
            return (
              <button
                key={reason.id}
                type="button"
                disabled={saving}
                onClick={() => chooseReason(reason)}
                className={`min-h-14 rounded-2xl px-4 text-left text-lg font-semibold ${
                  featured ? "bg-teal-800 text-white" : "bg-white ring-1 ring-slate-200"
                } ${selected?.id === reason.id ? "outline outline-2 outline-offset-2 outline-teal-700" : ""}`}
              >
                {reason.name}
              </button>
            );
          })}
          {selected?.allowNote ? (
            <label className="mt-2 grid gap-1 text-sm font-medium">
              Açıklama ekle
              <input
                value={note}
                onChange={(event) => {
                  setNote(event.target.value);
                  if (timer.current) window.clearTimeout(timer.current);
                  setPending(null);
                }}
                placeholder="Örneğin İl MEM toplantısı"
                className="min-h-14 rounded-2xl border border-slate-200 px-4"
              />
            </label>
          ) : null}
          <label className="mt-2 grid gap-1 text-sm font-medium">
            Farklı bir neden yaz
            <input
              value={custom}
              onChange={(event) => setCustom(event.target.value)}
              placeholder="Çıkış nedeninizi yazabilirsiniz..."
              className="min-h-14 rounded-2xl border border-slate-200 px-4"
            />
          </label>
          <button
            type="button"
            disabled={saving || (!selected && custom.trim().length < 2)}
            onClick={() => {
              if (timer.current) window.clearTimeout(timer.current);
              void saveExit(selected, custom.trim() ? custom : note);
            }}
            className="min-h-14 rounded-2xl bg-slate-900 font-semibold text-white disabled:opacity-40"
          >
            Çıkışı kaydet
          </button>
          {pending ? (
            <div className="fixed inset-x-0 bottom-0 mx-auto flex w-full max-w-md items-center justify-between gap-3 bg-slate-900 px-4 py-4 text-white">
              <span>{pending} olarak kaydediliyor</span>
              <button
                type="button"
                onClick={() => {
                  if (timer.current) window.clearTimeout(timer.current);
                  setPending(null);
                }}
                className="min-h-10 rounded-xl bg-white px-3 font-semibold text-slate-900"
              >
                Geri al
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </main>
  );
}

function Centered({ title, children }: { title?: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center text-center">
      {title ? <h1 className="text-2xl font-semibold leading-snug">{title}</h1> : null}
      {children}
    </div>
  );
}
