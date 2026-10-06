alter table public.organization_settings
  add column if not exists lunch_start time not null default '11:50',
  add column if not exists lunch_end time not null default '13:10';

alter table public.employees
  add column if not exists lunch_start time not null default '11:50',
  add column if not exists lunch_end time not null default '13:10';

update public.organization_settings
set default_work_start = '08:30',
    default_work_end = '16:45',
    lunch_start = '11:50',
    lunch_end = '13:10';

update public.employees
set work_start_time = '08:30',
    work_end_time = '16:45',
    lunch_start = '11:50',
    lunch_end = '13:10';
