"use client";

import { useEffect, useState } from "react";

type Job = { id:string; event_type:"booking_confirmed"|"appointment_reminder"; status:"pending"|"processing"|"sent"|"failed"; scheduled_for:string; sent_at:string|null };
const labels = { pending:"Запланировано", processing:"Отправляется", sent:"Отправлено", failed:"Ошибка" } as const;

export function AppointmentNotificationStatus({ appointmentId }:{ appointmentId:string }) {
  const [jobs,setJobs]=useState<Job[]>([]);
  const [configured,setConfigured]=useState(true);
  const [failed,setFailed]=useState(false);
  useEffect(()=>{
    const controller=new AbortController();
    fetch(`/api/admin/appointments/${appointmentId}/notifications`,{cache:"no-store",signal:controller.signal})
      .then(async response=>{if(!response.ok)throw new Error();return response.json()})
      .then(body=>{setConfigured(body.configured!==false);setJobs(body.notifications??[])})
      .catch(error=>{if(!(error instanceof DOMException&&error.name==="AbortError"))setFailed(true)});
    return()=>controller.abort();
  },[appointmentId]);
  if(!configured)return <p className="mt-4 text-xs text-muted">Уведомления появятся после установки SQL migration.</p>;
  if(failed)return <p className="mt-4 text-xs text-red-700">Не удалось загрузить статусы уведомлений.</p>;
  const confirmation=jobs.find(job=>job.event_type==="booking_confirmed");
  const reminder=jobs.find(job=>job.event_type==="appointment_reminder");
  return <div className="mt-5 grid gap-2 rounded-xl border border-line bg-background/60 p-4 text-xs sm:grid-cols-2">
    <Status title="Подтверждение" job={confirmation}/>
    <Status title="Напоминание за 1 час" job={reminder}/>
  </div>;
}

function Status({title,job}:{title:string;job?:Job}){return <div><p className="font-bold">{title}</p><p className="mt-1 text-muted">{job?labels[job.status]:"Не запланировано"}</p></div>}
