-- Personel giriş-çıkış, kurum içi varlık (presence) ve mesai takibi.
-- Hedef: Supabase PostgreSQL. Service role RLS'i aşar; istemci yazamaz.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Yardımcılar
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Tablolar
-- ---------------------------------------------------------------------------

create table public.admin_users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique,
  email text not null,
  full_name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.organization_settings (
  id uuid primary key default gen_random_uuid(),
  singleton boolean not null default true unique,
  organization_name text not null,
  latitude double precision not null,
  longitude double precision not null,
  allowed_radius_meters integer not null default 150,
  location_verification_required boolean not null default false,
  timezone text not null default 'Europe/Istanbul',
  default_work_start time not null default '08:30',
  default_work_end time not null default '16:45',
  lunch_start time not null default '11:50',
  lunch_end time not null default '13:10',
  duplicate_window_seconds integer not null default 30,
  end_of_day_suggestion_minutes integer not null default 30,
  store_raw_coordinates boolean not null default false,
  updated_at timestamptz not null default now(),
  constraint organization_settings_radius_check check (allowed_radius_meters between 10 and 5000),
  constraint organization_settings_duplicate_check check (duplicate_window_seconds between 5 and 300),
  constraint organization_settings_suggestion_check check (end_of_day_suggestion_minutes between 0 and 180),
  constraint organization_settings_singleton_check check (singleton = true)
);

create trigger organization_settings_updated_at
before update on public.organization_settings
for each row execute function public.set_updated_at();

create table public.employees (
  id uuid primary key default gen_random_uuid(),
  employee_code text not null unique,
  full_name text not null,
  department text,
  title text,
  active boolean not null default true,
  work_start_time time not null default '08:30',
  work_end_time time not null default '16:45',
  lunch_start time not null default '11:50',
  lunch_end time not null default '13:10',
  max_devices integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint employees_code_format check (employee_code ~ '^[A-Z0-9-]{2,32}$'),
  constraint employees_name_length check (char_length(full_name) between 2 and 120),
  constraint employees_max_devices_check check (max_devices between 1 and 10)
);

create trigger employees_updated_at
before update on public.employees
for each row execute function public.set_updated_at();

create table public.employee_devices (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees (id),
  auth_user_id uuid not null,
  device_name text,
  active boolean not null default true,
  paired_at timestamptz not null default now(),
  last_seen_at timestamptz,
  constraint employee_devices_employee_auth_key unique (employee_id, auth_user_id)
);

create unique index employee_devices_active_auth_uidx
  on public.employee_devices (auth_user_id)
  where active;

create table public.pairing_codes (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees (id),
  code_hash text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now(),
  constraint pairing_codes_hash_length check (char_length(code_hash) = 64)
);

create table public.nfc_tags (
  id uuid primary key default gen_random_uuid(),
  public_id uuid not null unique default gen_random_uuid(),
  name text not null,
  location_name text,
  mode text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint nfc_tags_mode_check check (mode in ('ENTRY', 'EXIT', 'UNIVERSAL')),
  constraint nfc_tags_name_length check (char_length(name) between 2 and 80)
);

create table public.exit_reasons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  category text not null,
  allow_note boolean not null default true,
  sort_order integer not null default 100,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint exit_reasons_category_check check (
    category in ('OFFICIAL', 'MEAL', 'HEALTH', 'PERSONAL', 'END_OF_DAY', 'OTHER')
  ),
  constraint exit_reasons_code_format check (code ~ '^[A-Z0-9_]{2,40}$')
);

create table public.attendance_events (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees (id),
  event_type text not null,
  event_time timestamptz not null default now(),
  exit_reason_id uuid references public.exit_reasons (id),
  custom_exit_reason text,
  exit_category text,
  nfc_tag_id uuid references public.nfc_tags (id),
  note text,
  location_verified boolean not null default false,
  distance_meters integer,
  location_accuracy integer,
  latitude double precision,
  longitude double precision,
  created_at timestamptz not null default now(),
  corrected_at timestamptz,
  corrected_by uuid,
  constraint attendance_events_type_check check (
    event_type in ('ENTRY', 'EXIT', 'RETURN', 'END_OF_DAY')
  ),
  constraint attendance_events_category_check check (
    exit_category is null
    or exit_category in ('OFFICIAL', 'MEAL', 'HEALTH', 'PERSONAL', 'END_OF_DAY', 'OTHER')
  ),
  constraint attendance_events_reason_check check (
    event_type in ('ENTRY', 'RETURN')
    or exit_reason_id is not null
    or custom_exit_reason is not null
  ),
  constraint attendance_events_end_category_check check (
    event_type <> 'END_OF_DAY' or exit_category = 'END_OF_DAY'
  ),
  constraint attendance_events_custom_plain check (
    custom_exit_reason is null
    or (
      char_length(custom_exit_reason) between 2 and 250
      and custom_exit_reason !~ '[<>]'
    )
  ),
  constraint attendance_events_note_length check (
    note is null or char_length(note) between 1 and 500
  )
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null,
  action text not null,
  table_name text not null,
  record_id uuid not null,
  old_data jsonb,
  new_data jsonb,
  reason text not null,
  created_at timestamptz not null default now(),
  constraint audit_logs_reason_length check (char_length(reason) between 5 and 500)
);

