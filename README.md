# Giriş Çıkış

Kurum içindeki personelin işe gelişini, geçici çıkışını, dönüşünü ve mesai bitişini takip eden uygulama.

Personel her işlemde form doldurmaz. Telefon, kapıdaki NFC etiketinde yazılı HTTPS adresini açar. Giriş mi dönüş mü olduğu sunucudaki durum makinesiyle belirlenir. Çıkışta personel bir neden seçer veya kendi nedenini yazar.

Web NFC API kullanılmaz. Tarayıcının etiketin donanım UID değerini okumasına güvenilmez. Telefon, etiketteki NDEF URL kaydını normal bir web sayfası gibi açar.

İlk sürümde iki fiziksel etiket kullanılır:

| Etiket | Mod | Ne işe yarar |
| --- | --- | --- |
| NFC 1 | `ENTRY` | İşe giriş ve kuruma dönüş |
| NFC 2 | `EXIT` | Geçici çıkış ve mesai sonu |
| NFC 3 | — | Şimdilik yedek. Panele eklenmeden kullanılmaz |

İleride ikinci kapı, kat veya yedek etiket yönetim panelinden, kod değiştirmeden eklenebilir.

## Teknoloji

- Next.js 16 App Router, TypeScript, Tailwind CSS
- Supabase Auth, PostgreSQL, Realtime
- Saat dilimi `Europe/Istanbul`
- Tarih `dd.MM.yyyy`, saat `HH:mm`
- Vercel üzerinde çalışacak şekilde sunucu API route'ları

## Supabase projesi

