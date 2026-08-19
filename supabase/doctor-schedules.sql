-- Permanent weekly schedules and per-date exceptions for Dream Smile doctors.

begin;

create table if not exists public.doctor_schedules (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null references public.doctors(id) on delete cascade,
  weekday integer not null check (weekday between 0 and 6),
  start_time time,
  end_time time,
  break_start time,
  break_end time,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint doctor_schedules_doctor_weekday_unique unique (doctor_id, weekday),
  constraint doctor_schedules_work_hours_check check (
    (active = false and start_time is null and end_time is null and break_start is null and break_end is null)
    or
    (active = true and start_time is not null and end_time is not null and start_time < end_time
      and ((break_start is null and break_end is null)
        or (break_start is not null and break_end is not null
          and start_time <= break_start and break_start < break_end and break_end <= end_time)))
  )
);

create table if not exists public.schedule_exceptions (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null references public.doctors(id) on delete cascade,
  date date not null,
  type text not null check (type in ('day_off', 'custom_hours')),
  start_time time,
  end_time time,
  break_start time,
  break_end time,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint schedule_exceptions_doctor_date_unique unique (doctor_id, date),
  constraint schedule_exceptions_values_check check (
    (type = 'day_off' and start_time is null and end_time is null and break_start is null and break_end is null)
    or
    (type = 'custom_hours' and start_time is not null and end_time is not null and start_time < end_time
      and ((break_start is null and break_end is null)
        or (break_start is not null and break_end is not null
          and start_time <= break_start and break_start < break_end and break_end <= end_time)))
  )
);

create index if not exists doctor_schedules_doctor_idx on public.doctor_schedules(doctor_id);
create index if not exists schedule_exceptions_doctor_date_idx on public.schedule_exceptions(doctor_id, date);

create or replace function public.set_schedule_updated_at()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists doctor_schedules_set_updated_at on public.doctor_schedules;
create trigger doctor_schedules_set_updated_at before update on public.doctor_schedules
for each row execute function public.set_schedule_updated_at();
drop trigger if exists schedule_exceptions_set_updated_at on public.schedule_exceptions;
create trigger schedule_exceptions_set_updated_at before update on public.schedule_exceptions
for each row execute function public.set_schedule_updated_at();

alter table public.doctor_schedules enable row level security;
alter table public.schedule_exceptions enable row level security;

drop policy if exists "public reads doctor schedules" on public.doctor_schedules;
drop policy if exists "public reads schedule exceptions" on public.schedule_exceptions;
drop policy if exists "admins insert doctor schedules" on public.doctor_schedules;
drop policy if exists "admins update doctor schedules" on public.doctor_schedules;
drop policy if exists "admins insert schedule exceptions" on public.schedule_exceptions;
drop policy if exists "admins update schedule exceptions" on public.schedule_exceptions;
drop policy if exists "admins delete schedule exceptions" on public.schedule_exceptions;

create policy "public reads doctor schedules" on public.doctor_schedules
for select to anon, authenticated using (true);
create policy "public reads schedule exceptions" on public.schedule_exceptions
for select to anon, authenticated using (true);

create policy "admins insert doctor schedules" on public.doctor_schedules
for insert to authenticated with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
create policy "admins update doctor schedules" on public.doctor_schedules
for update to authenticated using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
create policy "admins insert schedule exceptions" on public.schedule_exceptions
for insert to authenticated with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
create policy "admins update schedule exceptions" on public.schedule_exceptions
for update to authenticated using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
create policy "admins delete schedule exceptions" on public.schedule_exceptions
for delete to authenticated using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- Only active appointments and their effective durations are exposed to the
-- public availability calculation. Patient data is never returned.
create or replace function public.get_blocking_appointments(
  p_doctor_ids uuid[], p_from date, p_to date
)
returns table (doctor_id uuid, appointment_date date, appointment_time time, duration_minutes integer)
language sql stable security definer set search_path = public, pg_temp as $$
  select appointment_row.doctor_id, appointment_row.appointment_date,
    appointment_row.appointment_time, coalesce(service_row.duration_minutes, 60)
  from public.appointments as appointment_row
  join public.services as service_row on service_row.id = appointment_row.service_id
  where appointment_row.status in ('new', 'confirmed')
    and appointment_row.doctor_id = any(p_doctor_ids)
    and appointment_row.appointment_date between p_from and p_to;
$$;

revoke all on function public.get_blocking_appointments(uuid[], date, date) from public;
grant execute on function public.get_blocking_appointments(uuid[], date, date) to anon, authenticated;

