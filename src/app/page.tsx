import Link from "next/link";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-full max-w-lg flex-col justify-center gap-8 px-5 py-16">
      <div>
        <p className="text-sm font-medium tracking-[0.18em] text-teal-800">KURUM İÇİ TAKİP</p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight">Giriş Çıkış</h1>
        <p className="mt-3 text-lg leading-7 text-slate-600">
          Giriş ve dönüş için giriş etiketine, ayrılırken çıkış etiketine telefonunuzu yaklaştırın. Ayrıca bir işlem gerekmez.
        </p>
      </div>
      <div className="grid gap-3">
        <Link href="/me" className="flex min-h-14 items-center justify-center rounded-2xl bg-teal-800 px-4 text-lg font-semibold text-white">
          Durumum
        </Link>
        <Link href="/admin" className="flex min-h-14 items-center justify-center rounded-2xl bg-white px-4 text-lg font-semibold ring-1 ring-slate-200">
          Yönetici girişi
        </Link>
        <Link href="/setup" className="text-center text-sm font-medium text-teal-800">
          İlk kurulumu başlat
        </Link>
      </div>
    </main>
  );
}
