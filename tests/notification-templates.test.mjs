import assert from "node:assert/strict";
import test from "node:test";
import { buildDoctorNotificationMessage, buildNotificationMessage, formatNotificationDate } from "../supabase/functions/_shared/notification-templates.ts";

const payload={patientName:"Алия",appointmentDate:"2026-08-19",appointmentTime:"15:00",doctorName:"Данияр",serviceName:"Лечение кариеса"};

test("formats clinic dates without relying on server locale",()=>{
  assert.equal(formatNotificationDate("2026-08-19"),"19 августа 2026");
});

test("builds patient confirmation and reminder messages",()=>{
  const confirmed=buildNotificationMessage("booking_confirmed",payload);
  const reminder=buildNotificationMessage("appointment_reminder",payload);
  assert.match(confirmed,/Алия/);assert.match(confirmed,/19 августа 2026/);assert.match(confirmed,/15:00/);assert.match(confirmed,/Данияр/);assert.match(confirmed,/Лечение кариеса/);
  assert.match(reminder,/через 1 час/);
});

test("builds reschedule and cancellation messages for both recipients",()=>{
  assert.match(buildNotificationMessage("booking_rescheduled",payload),/перенесена/);
  assert.match(buildNotificationMessage("booking_cancelled",payload),/отменена/);
  assert.match(buildDoctorNotificationMessage("booking_rescheduled",payload),/пациента Алия/);
  assert.match(buildDoctorNotificationMessage("booking_cancelled",payload),/отменена/);
});
