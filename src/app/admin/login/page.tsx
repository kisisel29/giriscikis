"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase/browser";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <main className="mx-auto grid min-h-full max-w-md place-items-center px-4">
      <form
        className="grid w-full gap-3 rounded-3xl bg-white p-5 ring-1 ring-slate-200"
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          setPending(true);
          setError(null);
          void (async () => {
            try {
              const supabase = createBrowserSupabase();
              const { error: signInError } = await supabase.auth.signInWithPassword({
                email: String(form.get("email") ?? ""),
                password: String(form.get("password") ?? ""),
              });
              if (signInError) {
                setError("E-posta veya şifre hatalı.");
                return;
              }
              const session = await fetch("/api/admin/session");
              if (!session.ok) {
                await supabase.auth.signOut();
                setError("Bu hesap yönetici değil.");
                return;
              }
              router.push("/admin");
              router.refresh();
            } catch (caught) {
              setError(caught instanceof Error ? caught.message : "Giriş yapılamadı.");
            } finally {
              setPending(false);
            }
          })();
        }}
      >
        <h1 className="text-2xl font-semibold">Yönetici girişi</h1>
        <input name="email" type="email" required placeholder="E-posta" className="min-h-12 rounded-2xl border border-slate-200 px-3" />
        <input name="password" type="password" required placeholder="Şifre" className="min-h-12 rounded-2xl border border-slate-200 px-3" />
        {error ? <p className="text-rose-700">{error}</p> : null}
        <button disabled={pending} className="min-h-12 rounded-2xl bg-teal-800 font-semibold text-white disabled:opacity-60">
          {pending ? "Giriş yapılıyor…" : "Giriş yap"}
        </button>
      </form>
    </main>
  );
}
