-- Run after deploying process-notifications and adding these Vault secrets:
--   project_url: https://YOUR_PROJECT_REF.supabase.co
--   notification_function_secret_key: a Supabase secret/server key
-- No credentials are stored in this migration.

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

do $$
declare existing_job bigint;
begin
  select jobid into existing_job from cron.job
  where jobname = 'process-notifications-every-5-minutes';
  if existing_job is not null then perform cron.unschedule(existing_job); end if;
end $$;

select cron.schedule(
  'process-notifications-every-5-minutes',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
      || '/functions/v1/process-notifications',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'notification_function_secret_key'),
      'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'notification_function_secret_key')
    ),
    body := '{}'::jsonb
  );
  $$
);
