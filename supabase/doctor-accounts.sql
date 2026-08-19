-- Doctor accounts, private doctor access and read-only schedule support.
-- Auth users are created in Supabase Auth; passwords are never stored here.

begin;

alter table public.doctors add column if not exists phone text;

do $$ begin
  alter table public.doctors add constraint doctors_phone_format_check
    check (phone is null or phone ~ '^\+7[0-9]{10}$');
exception when duplicate_object then null;
end $$;

create table if not exists public.doctor_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  doctor_id uuid not null unique references public.doctors(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists doctor_accounts_user_idx on public.doctor_accounts(user_id);
create index if not exists doctor_accounts_doctor_idx on public.doctor_accounts(doctor_id);

alter table public.doctor_accounts enable row level security;
revoke all on table public.doctor_accounts from anon;
grant select, insert, update, delete on table public.doctor_accounts to authenticated;
revoke all on table public.doctors from anon;
grant select (id, name, specialty, active, created_at) on table public.doctors to anon;

drop policy if exists "doctors read own account" on public.doctor_accounts;
drop policy if exists "admins manage doctor accounts" on public.doctor_accounts;
drop policy if exists "doctors read own appointments" on public.appointments;
drop policy if exists "doctors read services" on public.services;
drop policy if exists "doctors read own profile" on public.doctors;

create policy "doctors read own account" on public.doctor_accounts
for select to authenticated using (user_id = auth.uid());

create policy "admins manage doctor accounts" on public.doctor_accounts
for all to authenticated
using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "doctors read own appointments" on public.appointments
for select to authenticated using (
  exists (
    select 1 from public.doctor_accounts as account
    where account.user_id = auth.uid() and account.doctor_id = appointments.doctor_id
  )
);

create policy "doctors read services" on public.services
for select to authenticated using (
  exists (select 1 from public.doctor_accounts as account where account.user_id = auth.uid())
);

create policy "doctors read own profile" on public.doctors
for select to authenticated using (
  exists (
    select 1 from public.doctor_accounts as account
    where account.user_id = auth.uid() and account.doctor_id = doctors.id
  )
);

create or replace function public.complete_doctor_appointment(p_appointment_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  mapped_doctor_id uuid;
  appointment_doctor_id uuid;
  completed_id uuid;
begin
  select doctor_id into mapped_doctor_id
  from public.doctor_accounts where user_id = auth.uid();
  if mapped_doctor_id is null then
    raise exception 'doctor_required' using errcode = '42501';
  end if;

  select doctor_id into appointment_doctor_id
  from public.appointments where id = p_appointment_id;
  if appointment_doctor_id is null or appointment_doctor_id <> mapped_doctor_id then
    raise exception 'doctor_appointment_forbidden' using errcode = '42501';
  end if;

  update public.appointments set status = 'completed'
  where id = p_appointment_id and doctor_id = mapped_doctor_id and status = 'confirmed'
  returning id into completed_id;
  if completed_id is null then
    raise exception 'invalid_status_transition' using errcode = '22023';
  end if;
  return completed_id;
end;
$$;

revoke all on function public.complete_doctor_appointment(uuid) from public;
grant execute on function public.complete_doctor_appointment(uuid) to authenticated;

commit;

notify pgrst, 'reload schema';
