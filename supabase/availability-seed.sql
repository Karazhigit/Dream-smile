-- Test schedule for every active doctor: daily 09:00-19:00 for 14 days.
-- Each row is one one-hour slot; 13:00-14:00 is omitted for lunch.
-- Existing matching rows (including unavailable overrides) are preserved.

begin;

insert into public.availability (doctor_id, date, start_time, end_time, available)
select
  doctor.id,
  schedule_date::date,
  make_time(slot_hour, 0, 0),
  make_time(slot_hour + 1, 0, 0),
  true
from public.doctors as doctor
cross join generate_series(
  current_date,
  current_date + interval '13 days',
  interval '1 day'
) as dates(schedule_date)
cross join generate_series(9, 18) as hours(slot_hour)
where doctor.active = true
  and slot_hour <> 13
  and not exists (
    select 1
    from public.availability as existing
    where existing.doctor_id = doctor.id
      and existing.date = schedule_date::date
      and existing.start_time = make_time(slot_hour, 0, 0)
      and existing.end_time = make_time(slot_hour + 1, 0, 0)
  );

commit;
