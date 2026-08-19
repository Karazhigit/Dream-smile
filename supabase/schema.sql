create extension if not exists pgcrypto;

create table if not exists public.services (
  id uuid primary key default gen_random_uuid(), name text not null check (char_length(trim(name)) > 0),
  duration_minutes integer check (duration_minutes is null or duration_minutes > 0), active boolean not null default true,
  created_at timestamptz not null default now()
);
create table if not exists public.doctors (
  id uuid primary key default gen_random_uuid(), name text, specialty text not null check (char_length(trim(specialty)) > 0),
  active boolean not null default true, created_at timestamptz not null default now()
);
create table if not exists public.availability (
  id uuid primary key default gen_random_uuid(), doctor_id uuid not null references public.doctors(id) on delete cascade,
  date date not null, start_time time not null, end_time time not null, available boolean not null default true,
  constraint availability_time_order check (start_time < end_time)
);
create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(), patient_name text not null check (char_length(trim(patient_name)) > 0),
  patient_phone text not null check (char_length(trim(patient_phone)) >= 7), comment text,
  service_id uuid not null references public.services(id) on delete restrict,
  doctor_id uuid not null references public.doctors(id) on delete restrict,
  appointment_date date not null, appointment_time time not null,
  status text not null default 'new' check (status in ('new','confirmed','completed','cancelled')),
  created_at timestamptz not null default now()
);
create index if not exists appointments_date_idx on public.appointments(appointment_date);
create index if not exists availability_doctor_date_idx on public.availability(doctor_id, date);
create index if not exists availability_available_date_doctor_idx on public.availability(date, doctor_id) where available = true;
create index if not exists appointments_date_doctor_time_idx on public.appointments(appointment_date, doctor_id, appointment_time);
create unique index if not exists appointments_active_doctor_slot_unique on public.appointments(doctor_id, appointment_date, appointment_time) where status in ('new','confirmed');

alter table public.services enable row level security;
alter table public.doctors enable row level security;
alter table public.availability enable row level security;
alter table public.appointments enable row level security;

revoke all on table public.doctors from anon;
grant select (id, name, specialty, active, created_at) on table public.doctors to anon;

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

-- Production-safe baseline. Public appointment creation is provided only by
-- the validated security-definer RPC in the later auth/schedule migrations.
create policy "public reads active services" on public.services for select to anon, authenticated using (active = true);
create policy "public reads active doctors" on public.doctors for select to anon using (active = true);
create policy "public reads available schedule" on public.availability for select to anon, authenticated using (available = true);

create policy "admins read all services" on public.services for select to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
create policy "admins insert services" on public.services for insert to authenticated
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
create policy "admins update services" on public.services for update to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
create policy "admins read all doctors" on public.doctors for select to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
create policy "admins insert doctors" on public.doctors for insert to authenticated
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
create policy "admins update doctors" on public.doctors for update to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
create policy "admins read appointments" on public.appointments for select to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
create policy "admins update appointments" on public.appointments for update to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
