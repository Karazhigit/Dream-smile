-- Transaction-safe manual appointment creation and rescheduling for admins.
-- Existing appointments are never deleted or duplicated during a reschedule.

begin;

create or replace function public.create_admin_appointment(
  p_service_id uuid, p_doctor_id uuid, p_date date, p_time time,
  p_patient_name text, p_patient_phone text, p_comment text default null
)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare created_id uuid;
begin
  if coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') <> 'admin' then
    raise exception 'admin_required' using errcode = '42501';
  end if;
  created_id := public.create_public_appointment(
    p_service_id, p_doctor_id, p_date, p_time,
    p_patient_name, p_patient_phone, p_comment
  );
  update public.appointments set status = 'confirmed' where id = created_id;
  return created_id;
end;
$$;

create or replace function public.reschedule_admin_appointment(
  p_appointment_id uuid, p_doctor_id uuid, p_date date, p_time time
)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare
  appointment_row public.appointments%rowtype;
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
  if coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') <> 'admin' then
    raise exception 'admin_required' using errcode = '42501';
  end if;

  select * into appointment_row from public.appointments
  where id = p_appointment_id for update;
  if not found then raise exception 'appointment_not_found' using errcode = 'P0002'; end if;
  if appointment_row.status not in ('new', 'confirmed') then
    raise exception 'inactive_appointment' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_doctor_id::text || ':' || p_date::text, 0));
  if p_date < clinic_today or (p_date = clinic_today and p_time <= clinic_time) then
    raise exception 'slot_in_past' using errcode = '22023';
  end if;

  select coalesce(duration_minutes, 60) into requested_minutes
  from public.services where id = appointment_row.service_id and active = true;
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
    select 1 from public.appointments as other
    join public.services as service_row on service_row.id = other.service_id
    where other.id <> p_appointment_id
      and other.doctor_id = p_doctor_id
      and other.appointment_date = p_date
      and other.status in ('new', 'confirmed')
      and p_time < (other.appointment_time + make_interval(mins => coalesce(service_row.duration_minutes, 60)))::time
      and candidate_end > other.appointment_time
  ) then raise exception 'slot_taken' using errcode = '23505'; end if;

  update public.appointments set
    doctor_id = p_doctor_id,
    appointment_date = p_date,
    appointment_time = p_time
  where id = p_appointment_id;
  return p_appointment_id;
end;
$$;

revoke all on function public.create_admin_appointment(uuid, uuid, date, time, text, text, text) from public;
revoke all on function public.reschedule_admin_appointment(uuid, uuid, date, time) from public;
grant execute on function public.create_admin_appointment(uuid, uuid, date, time, text, text, text) to authenticated;
grant execute on function public.reschedule_admin_appointment(uuid, uuid, date, time) to authenticated;

commit;

-- Make newly created RPCs visible to PostgREST immediately.
notify pgrst, 'reload schema';
