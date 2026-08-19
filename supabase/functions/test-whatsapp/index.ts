import { NotificationProviderError, sendWhatsAppMessage, type NotificationJob } from "../_shared/notification-provider.ts";
import type { NotificationEvent, NotificationPayload } from "../_shared/notification-templates.ts";

const allowedEvents = new Set<NotificationEvent>([
  "booking_created", "booking_confirmed", "booking_rescheduled",
  "booking_cancelled", "appointment_reminder",
]);

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

function validPayload(value: unknown): value is NotificationPayload {
  if (!value || typeof value !== "object") return false;
  const payload = value as Record<string, unknown>;
  return ["patientName","appointmentDate","appointmentTime","doctorName","serviceName"]
    .every(key => typeof payload[key] === "string" && Boolean((payload[key] as string).trim()));
}

Deno.serve(async request => {
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const serverKey = getServerKey();
  if (!serverKey || request.headers.get("Authorization") !== `Bearer ${serverKey}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { phone?:string; eventType?:NotificationEvent; recipientType?:"patient"|"doctor"; payload?:unknown };
  try { body = await request.json(); }
  catch { return Response.json({ error: "invalid_request" }, { status: 400 }); }
  if (!body.phone || !body.eventType || !allowedEvents.has(body.eventType) ||
      !["patient","doctor"].includes(body.recipientType ?? "") || !validPayload(body.payload)) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  const job: NotificationJob = {
    recipient_phone: body.phone,
    recipient_type: body.recipientType!,
    event_type: body.eventType,
    payload: body.payload,
  };
  try {
    const result = await sendWhatsAppMessage(job);
    return Response.json({ ok: true, providerMessageId: result.providerMessageId });
  } catch (error) {
    const safeError = error instanceof NotificationProviderError ? error.safeMessage : "provider_error";
    return Response.json({ error: safeError }, { status: 502 });
  }
});