create table public.attendance_attempts (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- İndeksler
-- ---------------------------------------------------------------------------

create index attendance_events_employee_time_idx
  on public.attendance_events (employee_id, event_time desc);

create index attendance_events_time_idx
  on public.attendance_events (event_time desc);

create index attendance_events_tag_time_idx
  on public.attendance_events (employee_id, nfc_tag_id, event_time desc);

create index employee_devices_auth_user_idx
  on public.employee_devices (auth_user_id);

create index employees_employee_code_idx
  on public.employees (employee_code);

create unique index employees_employee_code_lower_idx
  on public.employees (lower(employee_code));

create unique index nfc_tags_public_id_idx
  on public.nfc_tags (public_id);

create index exit_reasons_active_sort_idx
  on public.exit_reasons (active, sort_order);

create index pairing_codes_employee_idx
  on public.pairing_codes (employee_id, expires_at);

create index attendance_attempts_user_time_idx
  on public.attendance_attempts (auth_user_id, created_at desc);

create index audit_logs_created_idx
  on public.audit_logs (created_at desc);

-- ---------------------------------------------------------------------------
-- Sunucu saati ve mükerrer kayıt
-- ---------------------------------------------------------------------------

create or replace function public.force_server_event_time()
returns trigger
language plpgsql
as $$
begin
  new.event_time = now();
  return new;
end;
$$;

create or replace function public.prevent_short_duplicate_attendance()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  window_seconds integer := 30;
begin
  select coalesce(duplicate_window_seconds, 30)
    into window_seconds
  from public.organization_settings
  limit 1;

  if exists (
    select 1
    from public.attendance_events existing
    where existing.employee_id = new.employee_id
      and existing.nfc_tag_id = new.nfc_tag_id
      and existing.event_time > new.event_time - make_interval(secs => window_seconds)
      and existing.event_time <= new.event_time
  ) then
    raise exception 'DUPLICATE_EVENT'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

create trigger a_attendance_force_server_time
before insert on public.attendance_events
for each row execute function public.force_server_event_time();

create trigger b_attendance_prevent_duplicate
before insert on public.attendance_events
for each row execute function public.prevent_short_duplicate_attendance();

-- ---------------------------------------------------------------------------
-- Tek kullanımlık eşleştirme (atomik)
-- ---------------------------------------------------------------------------

create or replace function public.consume_pairing_code(
  p_auth_user_id uuid,
  p_employee_code text,
  p_code_hash text,
  p_device_name text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_employee public.employees%rowtype;
  v_code public.pairing_codes%rowtype;
  v_active_count integer;
begin
  if p_auth_user_id is null or p_code_hash is null or char_length(p_code_hash) <> 64 then
    return jsonb_build_object('ok', false, 'error', 'Personel kodu veya eşleştirme kodu hatalı.');
  end if;

  select *
    into v_employee
  from public.employees
  where employee_code = upper(trim(p_employee_code))
  for update;

  if not found or v_employee.active is not true then
    return jsonb_build_object('ok', false, 'error', 'Personel kodu veya eşleştirme kodu hatalı.');
  end if;

  if exists (
    select 1
    from public.employee_devices
    where auth_user_id = p_auth_user_id
      and active = true
      and employee_id <> v_employee.id
  ) then
    return jsonb_build_object('ok', false, 'error', 'Bu cihaz başka bir personele bağlı.');
  end if;

  select *
    into v_code
  from public.pairing_codes
  where employee_id = v_employee.id
    and code_hash = p_code_hash
    and used_at is null
    and expires_at > now()
  order by created_at desc
  limit 1
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'Personel kodu veya eşleştirme kodu hatalı.');
  end if;

  select count(*)
    into v_active_count
  from public.employee_devices
  where employee_id = v_employee.id
    and active = true
    and auth_user_id <> p_auth_user_id;

  if v_active_count >= v_employee.max_devices then
    return jsonb_build_object(
      'ok', false,
      'error', 'Bu personel için cihaz limiti dolu. Yöneticiden mevcut cihaz bağlantısını kaldırmasını isteyin.'
    );
  end if;

  update public.pairing_codes
  set used_at = now()
  where id = v_code.id;

  insert into public.employee_devices (
    employee_id, auth_user_id, device_name, active, paired_at, last_seen_at
  ) values (
    v_employee.id,
    p_auth_user_id,
    left(coalesce(nullif(trim(p_device_name), ''), 'Telefon'), 120),
    true,
    now(),
    now()
  )
  on conflict (employee_id, auth_user_id)
  do update set
    active = true,
    device_name = excluded.device_name,
    paired_at = now(),
    last_seen_at = now();

  return jsonb_build_object(
    'ok', true,
    'employeeId', v_employee.id,
    'fullName', v_employee.full_name
  );
end;
$$;

revoke all on function public.consume_pairing_code(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.consume_pairing_code(uuid, text, text, text) to service_role;

-- ---------------------------------------------------------------------------
-- Hazır çıkış nedenleri
-- ---------------------------------------------------------------------------

insert into public.exit_reasons (code, name, category, allow_note, sort_order) values
  ('OFFICIAL_FIELD', 'Resmî görev', 'OFFICIAL', true, 10),
  ('OFFICIAL_MEETING', 'Toplantı', 'OFFICIAL', true, 20),
  ('OFFICIAL_DOCUMENT', 'Evrak / kurum işi', 'OFFICIAL', true, 30),
  ('OFFICIAL_TRAINING', 'Eğitim / seminer', 'OFFICIAL', true, 40),
  ('MEAL', 'Yemek', 'MEAL', true, 50),
  ('HEALTH', 'Sağlık', 'HEALTH', true, 60),
  ('PERSONAL', 'Kişisel', 'PERSONAL', true, 70),
  ('END_OF_DAY', 'Mesai sonu', 'END_OF_DAY', false, 80),
  ('OTHER', 'Diğer', 'OTHER', true, 90)
on conflict (code) do nothing;

-- Tablolar oluştuktan sonra tanımlanır. SQL fonksiyonları gövdedeki tabloyu
-- oluşturma anında kontrol eder.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_users
    where auth_user_id = auth.uid()
      and active = true
  );
$$;

create or replace function public.current_employee_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select employee_id
  from public.employee_devices
  where auth_user_id = auth.uid()
    and active = true
  limit 1;
$$;

revoke all on function public.is_admin() from public, anon;
revoke all on function public.current_employee_id() from public, anon;
grant execute on function public.is_admin() to authenticated, service_role;
grant execute on function public.current_employee_id() to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- RLS
-- Anonim oturum Supabase'te authenticated rolü alır. Admin ayrı kontrol edilir.
-- Yazma yoktur; kayıtlar yalnızca service role API üzerinden girer.
-- ---------------------------------------------------------------------------

alter table public.admin_users enable row level security;
alter table public.organization_settings enable row level security;
alter table public.employees enable row level security;
alter table public.employee_devices enable row level security;
alter table public.pairing_codes enable row level security;
alter table public.nfc_tags enable row level security;
alter table public.exit_reasons enable row level security;
alter table public.attendance_events enable row level security;
alter table public.audit_logs enable row level security;
alter table public.attendance_attempts enable row level security;

create policy admin_users_select_self_or_admin
on public.admin_users
for select
to authenticated
using (auth_user_id = auth.uid() or public.is_admin());

create policy organization_settings_select_admin
on public.organization_settings
for select
to authenticated
using (public.is_admin());

create policy employees_select_own_or_admin
on public.employees
for select
to authenticated
using (public.is_admin() or id = public.current_employee_id());

create policy employee_devices_select_own_or_admin
on public.employee_devices
for select
to authenticated
using (public.is_admin() or auth_user_id = auth.uid());

create policy pairing_codes_select_admin
on public.pairing_codes
for select
to authenticated
using (public.is_admin());

create policy nfc_tags_select_admin
on public.nfc_tags
for select
to authenticated
using (public.is_admin());

create policy exit_reasons_select_active_or_admin
on public.exit_reasons
for select
to authenticated
using (active = true or public.is_admin());

create policy attendance_events_select_own_or_admin
on public.attendance_events
for select
to authenticated
using (public.is_admin() or employee_id = public.current_employee_id());

create policy audit_logs_select_admin
on public.audit_logs
for select
to authenticated
using (public.is_admin());

revoke all on table public.admin_users from anon;
revoke all on table public.organization_settings from anon;
revoke all on table public.employees from anon;
revoke all on table public.employee_devices from anon;
revoke all on table public.pairing_codes from anon;
revoke all on table public.nfc_tags from anon;
revoke all on table public.exit_reasons from anon;
revoke all on table public.attendance_events from anon;
revoke all on table public.audit_logs from anon;
revoke all on table public.attendance_attempts from anon, authenticated;

grant select on public.admin_users to authenticated;
grant select on public.organization_settings to authenticated;
grant select on public.employees to authenticated;
grant select on public.employee_devices to authenticated;
grant select on public.pairing_codes to authenticated;
grant select on public.nfc_tags to authenticated;
grant select on public.exit_reasons to authenticated;
grant select on public.attendance_events to authenticated;
grant select on public.audit_logs to authenticated;

grant all on public.admin_users to service_role;
grant all on public.organization_settings to service_role;
grant all on public.employees to service_role;
grant all on public.employee_devices to service_role;
grant all on public.pairing_codes to service_role;
grant all on public.nfc_tags to service_role;
grant all on public.exit_reasons to service_role;
grant all on public.attendance_events to service_role;
grant all on public.audit_logs to service_role;
grant all on public.attendance_attempts to service_role;

-- Canlı pano: yeni hareket eklenince yönetici ekranı yenilenir.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'attendance_events'
    ) then
      alter publication supabase_realtime add table public.attendance_events;
    end if;
  end if;
end $$;
