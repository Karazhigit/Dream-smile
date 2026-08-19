import type { Appointment } from "@/types";
import { normalizeKazakhstanPhone } from "./phone.ts";

type WhatsAppAppointment=Pick<Appointment,"patientName"|"patientPhone"|"appointmentDate"|"appointmentTime"|"status"|"doctor"|"service">;

export function normalizeWhatsAppPhone(value:string){
  const phone=normalizeKazakhstanPhone(value);
  return phone?phone.slice(1):null;
}

export function formatWhatsAppDate(value:string){
  return new Date(`${value}T12:00:00Z`).toLocaleDateString("ru-RU",{day:"numeric",month:"long",year:"numeric",timeZone:"Asia/Almaty"});
}

export function buildWhatsAppMessage(appointment:WhatsAppAppointment){
  const doctorName=appointment.doctor?.name||appointment.doctor?.specialty||"—";
  const serviceName=appointment.service?.name||"—";
  const details=`Дата: ${formatWhatsAppDate(appointment.appointmentDate)}\nВремя: ${appointment.appointmentTime}\nСпециалист: ${doctorName}\nУслуга: ${serviceName}`;

  if(appointment.status==="new")return `Здравствуйте, ${appointment.patientName}!\n\nВы оставили заявку на запись в стоматологию Dream Smile.\n\n${details}\n\nМы свяжемся с вами для подтверждения записи.\n\nС уважением,\nDream Smile`;

  return `Здравствуйте, ${appointment.patientName}!\n\nНапоминаем, что вы записаны в стоматологию Dream Smile.\n\n${details}\n\nЕсли ваши планы изменились, пожалуйста, сообщите нам заранее.\n\nС уважением,\nDream Smile`;
}

export function createWhatsAppUrl(appointment:WhatsAppAppointment){
  const phone=normalizeWhatsAppPhone(appointment.patientPhone);
  return phone?`https://wa.me/${phone}?text=${encodeURIComponent(buildWhatsAppMessage(appointment))}`:null;
}

type DoctorWhatsAppAppointment=Pick<Appointment,"patientName"|"appointmentDate"|"appointmentTime"|"doctor"|"service">;

export function buildDoctorWhatsAppMessage(appointment:DoctorWhatsAppAppointment,siteUrl:string){
  const doctorName=appointment.doctor?.name||appointment.doctor?.specialty||"специалист";
  return `Здравствуйте, ${doctorName}!\n\nУ вас новая запись в Dream Smile.\n\nПациент: ${appointment.patientName}\nДата: ${formatWhatsAppDate(appointment.appointmentDate)}\nВремя: ${appointment.appointmentTime}\nУслуга: ${appointment.service?.name||"—"}\n\nОткройте кабинет врача для подробностей.\n\nСсылка:\n${siteUrl.replace(/\/$/,"")}/doctor`;
}

export function buildDoctorWhatsAppUrl(appointment:DoctorWhatsAppAppointment,siteUrl:string){
  const phone=normalizeWhatsAppPhone(appointment.doctor?.phone??"");
  return phone?`https://wa.me/${phone}?text=${encodeURIComponent(buildDoctorWhatsAppMessage(appointment,siteUrl))}`:null;
}