1. [Supabase](https://supabase.com/dashboard) üzerinde yeni bir proje oluşturun.
2. **Authentication → Providers** bölümünde **Anonymous Sign-Ins** özelliğini açın. Personel her gün şifre girmez; tarayıcı için anonim bir oturum açılır ve bu oturum ilk dokunuşta personel koduyla bağlanır.
3. **Project Settings → API** ekranından şu değerleri alın:
   - Project URL
   - `anon` / publishable public key
   - `service_role` secret key
4. **SQL Editor** içine `supabase/migrations/20261006120000_init.sql` dosyasının tamamını yapıştırıp çalıştırın. Dosya tabloları, indeksleri, RLS politikalarını, çıkış nedenlerini ve canlı yayın kaydını kurar.
5. Realtime için `attendance_events` tablosunun publication'a eklendiğini doğrulayın. Migration bunu Supabase'te otomatik dener. Olmazsa **Database → Publications → supabase_realtime** listesine `attendance_events` tablosunu ekleyin.

`SUPABASE_SERVICE_ROLE_KEY` yalnızca sunucuda durur. `NEXT_PUBLIC_` öneki verilmez ve tarayıcı paketine girmez. Attendance kayıtları tarayıcıdan doğrudan tabloya yazılmaz; `POST /api/attendance/nfc` ve `POST /api/attendance/exit` kullanır.

## Ortam değişkenleri

```bash
cp .env.example .env.local
```

| Değişken | Nerede durur | Anlamı |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Tarayıcı ve sunucu | Proje adresi |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Tarayıcı ve sunucu | Oturum açmak için public anahtar |
| `SUPABASE_SERVICE_ROLE_KEY` | Yalnızca sunucu | Kayıt yazma ve yönetim |
| `NEXT_PUBLIC_APP_URL` | Tarayıcı ve sunucu | NFC etiketine yazılacak kök adres |
| `PAIRING_CODE_PEPPER` | Yalnızca sunucu | Eşleştirme kodu hash tuzu, en az 16 karakter |

Üretim adresini `NEXT_PUBLIC_APP_URL` içine şema ile yazın: `https://kurum.example.com`. Etiket URL'leri bu adresten üretilir.

## Yerelde çalıştırma

```bash
npm install
npm run dev
```

Uygulama `http://localhost:3000` adresinde açılır. İlk ekrandan **İlk kurulumu başlat** yoluna gidin.

## İlk kurulum

Sihirbaz sırasıyla şunları ister:

1. Kurum adı
2. Kurum konumu (enlem / boylam). Telefondan veya haritadan alınabilir
3. İzin verilen yarıçap. Varsayılan 150 metre
4. Normal çalışma saatleri. Varsayılan 08:00–17:00
5. Giriş NFC adı ve konumu
6. Çıkış NFC adı ve konumu
7. İlk yönetici adı, e-postası ve şifresi
8. İlk personel, personel kodu, birim ve unvan

Kayıttan sonra ekranda iki NFC adresi görünür. İlk telefonda personel yalnızca kendi personel kodunu girer.

Yönetici e-posta ve şifreyle `/admin/login` adresinden girer. Anonim personel oturumu ile yönetici oturumu aynı tarayıcı profilini paylaşmamalıdır. Yönetici girişi, o tarayıcıdaki personel oturumunun yerini alır.

## NFC etiketine ne yazılır

Etiket programlayıcınızda kayıt tipi **URL / URI** olmalıdır. Metin veya UID kaydı kullanılmaz.

Kurulum veya **NFC Etiketleri** ekranındaki adresi olduğu gibi kopyalayın.

NFC 1, giriş etiketi:

```text
https://kurum.example.com/nfc/550e8400-e29b-41d4-a716-446655440000
```

NFC 2, çıkış etiketi:

```text
https://kurum.example.com/nfc/08cd07f0-d149-4cb8-b3e9-76529acdcc23
```

NFC 3 şimdilik boş kalır. İleride panelden yeni etiket oluşturup onun URL'sini yazabilirsiniz. `public_id` rastgele UUID'dir. Adres gizlilik anahtarı değildir; bir personel bağlantıyı kopyalayabilir. Kayıt yine de şu kontrollerden geçer:

1. Oturumu olan cihaz
2. Personel ile cihaz bağlantısı
3. Aktif NFC etiketi
4. Etiket modu (`ENTRY`, `EXIT` veya ileride `UNIVERSAL`)
5. İşlem anındaki konum
6. Sunucu saati (`now()`). Telefondan gelen saate güvenilmez
7. Aynı etiketin kısa sürede yeniden okunması. Varsayılan 30 saniye
8. Dakikada en fazla 20 deneme

QR kod, test için aynı adresi açar. Asıl kullanım NFC etiketidir.

## Personeli eşleştirme

1. Personel giriş etiketine telefonunu yaklaştırır.
2. İlk seferde personel kodunu girer.
3. Aynı tarayıcı açık kaldığı sürece bir daha sorulmaz.
4. Tarayıcı verisi silinirse eşleştirme yeniden gerekir. Personel kodu yeterlidir.

Varsayılan cihaz limiti 1'dir. Yönetici personel bazında artırabilir veya **Cihaz bağlantısını kaldır** diyebilir. Personel silinmez; `active = false` yapılır.

## Günlük kullanım

Giriş: personel NFC 1'e yaklaşır. Bugün ilk gelişse `ENTRY`, geçici çıkıştan dönüyorsa `RETURN` yazılır. Ekranda yalnızca onay ve saat görünür.

Çıkış: personel NFC 2'ye yaklaşır, nedeni seçer veya yazar. Hazır nedene dokununca bir saniye içinde geri alınabilir. Kendi metnini yazarsa **Çıkışı kaydet** gerekir. Hazır nedenin altına açıklama da eklenebilir; ikisi birlikte saklanır. Özel metnin kategorisi varsayılan `OTHER` olur. Yönetici daha sonra düzeltebilir.

Mesai bitimine `end_of_day_suggestion_minutes` kadar yaklaşınca **Mesai sonu** listenin başına gelir. Otomatik seçilmez.

Çalışan ana ekranı `/me` yalnızca kendi durumunu gösterir. Başka personelin kaydı yoktur ve büyük giriş/çıkış düğmesi yoktur.

## Konum

Arka planda veya gün boyu GPS takibi yoktur. Konum yalnızca NFC işlemi sırasında istenir. Mesafe haversine ile kurum koordinatına göre hesaplanır. Yarıçap dışındaysa kayıt yazılmaz. İzin kapalıysa işlem durur.

Hareket kaydında `location_verified`, `distance_meters` ve `location_accuracy` tutulur. Ham enlem/boylam varsayılan olarak saklanmaz. Ayarlardan açılabilir.

## Yönetim

`/admin` menüsü: Dashboard, Canlı Durum, Kurumda Kimler Var, Personel, Hareketler, Rapor, NFC Etiketleri, Çıkış Nedenleri, Kontrol Gereken Kayıtlar, Audit Log, Ayarlar.

Canlı durum Supabase Realtime ile yeni hareket geldiğinde yenilenir. Yedek olarak 20 saniyede bir de sorulur.

Resmî görev, kurumda fiziksel bulunma süresine eklenmez; mesai kapsamındaki süreye eklenir. Örnek: 08:00 giriş, 10:00 resmî görev, 12:00 dönüş, 17:00 mesai sonu. Kurumda 7 saat, mesai kapsamında 9 saat.

Raporlar XLSX ve PDF olarak indirilir. PDF, Türkçe karakterler için Noto Sans kullanır.

Bir hareket düzeltilirken düzeltme nedeni zorunludur. Eski veri `audit_logs` tablosunda kalır.

## Güvenlik

- Tüm public tablolarda RLS açıktır.
- `authenticated` rolü yönetici demek değildir. Anonim giriş de bu role düşer.
- Personel yalnızca kendi profilini ve kendi hareketlerini seçebilir.
- İstemciden `insert` / `update` politikası yoktur.
- Yönetici yetkisi `admin_users` tablosundan kontrol edilir.
- Çıkış metni düz yazıdır; HTML kaydedilmez.

## Vercel

1. Projeyi içe aktarın.
2. Aynı ortam değişkenlerini Vercel proje ayarına ekleyin.
3. `NEXT_PUBLIC_APP_URL` değerini üretim alan adınız yapın.
4. Deploy sonrası etiket URL'lerini panelden yeniden kopyalayın. Etiketler bu adrese yazılmalıdır.
5. Supabase **Authentication → URL Configuration** içine üretim adresini ekleyin.

## Komutlar

```bash
npm run dev
npm run test
npm run typecheck
npm run lint
npm run build
```

## Saat ve hesap

Hesaplar `src/lib/attendance` altındaki tek katmandadır. Ekranlar ve dışa aktarma bu kuralları ayrıca yazmaz.

- `state.ts` gün içindeki durumu çıkarır.
- `assess.ts` NFC etiketinin ne yapacağına karar verir.
- `calculations.ts` kurumda, mesaide ve kategori sürelerini hesaplar.
- `reports.ts` gün, hafta ve ay toplamlarını üretir.
- `review.ts` eksik veya şüpheli kayıtları listeler, değiştirmez.
