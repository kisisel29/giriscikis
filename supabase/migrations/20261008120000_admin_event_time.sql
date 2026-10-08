-- Yönetici unutulan bir giriş veya çıkışı geçmiş saate yazabilsin.
-- NFC kaydı saati vermez; veritabanı varsayılanı sunucu saatine yakın olduğu için yine sunucu saati kullanılır.

create or replace function public.force_server_event_time()
returns trigger
language plpgsql
as $$
begin
  if new.event_time is null or new.event_time > now() - interval '30 seconds' then
    new.event_time = now();
  end if;
  return new;
end;
$$;
