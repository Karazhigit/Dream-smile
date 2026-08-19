-- Dream Smile transactional notification queue.
-- Run this migration before deploying process-notifications.

begin;

create table if not exists public.notification_jobs (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  recipient_type text not null check (recipient_type in ('patient', 'doctor')),
  recipient_phone text not null,
  event_type text not null check (event_type in (
    'booking_created', 'booking_confirmed', 'booking_rescheduled',
    'booking_cancelled', 'appointment_reminder'
  )),
  scheduled_for timestamptz not null default now(),
  status text not null default 'pending' check (status in ('pending', 'processing', 'sent', 'failed')),
  attempts integer not null default 0 check (attempts >= 0),
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  dedupe_key text not null unique,
  payload jsonb not null default '{}'::jsonb,
  locked_at timestamptz
);

create index if not exists notification_jobs_due_idx
  on public.notification_jobs(scheduled_for, created_at)
  where status in ('pending', 'processing');
create index if not exists notification_jobs_appointment_idx
  on public.notification_jobs(appointment_id, created_at desc);

alter table public.notification_jobs enable row level security;
revoke all on table public.notification_jobs from anon;
grant select on table public.notification_jobs to authenticated;

drop policy if exists "admins read notification jobs" on public.notification_jobs;
create policy "admins read notification jobs"
  on public.notification_jobs for select to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create or replace function public.enqueue_notification_job(
  p_appointment_id uuid,
  p_recipient_type text,
  p_recipient_phone text,
  p_event_type text,
  p_scheduled_for timestamptz,
  p_dedupe_key text,
  p_payload jsonb
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if nullif(trim(coalesce(p_recipient_phone, '')), '') is null then
    return;
  end if;

  insert into public.notification_jobs(
    appointment_id, recipient_type, recipient_phone, event_type,
    scheduled_for, dedupe_key, payload
  ) values (
    p_appointment_id, p_recipient_type, trim(p_recipient_phone), p_event_type,
    p_scheduled_for, p_dedupe_key, p_payload
  ) on conflict (dedupe_key) do nothing;
end;
$$;

revoke all on function public.enqueue_notification_job(uuid, text, text, text, timestamptz, text, jsonb) from public;

create or replace function public.queue_appointment_notifications()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  doctor_name text;
  doctor_phone text;
  service_name text;
  appointment_at timestamptz;
  reminder_at timestamptz;
  notification_payload jsonb;
  was_rescheduled boolean := false;
  key_suffix text;
begin
  select coalesce(nullif(trim(d.name), ''), d.specialty), d.phone, s.name
    into doctor_name, doctor_phone, service_name
  from public.doctors d
  join public.services s on s.id = new.service_id
  where d.id = new.doctor_id;

  appointment_at := (new.appointment_date + new.appointment_time) at time zone 'Asia/Almaty';
  notification_payload := jsonb_build_object(
    'patientName', new.patient_name,
    'appointmentDate', new.appointment_date::text,
    'appointmentTime', to_char(new.appointment_time, 'HH24:MI'),
    'appointmentAt', appointment_at,
    'doctorName', coalesce(doctor_name, 'Специалист'),
    'serviceName', coalesce(service_name, 'Услуга')
  );

  if tg_op = 'INSERT' then
    perform public.enqueue_notification_job(
      new.id, 'doctor', doctor_phone, 'booking_created', now(),
      'booking_created:doctor:' || new.id::text, notification_payload
    );
    return new;
  end if;

  was_rescheduled := new.status in ('new', 'confirmed') and (
    new.doctor_id is distinct from old.doctor_id or
    new.service_id is distinct from old.service_id or
    new.appointment_date is distinct from old.appointment_date or
    new.appointment_time is distinct from old.appointment_time
  );

  if was_rescheduled then
    delete from public.notification_jobs
    where appointment_id = new.id
      and event_type = 'appointment_reminder'
      and status in ('pending', 'processing');

    key_suffix := concat_ws(':',
      old.doctor_id::text, old.appointment_date::text, to_char(old.appointment_time, 'HH24:MI'),
      new.doctor_id::text, new.appointment_date::text, to_char(new.appointment_time, 'HH24:MI')
    );
    perform public.enqueue_notification_job(
      new.id, 'patient', new.patient_phone, 'booking_rescheduled', now(),
      'booking_rescheduled:patient:' || new.id::text || ':' || key_suffix, notification_payload
    );
    perform public.enqueue_notification_job(
      new.id, 'doctor', doctor_phone, 'booking_rescheduled', now(),
      'booking_rescheduled:doctor:' || new.id::text || ':' || key_suffix, notification_payload
    );
  end if;

  if new.status = 'confirmed' and old.status is distinct from 'confirmed' then
    perform public.enqueue_notification_job(
      new.id, 'patient', new.patient_phone, 'booking_confirmed', now(),
      'booking_confirmed:patient:' || new.id::text, notification_payload
    );
  end if;

  if new.status = 'cancelled' and old.status is distinct from 'cancelled' then
    delete from public.notification_jobs
    where appointment_id = new.id
      and event_type = 'appointment_reminder'
      and status in ('pending', 'processing');
    perform public.enqueue_notification_job(
      new.id, 'patient', new.patient_phone, 'booking_cancelled', now(),
      'booking_cancelled:patient:' || new.id::text, notification_payload
    );
    perform public.enqueue_notification_job(
      new.id, 'doctor', doctor_phone, 'booking_cancelled', now(),
      'booking_cancelled:doctor:' || new.id::text, notification_payload
    );
  elsif new.status = 'completed' and old.status is distinct from 'completed' then
    delete from public.notification_jobs
    where appointment_id = new.id
      and event_type = 'appointment_reminder'
      and status in ('pending', 'processing');
  end if;

  if new.status = 'confirmed' and (old.status is distinct from 'confirmed' or was_rescheduled) then
    reminder_at := appointment_at - interval '1 hour';
    if reminder_at > now() then
      perform public.enqueue_notification_job(
        new.id, 'patient', new.patient_phone, 'appointment_reminder', reminder_at,
        concat_ws(':', 'appointment_reminder', new.id::text, new.appointment_date::text,
          to_char(new.appointment_time, 'HH24:MI')), notification_payload
      );
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.queue_appointment_notifications() from public;
drop trigger if exists appointments_queue_notifications on public.appointments;
create trigger appointments_queue_notifications
after insert or update of status, doctor_id, service_id, appointment_date, appointment_time
on public.appointments
for each row execute function public.queue_appointment_notifications();

create or replace function public.claim_notification_jobs(p_limit integer default 20)
returns setof public.notification_jobs
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  return query
  with candidates as (
    select job.id
    from public.notification_jobs job
    where job.attempts < 3
      and job.scheduled_for <= now()
      and (
        job.status = 'pending' or
        (job.status = 'processing' and job.locked_at < now() - interval '10 minutes')
      )
    order by job.scheduled_for, job.created_at
    for update skip locked
    limit greatest(1, least(coalesce(p_limit, 20), 20))
  )
  update public.notification_jobs job
  set status = 'processing', attempts = job.attempts + 1, locked_at = now(), last_error = null
  from candidates
  where job.id = candidates.id
  returning job.*;
end;
$$;

revoke all on function public.claim_notification_jobs(integer) from public, anon, authenticated;
grant execute on function public.claim_notification_jobs(integer) to service_role;

commit;

notify pgrst, 'reload schema';