-- Revalidate schedule and overlaps while holding a per-doctor/day transaction
-- lock. This prevents concurrent requests with different start times from
-- creating overlapping appointments.
create or replace function public.create_public_appointment(
  p_service_id uuid,
  p_doctor_id uuid,
  p_date date,
  p_time time,
  p_patient_name text,
  p_patient_phone text,
  p_comment text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  created_id uuid;
  requested_minutes integer;
  candidate_end time;
  period_start time;
  period_end time;
  period_break_start time;
  period_break_end time;
  exception_row public.schedule_exceptions%rowtype;
  schedule_row public.doctor_schedules%rowtype;
  has_exception boolean := false;
  has_saved_schedule boolean := false;
  clinic_today date := (now() at time zone 'Asia/Almaty')::date;
  clinic_time time := (now() at time zone 'Asia/Almaty')::time;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_doctor_id::text || ':' || p_date::text, 0));

  if char_length(trim(coalesce(p_patient_name, ''))) = 0
     or trim(coalesce(p_patient_phone, '')) !~ '^\+7[0-9]{10}$' then
    raise exception 'invalid_patient_data' using errcode = '22023';
  end if;
  if p_date < clinic_today or (p_date = clinic_today and p_time <= clinic_time) then
    raise exception 'slot_in_past' using errcode = '22023';
  end if;
  if extract(minute from p_time) not in (0, 30) or extract(second from p_time) <> 0 then
    raise exception 'invalid_slot_step' using errcode = '22023';
  end if;

  select coalesce(duration_minutes, 60) into requested_minutes
  from public.services where id = p_service_id and active = true;
  if requested_minutes is null
     or not exists(select 1 from public.doctors where id = p_doctor_id and active = true) then
    raise exception 'inactive_catalog_item' using errcode = '22023';
  end if;
  candidate_end := (p_time + make_interval(mins => requested_minutes))::time;

  select * into exception_row from public.schedule_exceptions
  where doctor_id = p_doctor_id and date = p_date;
  has_exception := found;
  select exists(select 1 from public.doctor_schedules where doctor_id = p_doctor_id)
    into has_saved_schedule;

  if has_exception then
    if exception_row.type = 'day_off' then raise exception 'day_off' using errcode = '22023'; end if;
    period_start := exception_row.start_time; period_end := exception_row.end_time;
    period_break_start := exception_row.break_start; period_break_end := exception_row.break_end;
  elsif has_saved_schedule then
    select * into schedule_row from public.doctor_schedules
    where doctor_id = p_doctor_id and weekday = extract(dow from p_date)::integer;
    if not found or schedule_row.active = false then raise exception 'day_off' using errcode = '22023'; end if;
    period_start := schedule_row.start_time; period_end := schedule_row.end_time;
    period_break_start := schedule_row.break_start; period_break_end := schedule_row.break_end;
  else
    -- Compatibility with the existing per-date availability table until a
    -- weekly schedule is saved for this doctor.
    if exists(
      select 1 from generate_series(0, requested_minutes - 30, 30) as offset_minutes
      where not exists(
        select 1 from public.availability
        where doctor_id = p_doctor_id and date = p_date and available = true
          and start_time <= (p_time + make_interval(mins => offset_minutes))::time
          and end_time >= (p_time + make_interval(mins => offset_minutes + 30))::time
      )
    ) then raise exception 'slot_unavailable' using errcode = '22023'; end if;
  end if;

  if has_exception or has_saved_schedule then
    if p_time < period_start or candidate_end > period_end or candidate_end <= p_time then
      raise exception 'slot_outside_hours' using errcode = '22023';
    end if;
    if period_break_start is not null and period_break_end is not null
       and p_time < period_break_end and candidate_end > period_break_start then
      raise exception 'slot_overlaps_break' using errcode = '22023';
    end if;
  end if;

  if exists(
    select 1 from public.appointments as appointment_row
    join public.services as service_row on service_row.id = appointment_row.service_id
    where appointment_row.doctor_id = p_doctor_id
      and appointment_row.appointment_date = p_date
      and appointment_row.status in ('new', 'confirmed')
      and p_time < (appointment_row.appointment_time + make_interval(mins => coalesce(service_row.duration_minutes, 60)))::time
      and candidate_end > appointment_row.appointment_time
  ) then raise exception 'slot_taken' using errcode = '23505'; end if;

  insert into public.appointments(
    patient_name, patient_phone, comment, service_id, doctor_id,
    appointment_date, appointment_time, status
  ) values (
    trim(p_patient_name), trim(p_patient_phone), nullif(trim(coalesce(p_comment, '')), ''),
    p_service_id, p_doctor_id, p_date, p_time, 'new'
  ) returning id into created_id;
  return created_id;
end;
$$;

revoke all on function public.create_public_appointment(uuid, uuid, date, time, text, text, text) from public;
grant execute on function public.create_public_appointment(uuid, uuid, date, time, text, text, text) to anon, authenticated;

commit;
