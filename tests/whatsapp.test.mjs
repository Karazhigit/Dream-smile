import test from "node:test";
import assert from "node:assert/strict";
import { buildDoctorWhatsAppMessage, buildDoctorWhatsAppUrl, buildWhatsAppMessage, createWhatsAppUrl, normalizeWhatsAppPhone } from "../lib/whatsapp.ts";

const appointment={
  patientName:"Алишер",
  patientPhone:"+7 708 235 94 67",
  appointmentDate:"2026-08-19",
  appointmentTime:"15:00",
  status:"confirmed",
  doctor:{id:"doctor-id",name:"Данияр",specialty:"Стоматолог",phone:"+7 701 123 45 67"},
  service:{id:"service-id",name:"Лечение кариеса"},
};

test("normalizes a Kazakhstan phone for wa.me",()=>{
  assert.equal(normalizeWhatsAppPhone("+7 708 235 94 67"),"77082359467");
  assert.match(createWhatsAppUrl(appointment),/^https:\/\/wa\.me\/77082359467\?text=/);
});

test("builds the confirmed appointment reminder",()=>{
  const message=buildWhatsAppMessage(appointment);
  assert.match(message,/Напоминаем, что вы записаны/);
  assert.match(message,/Дата: 19 августа 2026 г\./);
  assert.match(message,/Время: 15:00/);
  assert.match(message,/Специалист: Данияр/);
  assert.match(message,/Услуга: Лечение кариеса/);
});

test("builds the new request message",()=>{
  const message=buildWhatsAppMessage({...appointment,status:"new"});
  assert.match(message,/Вы оставили заявку на запись/);
  assert.match(message,/Мы свяжемся с вами для подтверждения записи/);
});

test("rejects an invalid WhatsApp phone",()=>{
  assert.equal(normalizeWhatsAppPhone("+7 708 23"),null);
  assert.equal(createWhatsAppUrl({...appointment,patientPhone:"invalid"}),null);
});

test("builds a doctor notification with appointment details",()=>{
  const message=buildDoctorWhatsAppMessage(appointment,"https://dream-smile.example/");
  assert.match(message,/Здравствуйте, Данияр!/);
  assert.match(message,/Пациент: Алишер/);
  assert.match(message,/Дата: 19 августа 2026 г\./);
  assert.match(message,/Время: 15:00/);
  assert.match(message,/Услуга: Лечение кариеса/);
  assert.match(message,/https:\/\/dream-smile\.example\/doctor/);
  assert.match(buildDoctorWhatsAppUrl(appointment,"https://dream-smile.example"),/^https:\/\/wa\.me\/77011234567\?text=/);
});

test("does not build a doctor URL without a valid phone",()=>{
  assert.equal(buildDoctorWhatsAppUrl({...appointment,doctor:{...appointment.doctor,phone:null}},"https://dream-smile.example"),null);
});
