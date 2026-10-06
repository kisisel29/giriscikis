"use client";

export default function GlobalError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto grid min-h-full max-w-md place-items-center px-5 text-center">
      <div>
        <h1 className="text-2xl font-semibold">Sayfa açılamadı</h1>
        <p className="mt-2 text-slate-600">{error.message}</p>
        <button type="button" onClick={reset} className="mt-6 min-h-12 rounded-2xl bg-teal-800 px-5 font-semibold text-white">
          Tekrar dene
        </button>
      </div>
    </main>
  );
}
