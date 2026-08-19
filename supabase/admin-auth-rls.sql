-- Dream Smile admin authorization and least-privilege public booking access.
-- Admin users must have app_metadata.role = "admin" in Supabase Auth.

begin;

alter table public.services enable row level security;
alter table public.doctors enable row level security;
alter table public.availability enable row level security;
alter table public.appointments enable row level security;

-- Keep the internal doctor phone column out of direct anon queries. The
-- booking catalog only needs these public columns.
revoke all on table public.doctors from anon;
grant select (id, name, specialty, active, created_at) on table public.doctors to anon;

-- Remove the temporary demo policies that exposed patient data and mutations
-- to anyone holding the public anon key.
drop policy if exists "public can read services" on public.services;
drop policy if exists "public can read doctors" on public.doctors;
drop policy if exists "public can read availability" on public.availability;
drop policy if exists "public can read occupied slots" on public.appointments;
drop policy if exists "public can create new requests" on public.appointments;
drop policy if exists "demo admin reads appointments" on public.appointments;
drop policy if exists "demo admin updates appointments" on public.appointments;
drop policy if exists "demo admin inserts services" on public.services;
drop policy if exists "demo admin updates services" on public.services;
drop policy if exists "demo admin inserts doctors" on public.doctors;
drop policy if exists "demo admin updates doctors" on public.doctors;
drop policy if exists "public reads active services" on public.services;
drop policy if exists "public reads active doctors" on public.doctors;
drop policy if exists "public reads available schedule" on public.availability;
drop policy if exists "admins read all services" on public.services;
drop policy if exists "admins insert services" on public.services;
drop policy if exists "admins update services" on public.services;
drop policy if exists "admins read all doctors" on public.doctors;
drop policy if exists "admins insert doctors" on public.doctors;
drop policy if exists "admins update doctors" on public.doctors;
drop policy if exists "admins read appointments" on public.appointments;
drop policy if exists "admins update appointments" on public.appointments;

-- Public catalog/schedule reads expose only rows needed by booking.
create policy "public reads active services"
  on public.services for select to anon, authenticated
  using (active = true);

create policy "public reads active doctors"
  on public.doctors for select to anon
  using (active = true);

create policy "public reads available schedule"
  on public.availability for select to anon, authenticated
  using (available = true);

-- Admin policies. app_metadata cannot be edited by the user through normal
-- profile updates, unlike user_metadata.
create policy "admins read all services"
  on public.services for select to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
create policy "admins insert services"
  on public.services for insert to authenticated
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
create policy "admins update services"
  on public.services for update to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "admins read all doctors"
  on public.doctors for select to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
create policy "admins insert doctors"
  on public.doctors for insert to authenticated
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
create policy "admins update doctors"
  on public.doctors for update to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "admins read appointments"
  on public.appointments for select to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
create policy "admins update appointments"
  on public.appointments for update to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- The public availability API receives only occupied slot coordinates, never
-- patient names, phones, comments, service IDs, or inactive history.
create or replace function public.get_occupied_appointment_slots(
  p_doctor_ids uuid[], p_from date, p_to date
)
returns table (doctor_id uuid, appointment_date date, appointment_time time)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select appointment_row.doctor_id, appointment_row.appointment_date, appointment_row.appointment_time
  from public.appointments as appointment_row
  where appointment_row.status in ('new', 'confirmed')
    and appointment_row.doctor_id = any(p_doctor_ids)
    and appointment_row.appointment_date between p_from and p_to;
$$;

revoke all on function public.get_occupied_appointment_slots(uuid[], date, date) from public;
grant execute on function public.get_occupied_appointment_slots(uuid[], date, date) to anon, authenticated;

-- Public appointment creation remains possible only through this validated
-- function. Direct anon INSERT no longer has an RLS policy.
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
  clinic_today date := (now() at time zone 'Asia/Almaty')::date;
  clinic_time time := (now() at time zone 'Asia/Almaty')::time;
begin
  if char_length(trim(coalesce(p_patient_name, ''))) = 0
     or trim(coalesce(p_patient_phone, '')) !~ '^\+7[0-9]{10}$' then
    raise exception 'invalid_patient_data' using errcode = '22023';
  end if;
  if p_date < clinic_today or (p_date = clinic_today and p_time <= clinic_time) then
    raise exception 'slot_in_past' using errcode = '22023';
  end if;
  if p_time < time '09:00' or p_time > time '18:00'
     or extract(minute from p_time) <> 0 or extract(second from p_time) <> 0
     or p_time = time '13:00' then
    raise exception 'invalid_slot_time' using errcode = '22023';
  end if;
  if not exists(select 1 from public.services where id = p_service_id and active = true)
     or not exists(select 1 from public.doctors where id = p_doctor_id and active = true) then
    raise exception 'inactive_catalog_item' using errcode = '22023';
  end if;
  if not exists(
    select 1 from public.availability
    where doctor_id = p_doctor_id and date = p_date and available = true
      and start_time <= p_time and end_time >= (p_time + interval '60 minutes')::time
  ) then
    raise exception 'slot_unavailable' using errcode = '22023';
  end if;

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
revoke all on function public.create_public_appointment(uuid, uuid, date, time, text, text, text) from anon, authenticated;
grant execute on function public.create_public_appointment(uuid, uuid, date, time, text, text, text) to service_role;

commit;
