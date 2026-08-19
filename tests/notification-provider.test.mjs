import assert from "node:assert/strict";
import test from "node:test";
import { buildWhatsAppTemplateBody, getWhatsAppTemplateEnvName, normalizeWhatsAppCloudPhone } from "../supabase/functions/_shared/notification-provider.ts";

const job={
  recipient_type:"patient",
  recipient_phone:"+7 (708) 235-94-67",
  event_type:"booking_confirmed",
  payload:{patientName:"Алия",doctorName:"Данияр",appointmentDate:"2026-08-19",appointmentTime:"15:00",serviceName:"Лечение"},
};

test("normalizes valid Kazakhstan WhatsApp numbers",()=>{
  assert.equal(normalizeWhatsAppCloudPhone("+7 708 235 94 67"),"77082359467");
  assert.equal(normalizeWhatsAppCloudPhone("8 (708) 235-94-67"),"77082359467");
});

test("rejects clearly invalid WhatsApp numbers",()=>{
  assert.equal(normalizeWhatsAppCloudPhone("+7 708 23"),null);
  assert.equal(normalizeWhatsAppCloudPhone("+1 202 555 0123"),null);
});

test("maps every notification event to configured template env",()=>{
  assert.equal(getWhatsAppTemplateEnvName("booking_confirmed"),"WHATSAPP_TEMPLATE_BOOKING_CONFIRMED");
  assert.equal(getWhatsAppTemplateEnvName("booking_rescheduled"),"WHATSAPP_TEMPLATE_BOOKING_RESCHEDULED");
  assert.equal(getWhatsAppTemplateEnvName("booking_cancelled"),"WHATSAPP_TEMPLATE_BOOKING_CANCELLED");
  assert.equal(getWhatsAppTemplateEnvName("appointment_reminder"),"WHATSAPP_TEMPLATE_APPOINTMENT_REMINDER");
  assert.equal(getWhatsAppTemplateEnvName("booking_created"),"WHATSAPP_TEMPLATE_DOCTOR_NEW_BOOKING");
});

test("builds a template request with five ordered body parameters",()=>{
  const body=buildWhatsAppTemplateBody(job,"configured_template","ru");
  assert.equal(body.type,"template");
  assert.equal(body.to,"77082359467");
  assert.equal(body.template.name,"configured_template");
  assert.deepEqual(body.template.components[0].parameters.map(parameter=>parameter.text),[
    "Алия","Данияр","19 августа 2026","15:00","Лечение",
  ]);
});
