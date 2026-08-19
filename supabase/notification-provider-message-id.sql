-- Stores the WhatsApp Cloud API message ID (wamid) returned by Meta.
-- Existing jobs remain valid because the new column is nullable.

begin;

alter table public.notification_jobs
  add column if not exists provider_message_id text;

create unique index if not exists notification_jobs_provider_message_id_unique
  on public.notification_jobs(provider_message_id)
  where provider_message_id is not null;

commit;

notify pgrst, 'reload schema';
