-- Read-path indexes for /api/availability date-range queries.
-- Safe to run repeatedly; no table or business-logic changes.

create index if not exists availability_available_date_doctor_idx
  on public.availability (date, doctor_id)
  where available = true;

create index if not exists appointments_date_doctor_time_idx
  on public.appointments (appointment_date, doctor_id, appointment_time);
