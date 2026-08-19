-- Final production security hardening for Dream Smile.
-- Safe to run repeatedly. Existing appointments are never changed or deleted.

begin;

alter table public.services enable row level security;
alter table public.doctors enable row level security;
alter table public.availability enable row level security;
alter table public.appointments enable row level security;
alter table public.doctor_accounts enable row level security;
alter table public.doctor_schedules enable row level security;
alter table public.schedule_exceptions enable row level security;
alter table public.notification_jobs enable row level security;

-- Remove every known legacy/demo policy that exposed patient data or writes.
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
drop policy if exists "doctors read own account" on public.doctor_accounts;
drop policy if exists "admins manage doctor accounts" on public.doctor_accounts;
drop policy if exists "doctors read own appointments" on public.appointments;
drop policy if exists "doctors read services" on public.services;
drop policy if exists "doctors read own profile" on public.doctors;
drop policy if exists "public reads doctor schedules" on public.doctor_schedules;
drop policy if exists "public reads schedule exceptions" on public.schedule_exceptions;
drop policy if exists "admins insert doctor schedules" on public.doctor_schedules;
drop policy if exists "admins update doctor schedules" on public.doctor_schedules;
drop policy if exists "admins insert schedule exceptions" on public.schedule_exceptions;
drop policy if exists "admins update schedule exceptions" on public.schedule_exceptions;
drop policy if exists "admins delete schedule exceptions" on public.schedule_exceptions;
drop policy if exists "admins read notification jobs" on public.notification_jobs;

create policy "public reads active services" on public.services for select to anon, authenticated using (active = true);
create policy "public reads active doctors" on public.doctors for select to anon using (active = true);
create policy "public reads available schedule" on public.availability for select to anon, authenticated using (available = true);
create policy "admins read all services" on public.services for select to authenticated using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
create policy "admins insert services" on public.services for insert to authenticated with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
create policy "admins update services" on public.services for update to authenticated using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin') with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
create policy "admins read all doctors" on public.doctors for select to authenticated using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
create policy "admins insert doctors" on public.doctors for insert to authenticated with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
create policy "admins update doctors" on public.doctors for update to authenticated using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin') with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
create policy "admins read appointments" on public.appointments for select to authenticated using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
create policy "admins update appointments" on public.appointments for update to authenticated using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin') with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "doctors read own account" on public.doctor_accounts for select to authenticated using (user_id = auth.uid());
create policy "admins manage doctor accounts" on public.doctor_accounts for all to authenticated using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin') with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
create policy "doctors read own appointments" on public.appointments for select to authenticated using (exists (select 1 from public.doctor_accounts account where account.user_id = auth.uid() and account.doctor_id = appointments.doctor_id));
create policy "doctors read services" on public.services for select to authenticated using (exists (select 1 from public.doctor_accounts account where account.user_id = auth.uid()));
create policy "doctors read own profile" on public.doctors for select to authenticated using (exists (select 1 from public.doctor_accounts account where account.user_id = auth.uid() and account.doctor_id = doctors.id));

create policy "public reads doctor schedules" on public.doctor_schedules for select to anon, authenticated using (true);
create policy "public reads schedule exceptions" on public.schedule_exceptions for select to anon, authenticated using (true);
create policy "admins insert doctor schedules" on public.doctor_schedules for insert to authenticated with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
create policy "admins update doctor schedules" on public.doctor_schedules for update to authenticated using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin') with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
create policy "admins insert schedule exceptions" on public.schedule_exceptions for insert to authenticated with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
create policy "admins update schedule exceptions" on public.schedule_exceptions for update to authenticated using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin') with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
create policy "admins delete schedule exceptions" on public.schedule_exceptions for delete to authenticated using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
create policy "admins read notification jobs" on public.notification_jobs for select to authenticated using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- Table privileges are intentionally narrower than the RLS policies.
revoke all on table public.appointments from anon;
revoke all on table public.appointments from authenticated;
grant select on table public.appointments to authenticated;
grant update (status) on table public.appointments to authenticated;

revoke all on table public.services from anon;
revoke all on table public.services from authenticated;
grant select on table public.services to anon, authenticated;
grant insert, update on table public.services to authenticated;

revoke all on table public.doctors from anon;
revoke all on table public.doctors from authenticated;
grant select (id, name, specialty, active, created_at) on table public.doctors to anon;
grant select on table public.doctors to authenticated;
grant insert, update on table public.doctors to authenticated;

revoke all on table public.availability from anon, authenticated;
grant select on table public.availability to anon, authenticated;

revoke all on table public.doctor_accounts from anon;
revoke all on table public.doctor_accounts from authenticated;
grant select, insert, update, delete on table public.doctor_accounts to authenticated;

revoke all on table public.doctor_schedules from anon, authenticated;
grant select on table public.doctor_schedules to anon, authenticated;
grant insert, update on table public.doctor_schedules to authenticated;

revoke all on table public.schedule_exceptions from anon, authenticated;
grant select on table public.schedule_exceptions to anon, authenticated;
grant insert, update, delete on table public.schedule_exceptions to authenticated;

revoke all on table public.notification_jobs from anon;
revoke all on table public.notification_jobs from authenticated;
grant select on table public.notification_jobs to authenticated;

-- Enforce bounded patient input for every insertion path, including direct RPC
-- calls. NOT VALID preserves older rows while still checking every new row.
do $$ begin
  alter table public.appointments add constraint appointments_patient_name_length_check
    check (char_length(trim(patient_name)) between 1 and 120) not valid;
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.appointments add constraint appointments_patient_phone_format_check
    check (patient_phone ~ '^\+7[0-9]{10}$') not valid;
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.appointments add constraint appointments_comment_length_check
    check (comment is null or char_length(comment) <= 1000) not valid;
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.services add constraint services_name_length_check
    check (char_length(trim(name)) between 1 and 120) not valid;
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.doctors add constraint doctors_name_length_check
    check (name is null or char_length(trim(name)) between 1 and 120) not valid;
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.doctors add constraint doctors_specialty_length_check
    check (char_length(trim(specialty)) between 1 and 120) not valid;
exception when duplicate_object then null; end $$;

-- Only the approved RPCs may bypass appointment RLS.
revoke all on function public.create_public_appointment(uuid, uuid, date, time, text, text, text) from public;
-- Keep the existing anon execute grant during the deployment transition so the
-- currently deployed booking stays online. security-hardening-finalize.sql
-- removes it immediately after the new server code is deployed.
grant execute on function public.create_public_appointment(uuid, uuid, date, time, text, text, text) to service_role;
revoke all on function public.get_blocking_appointments(uuid[], date, date) from public;
grant execute on function public.get_blocking_appointments(uuid[], date, date) to anon, authenticated;
revoke all on function public.create_admin_appointment(uuid, uuid, date, time, text, text, text) from public;
grant execute on function public.create_admin_appointment(uuid, uuid, date, time, text, text, text) to authenticated;
revoke all on function public.reschedule_admin_appointment(uuid, uuid, date, time) from public;
grant execute on function public.reschedule_admin_appointment(uuid, uuid, date, time) to authenticated;
revoke all on function public.complete_doctor_appointment(uuid) from public;
grant execute on function public.complete_doctor_appointment(uuid) to authenticated;
revoke all on function public.claim_notification_jobs(integer) from public, anon, authenticated;
grant execute on function public.claim_notification_jobs(integer) to service_role;

commit;

notify pgrst, 'reload schema';
