-- Run immediately after deploying the server-side booking writer.
-- This closes direct public RPC access without interrupting booking.

begin;

revoke all on function public.create_public_appointment(uuid, uuid, date, time, text, text, text)
  from public, anon, authenticated;
grant execute on function public.create_public_appointment(uuid, uuid, date, time, text, text, text)
  to service_role;

commit;

notify pgrst, 'reload schema';
