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
  | { kind: "late" }
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
  const [phase, setPhase] = useState<Phase>({ kind: "loading", text: "Kaydediliyor" });
  const [custom, setCustom] = useState("");
  const [saving, setSaving] = useState(false);
  const [pairError, setPairError] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [lateChoice, setLateChoice] = useState<"yes" | "no" | null>(null);
  const [lateReason, setLateReason] = useState("");
  const [lateError, setLateError] = useState<string | null>(null);
  const employeeCode = useRef("");
  const timer = useRef<number | null>(null);
  const busy = useRef(false);

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
    else if (payload.action === "ASK_LATE_REASON") {
      setLateChoice(null);
      setLateReason("");
      setLateError(null);
      setPhase({ kind: "late" });
    } else if (payload.action === "SELECT_EXIT_REASON") {
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
    setPhase({ kind: "loading", text: "Kaydediliyor" });
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
    void saveExit(reason, "");
  }

  async function saveLate() {
    if (!lateChoice) return;
    setSaving(true);
    setLateError(null);
    try {
      const result = await tap("/api/attendance/nfc", {
        lateAnswer: lateChoice,
        lateReason: lateChoice === "yes" ? lateReason : null,
      });
      if (!result.ok) {
        setLateError(result.payload.error ?? "Kayıt tamamlanamadı.");
        return;
      }
      apply(result);
    } catch (error) {
      setLateError(error instanceof Error ? error.message : "Kayıt tamamlanamadı.");
    } finally {
      setSaving(false);
    }
  }

  async function submitCode(raw: string) {
    const next = raw.trim();
    if (next.length < 2 || busy.current) return;
    if (timer.current) window.clearTimeout(timer.current);
    busy.current = true;
    setSaving(true);
    setPairError(null);
    setPhase({ kind: "loading", text: "Kaydediliyor" });
    employeeCode.current = next;
    try {
      apply(await tap("/api/attendance/nfc"));
    } catch (error) {
      setPhase({ kind: "error", text: error instanceof Error ? error.message : "Eşleştirme başarısız." });
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }

  function scheduleCode(value: string) {
    setCode(value);
    if (timer.current) window.clearTimeout(timer.current);
    const next = value.trim();
    if (next.length < 2) return;
    timer.current = window.setTimeout(() => {
      void submitCode(next);
    }, 300);
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
            void submitCode(code);
          }}
        >
          <h1 className="text-3xl font-semibold">Personel kodu</h1>
          <p className="text-slate-600">Kodu yazın. Yazmayı bitirince kayıt hemen alınır. Üç giriş ve üç çıkıştan sonra bu telefon kod sormadan tanınır.</p>
          <label className="grid gap-1 text-sm font-medium">
            Personel kodu
            <input
              value={code}
              autoFocus
              autoCapitalize="characters"
              autoComplete="off"
              onChange={(event) => scheduleCode(event.target.value)}
              className="min-h-14 rounded-2xl border border-slate-200 px-4 text-lg"
            />
          </label>
          {pairError ? <p className="text-rose-700">{pairError}</p> : null}
        </form>
      ) : null}
      {phase.kind === "late" ? (
        <div className="flex flex-1 flex-col justify-center gap-4">
          <h1 className="text-3xl font-semibold">Mesaiye geç kalındı. Sebep belirtmek ister misiniz?</h1>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setLateChoice("yes")}
              className={`min-h-14 rounded-2xl font-semibold ${lateChoice === "yes" ? "bg-teal-800 text-white" : "bg-white ring-1 ring-slate-200"}`}
            >
              Evet
            </button>
            <button
              type="button"
              onClick={() => setLateChoice("no")}
              className={`min-h-14 rounded-2xl font-semibold ${lateChoice === "no" ? "bg-slate-900 text-white" : "bg-white ring-1 ring-slate-200"}`}
            >
              Hayır
            </button>
          </div>
          {lateChoice === "yes" ? (
            <label className="grid gap-2 text-sm font-medium">
              Geç kalma sebebi
              <textarea
                value={lateReason}
                onChange={(event) => setLateReason(event.target.value)}
                rows={4}
                placeholder="Sebebinizi yazabilirsiniz"
                className="rounded-2xl border border-slate-200 px-4 py-3 text-base"
              />
              <span className="font-normal text-slate-500">Yazmak için acele etmeyin. Bitince Kaydet’e basın.</span>
            </label>
          ) : null}
          {lateError ? <p className="text-rose-700">{lateError}</p> : null}
          <button
            type="button"
            disabled={saving || !lateChoice}
            onClick={() => void saveLate()}
            className="min-h-14 rounded-2xl bg-teal-800 font-semibold text-white disabled:opacity-40"
          >
            Kaydet
          </button>
        </div>
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
                }`}
              >
                {reason.name}
              </button>
            );
          })}
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
            disabled={saving || custom.trim().length < 2}
            onClick={() => void saveExit(null, custom)}
            className="min-h-14 rounded-2xl bg-slate-900 font-semibold text-white disabled:opacity-40"
          >
            Çıkışı kaydet
          </button>
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
