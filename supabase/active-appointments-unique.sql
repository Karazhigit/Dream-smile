-- Allow a cancelled/completed slot to be booked again while preserving
-- race-condition protection for active appointments.

begin;

alter table public.appointments
  drop constraint if exists appointments_doctor_slot_unique;

create unique index if not exists appointments_active_doctor_slot_unique
  on public.appointments (doctor_id, appointment_date, appointment_time)
  where status in ('new', 'confirmed');

commit;
