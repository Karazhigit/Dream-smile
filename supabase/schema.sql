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
  created_at timestamptz not null default now(),
  constraint appointments_doctor_slot_unique unique (doctor_id, appointment_date, appointment_time)
);
create index if not exists appointments_date_idx on public.appointments(appointment_date);
create index if not exists availability_doctor_date_idx on public.availability(doctor_id, date);

alter table public.services enable row level security;
alter table public.doctors enable row level security;
alter table public.availability enable row level security;
alter table public.appointments enable row level security;

drop policy if exists "public can read services" on public.services;
drop policy if exists "public can read doctors" on public.doctors;
drop policy if exists "public can read availability" on public.availability;
drop policy if exists "demo admin reads appointments" on public.appointments;
drop policy if exists "public can read occupied slots" on public.appointments;
drop policy if exists "public can create new requests" on public.appointments;
drop policy if exists "demo admin updates appointments" on public.appointments;
drop policy if exists "demo admin inserts services" on public.services;
drop policy if exists "demo admin updates services" on public.services;
drop policy if exists "demo admin inserts doctors" on public.doctors;
drop policy if exists "demo admin updates doctors" on public.doctors;

create policy "public can read services" on public.services for select to anon, authenticated using (true);
create policy "public can read doctors" on public.doctors for select to anon, authenticated using (true);
create policy "public can read availability" on public.availability for select to anon, authenticated using (available = true);
create policy "public can create new requests" on public.appointments for insert to anon, authenticated with check (status = 'new');

-- TEMPORARY DEMO ADMIN POLICIES. Replace with authenticated staff policies before launch.
-- The read policy exposes appointment details to the anon role and must never be used with production data.
create policy "demo admin reads appointments" on public.appointments for select to anon, authenticated using (true);
create policy "demo admin updates appointments" on public.appointments for update to anon, authenticated using (true) with check (status in ('new','confirmed','completed','cancelled'));
create policy "demo admin inserts services" on public.services for insert to anon, authenticated with check (true);
create policy "demo admin updates services" on public.services for update to anon, authenticated using (true) with check (true);
create policy "demo admin inserts doctors" on public.doctors for insert to anon, authenticated with check (true);
create policy "demo admin updates doctors" on public.doctors for update to anon, authenticated using (true) with check (true);
