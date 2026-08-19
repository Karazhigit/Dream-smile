"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { AppointmentNotificationStatus } from "@/components/admin/appointment-notification-status";
import { LoadingSpinner } from "@/components/loading-spinner";
import { clinicDate } from "@/lib/clinic-date";
import { formatKazakhstanPhone, normalizeKazakhstanPhone } from "@/lib/phone";
import type { Appointment, BookingSlot, Doctor, Service } from "@/types";

type AvailabilityResponse={availableDates:string[];slotsByDate:Record<string,BookingSlot[]>};

export function AppointmentEditorModal({appointment,onClose,onSaved}:{appointment?:Appointment|null;onClose:()=>void;onSaved:(message:string)=>void}){
  const rescheduling=Boolean(appointment);
  const[services,setServices]=useState<Service[]>([]),[doctors,setDoctors]=useState<Doctor[]>([]);
  const[serviceId,setServiceId]=useState(appointment?.serviceId??""),[doctorId,setDoctorId]=useState(appointment?.doctorId??"");
  const[date,setDate]=useState(appointment?.appointmentDate??""),[time,setTime]=useState(appointment?.appointmentTime??"");
  const[phone,setPhone]=useState(appointment?formatKazakhstanPhone(appointment.patientPhone):"+7");
  const[availability,setAvailability]=useState<AvailabilityResponse>({availableDates:[],slotsByDate:{}});
  const[availabilityReloadKey,setAvailabilityReloadKey]=useState(0),[catalogLoading,setCatalogLoading]=useState(true),[slotsLoading,setSlotsLoading]=useState(false),[saving,setSaving]=useState(false),[error,setError]=useState("");

  useEffect(()=>{const previous=document.body.style.overflow;document.body.style.overflow="hidden";const close=(event:KeyboardEvent)=>{if(event.key==="Escape")onClose()};window.addEventListener("keydown",close);return()=>{document.body.style.overflow=previous;window.removeEventListener("keydown",close)}},[onClose]);
  useEffect(()=>{let active=true;fetch("/api/catalog",{cache:"no-store"}).then(async response=>{const body=await response.json();if(!response.ok)throw new Error(body.error);if(active){setServices(body.services);setDoctors(body.doctors)}}).catch(()=>{if(active)setError("Не удалось загрузить услуги и специалистов.")}).finally(()=>{if(active)setCatalogLoading(false)});return()=>{active=false}},[]);
  useEffect(()=>{
    if(!serviceId||!doctorId){queueMicrotask(()=>setAvailability({availableDates:[],slotsByDate:{}}));return}
    const controller=new AbortController();queueMicrotask(()=>{setSlotsLoading(true);setError("")});
    const params=new URLSearchParams({serviceId,doctorId,from:clinicDate(),to:clinicDate(29)});if(appointment)params.set("excludeAppointmentId",appointment.id);
    fetch(`/api/availability?${params}`,{cache:"no-store",signal:controller.signal}).then(async response=>{const body=await response.json() as AvailabilityResponse&{error?:string};if(!response.ok)throw new Error(body.error);setAvailability(body);setDate(current=>body.availableDates.includes(current)?current:"");setTime("")}).catch(reason=>{if(!(reason instanceof DOMException&&reason.name==="AbortError"))setError("Не удалось загрузить свободное время.")}).finally(()=>{if(!controller.signal.aborted)setSlotsLoading(false)});
    return()=>controller.abort();
  },[appointment,availabilityReloadKey,doctorId,serviceId]);
  const slots=useMemo(()=>(availability.slotsByDate[date]??[]).filter(slot=>slot.available&&slot.doctorId===doctorId),[availability,date,doctorId]);

  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();if(saving)return;setError("");const form=new FormData(event.currentTarget);const normalizedPhone=normalizeKazakhstanPhone(phone);
    if(!serviceId||!doctorId||!date||!time||(!rescheduling&&!String(form.get("patientName")||"").trim())||(!rescheduling&&!normalizedPhone)){setError("Проверьте данные записи.");return}
    setSaving(true);
    try{
      const payload=rescheduling?{id:appointment!.id,action:"reschedule",doctorId,date,time}:{serviceId,doctorId,date,time,patientName:String(form.get("patientName")||"").trim(),phone:normalizedPhone,comment:String(form.get("comment")||"").trim()};
      const response=await fetch("/api/admin/appointments",{method:rescheduling?"PATCH":"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});const body=await response.json().catch(()=>({}));
      if(!response.ok){if(response.status===409){setTime("");setAvailabilityReloadKey(value=>value+1);throw new Error("Это время уже занято. Выберите другое.")}if(response.status===400)throw new Error("Проверьте данные записи.");if(response.status===401)throw new Error("Сессия истекла. Войдите снова.");throw new Error(rescheduling?"Не удалось перенести запись. Попробуйте ещё раз.":"Не удалось создать запись. Попробуйте ещё раз.")}
      onSaved(body.message||(rescheduling?"Запись перенесена":"Запись создана"));
    }catch(reason){setError(reason instanceof Error?reason.message:"Не удалось сохранить запись. Попробуйте ещё раз.")}finally{setSaving(false)}
  }

  return <div className="fixed inset-0 z-[100] grid place-items-center overflow-y-auto bg-primary-dark/35 p-3 backdrop-blur-[2px] sm:p-6" onMouseDown={event=>{if(event.target===event.currentTarget)onClose()}}>
    <div role="dialog" aria-modal="true" aria-labelledby="appointment-dialog-title" className="motion-page-enter my-auto w-full max-w-2xl rounded-[24px] border border-line bg-white p-5 shadow-[0_24px_70px_rgba(15,78,85,.22)] sm:p-7">
      <div className="flex items-start justify-between gap-4"><div><h2 id="appointment-dialog-title" className="font-serif text-3xl">{rescheduling?"Перенос записи":"Новая запись"}</h2>{appointment&&<p className="mt-2 text-sm text-muted">{appointment.patientName} · {appointment.appointmentDate} · {appointment.appointmentTime}</p>}</div><button type="button" aria-label="Закрыть" onClick={onClose} className="focus-ring grid h-10 w-10 shrink-0 place-items-center rounded-full border border-line text-xl text-muted hover:border-primary hover:text-primary">×</button></div>
      {appointment&&<AppointmentNotificationStatus appointmentId={appointment.id}/>}
      {error&&<p role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">{error}</p>}
      <form onSubmit={submit} aria-busy={saving} className="mt-6 grid gap-4 sm:grid-cols-2">
        {!rescheduling&&<><Field label="Имя пациента *"><input name="patientName" required className="time-input" placeholder="Имя пациента"/></Field><Field label="Телефон *"><input name="phone" required inputMode="tel" autoComplete="tel" value={phone} onChange={event=>setPhone(formatKazakhstanPhone(event.target.value))} className="time-input" placeholder="+7 700 123 45 67"/></Field></>}
        <Field label="Услуга *"><select value={serviceId} disabled={catalogLoading||rescheduling} onChange={event=>{setServiceId(event.target.value);setDate("");setTime("")}} className="time-input"><option value="">Выберите услугу</option>{services.map(service=><option key={service.id} value={service.id}>{service.name}</option>)}</select></Field>
        <Field label="Специалист *"><select value={doctorId} disabled={catalogLoading} onChange={event=>{setDoctorId(event.target.value);setDate("");setTime("")}} className="time-input"><option value="">Выберите специалиста</option>{doctors.map(doctor=><option key={doctor.id} value={doctor.id}>{doctor.name||doctor.specialty} — {doctor.specialty}</option>)}</select></Field>
        <Field label="Дата *"><select value={date} disabled={!serviceId||!doctorId||slotsLoading} onChange={event=>{setDate(event.target.value);setTime("")}} className="time-input"><option value="">{slotsLoading?"Загружаем даты…":"Выберите дату"}</option>{availability.availableDates.map(value=><option key={value} value={value}>{new Date(`${value}T12:00:00`).toLocaleDateString("ru-RU",{day:"numeric",month:"long",year:"numeric"})}</option>)}</select></Field>
        <Field label="Время *"><select value={time} disabled={!date||slotsLoading} onChange={event=>setTime(event.target.value)} className="time-input"><option value="">Выберите время</option>{slots.map(slot=><option key={`${slot.doctorId}-${slot.time}`} value={slot.time}>{slot.time}</option>)}</select></Field>
        {!rescheduling&&<Field label="Комментарий"><textarea name="comment" rows={3} className="w-full resize-none rounded-xl border border-line px-3 py-3 text-sm outline-none focus:border-primary" placeholder="Необязательно"/></Field>}
        <div className="mt-2 flex flex-col-reverse gap-3 sm:col-span-2 sm:flex-row sm:justify-end"><button type="button" disabled={saving} onClick={onClose} className="btn-secondary focus-ring !min-h-11">Отмена</button><button type="submit" disabled={saving||slotsLoading||!time} aria-busy={saving} className="btn-primary focus-ring !min-h-11 min-w-[150px] disabled:cursor-wait disabled:opacity-50">{saving&&<LoadingSpinner/>}{saving?"Сохраняем…":rescheduling?"Перенести":"Создать запись"}</button></div>
      </form>
    </div>
  </div>;
}

function Field({label,children}:{label:string;children:React.ReactNode}){return <label className="min-w-0"><span className="mb-2 block text-xs font-bold">{label}</span>{children}</label>}
