import { buildDoctorNotificationMessage, buildNotificationMessage, formatNotificationDate, type NotificationEvent, type NotificationPayload } from "./notification-templates.ts";

export type NotificationJob = {
  recipient_type: "patient" | "doctor";
  recipient_phone: string;
  event_type: NotificationEvent;
  payload: NotificationPayload;
};

export type NotificationSendResult = { providerMessageId: string | null };

export class NotificationProviderError extends Error {
  readonly safeMessage: string;
  constructor(safeMessage: string) {
    super(safeMessage);
    this.name = "NotificationProviderError";
    this.safeMessage = safeMessage;
  }
}

const templateEnvByEvent: Record<NotificationEvent, string> = {
  booking_confirmed: "WHATSAPP_TEMPLATE_BOOKING_CONFIRMED",
  booking_rescheduled: "WHATSAPP_TEMPLATE_BOOKING_RESCHEDULED",
  booking_cancelled: "WHATSAPP_TEMPLATE_BOOKING_CANCELLED",
  appointment_reminder: "WHATSAPP_TEMPLATE_APPOINTMENT_REMINDER",
  booking_created: "WHATSAPP_TEMPLATE_DOCTOR_NEW_BOOKING",
};

export function normalizeWhatsAppCloudPhone(value: string) {
  let digits = value.replace(/[^0-9]/g, "");
  if (digits.length === 11 && digits.startsWith("8")) digits = `7${digits.slice(1)}`;
  return /^7[67][0-9]{9}$/.test(digits) ? digits : null;
}

export function getWhatsAppTemplateEnvName(event: NotificationEvent) {
  return templateEnvByEvent[event];
}

export function buildWhatsAppTemplateBody(job: NotificationJob, templateName: string, languageCode: string) {
  return {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: normalizeWhatsAppCloudPhone(job.recipient_phone),
    type: "template",
    template: {
      name: templateName,
      language: { code: languageCode },
      components: [{
        type: "body",
        parameters: [
          { type: "text", text: job.payload.patientName },
          { type: "text", text: job.payload.doctorName },
          { type: "text", text: formatNotificationDate(job.payload.appointmentDate) },
          { type: "text", text: job.payload.appointmentTime },
          { type: "text", text: job.payload.serviceName },
        ],
      }],
    },
  };
}

export async function sendWhatsAppMessage(job: NotificationJob): Promise<NotificationSendResult> {
  const phone = normalizeWhatsAppCloudPhone(job.recipient_phone);
  if (!phone) throw new NotificationProviderError("invalid_recipient_phone");

  const accessToken = Deno.env.get("WHATSAPP_ACCESS_TOKEN") ?? "";
  const phoneNumberId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID") ?? "";
  const apiVersion = Deno.env.get("WHATSAPP_API_VERSION") ?? "";
  const templateName = Deno.env.get(getWhatsAppTemplateEnvName(job.event_type)) ?? "";
  const languageCode = Deno.env.get("WHATSAPP_TEMPLATE_LANGUAGE") ?? "ru";
  if (!accessToken || !phoneNumberId || !apiVersion || !templateName) {
    throw new NotificationProviderError("whatsapp_configuration_missing");
  }
  if (!/^v[0-9]+\.[0-9]+$/.test(apiVersion) || !/^[0-9]+$/.test(phoneNumberId)) {
    throw new NotificationProviderError("whatsapp_configuration_invalid");
  }

  let response: Response;
  try {
    response = await fetch(`https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(buildWhatsAppTemplateBody(job, templateName, languageCode)),
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new NotificationProviderError("whatsapp_network_error");
  }

  const body = await response.json().catch(() => null) as { messages?: Array<{ id?: string }>; error?: { code?: number } } | null;
  if (!response.ok) {
    const metaCode = Number.isInteger(body?.error?.code) ? `_${body!.error!.code}` : "";
    throw new NotificationProviderError(`whatsapp_api_error_${response.status}${metaCode}`);
  }
  const providerMessageId = body?.messages?.[0]?.id;
  if (!providerMessageId) throw new NotificationProviderError("whatsapp_response_missing_message_id");
  return { providerMessageId };
}

export async function sendNotification(job: NotificationJob): Promise<NotificationSendResult> {
  const provider = (Deno.env.get("NOTIFICATION_PROVIDER") ?? "log").toLowerCase();
  if (provider === "log") {
    job.recipient_type === "doctor"
      ? buildDoctorNotificationMessage(job.event_type, job.payload)
      : buildNotificationMessage(job.event_type, job.payload);
    console.log("Notification sent (test mode)");
    return { providerMessageId: null };
  }
  if (provider === "whatsapp") return sendWhatsAppMessage(job);
  throw new NotificationProviderError("notification_provider_not_supported");
}
