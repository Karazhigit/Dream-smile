import { createClient } from "@supabase/supabase-js";
import { NotificationProviderError, sendNotification, type NotificationJob } from "../_shared/notification-provider.ts";

type QueueJob = NotificationJob & {
  id: string;
  appointment_id: string;
  attempts: number;
};

function getServerKey() {
  const configuredKeys = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (configuredKeys) {
    try {
      const keys = JSON.parse(configuredKeys) as Record<string, string>;
      if (keys.default) return keys.default;
    } catch {
      // Fall through to the legacy server-only key.
    }
  }
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const key = getServerKey();
  if (!url || !key) return Response.json({ error: "server_configuration_missing" }, { status: 500 });
  if (request.headers.get("Authorization") !== `Bearer ${key}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await supabase.rpc("claim_notification_jobs", { p_limit: 20 });
  if (error) {
    console.error("Notification worker could not claim jobs", { code: error.code });
    return Response.json({ error: "claim_failed" }, { status: 500 });
  }

  let processed = 0;
  for (const job of (data ?? []) as QueueJob[]) {
    try {
      if (job.event_type === "appointment_reminder") {
        const { data: appointment, error: appointmentError } = await supabase
          .from("appointments")
          .select("status,appointment_date,appointment_time")
          .eq("id", job.appointment_id)
          .maybeSingle();
        const expectedTime = job.payload.appointmentTime;
        const currentTime = appointment?.appointment_time?.slice(0, 5);
        if (appointmentError || !appointment || appointment.status !== "confirmed" ||
          appointment.appointment_date !== job.payload.appointmentDate || currentTime !== expectedTime) {
          await supabase.from("notification_jobs").delete().eq("id", job.id);
          continue;
        }
      }

      const result = await sendNotification(job);
      const { error: updateError } = await supabase.from("notification_jobs").update({
        status: "sent", sent_at: new Date().toISOString(), locked_at: null, last_error: null,
        provider_message_id: result.providerMessageId,
      }).eq("id", job.id).eq("status", "processing");
      if (updateError) throw new Error("job_update_failed");
      processed += 1;
    } catch (error) {
      const terminal = job.attempts >= 3;
      const retryUpdate: Record<string, string | null> = {
        status: terminal ? "failed" : "pending",
        locked_at: null,
        last_error: error instanceof NotificationProviderError ? error.safeMessage : "provider_error",
      };
      if (!terminal) retryUpdate.scheduled_for = new Date(Date.now() + 5 * 60_000).toISOString();
      const { error: retryError } = await supabase.from("notification_jobs").update(retryUpdate).eq("id", job.id).eq("status", "processing");
      if (retryError) console.error("Notification worker could not update failed job", { code: retryError.code });
    }
  }

  return Response.json({ claimed: (data ?? []).length, processed });
});
