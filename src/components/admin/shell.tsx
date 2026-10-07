"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase/browser";

const links = [
  ["/admin", "Dashboard"],
  ["/admin/live", "Canlı Durum"],
  ["/admin/presence", "Kurumda Kimler Var"],
  ["/admin/employees", "Personel"],
  ["/admin/events", "Hareketler"],
  ["/admin/reports", "Rapor"],
  ["/admin/nfc", "NFC Etiketleri"],
  ["/admin/exit-reasons", "Çıkış Nedenleri"],
  ["/admin/review", "Kontrol Gereken Kayıtlar"],
  ["/admin/audit", "Audit Log"],
  ["/admin/settings", "Ayarlar"],
] as const;

export function AdminShell({ name, children }: { name: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  return (
    <div className="min-h-full md:grid md:grid-cols-[240px_1fr]">
      <aside className="border-b border-slate-200 bg-white md:min-h-screen md:border-r md:border-b-0">
        <div className="flex items-center justify-between px-4 py-4">
          <div>
            <p className="text-xs tracking-[0.16em] text-teal-800">YÖNETİM</p>
            <p className="font-semibold">{name}</p>
          </div>
          <button
            type="button"
            className="text-sm text-slate-500"
            onClick={() => {
              void createBrowserSupabase()
                .auth.signOut()
                .then(() => router.push("/admin/login"));
            }}
          >
            Çıkış
          </button>
        </div>
        <nav className="flex gap-2 overflow-x-auto px-3 pb-3 md:grid md:px-3">
          {links.map(([href, label]) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`shrink-0 rounded-xl px-3 py-2 text-sm font-medium ${active ? "bg-teal-800 text-white" : "text-slate-700 hover:bg-slate-100"}`}
              >
                {label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <div className="px-4 py-5 md:px-8">{children}</div>
    </div>
  );
}
