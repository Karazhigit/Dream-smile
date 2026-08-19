import { requireAdminApi } from "@/lib/supabase/admin-auth";
import { archiveCutoffDate } from "@/lib/clinic-date";
import type { AppointmentStatus } from "@/types/database";
import { getAvailableSlots } from "@/lib/supabase/queries";
import { normalizeKazakhstanPhone } from "@/lib/phone";
import { measureServerDuration } from "@/lib/server-duration";
import { isIsoDate,isOptionalText,isTime,isTrimmedText,isUuid,mutationOriginError,safeServerError } from "@/lib/api-security";

const statuses:AppointmentStatus[]=["new","confirmed","completed","cancelled"];
const slotErrorMessages=["slot_taken","slot_in_past","slot_unavailable","slot_outside_hours","slot_overlaps_break","day_off","inactive_catalog_item"];

function slotError(error:{code?:string;message?:string}|null){return error?.code==="23505"||slotErrorMessages.some(message=>error?.message?.includes(message))}
function logDatabaseError(operation:string,error:{code?:string;message?:string;details?:string;hint?:string}){
  safeServerError(`api/admin/appointments ${operation}`,error);
}
async function requireAppointmentAdmin(){
  const auth=await requireAdminApi();
  if("response" in auth){
    const response=auth.response??Response.json({error:"Не удалось проверить сессию."},{status:500});
    return{response:response.status===401?Response.json({error:"Сессия истекла. Войдите снова."},{status:401}):response} as const;
  }
  return auth;
}
export async function GET(request:Request){
  const startedAt=Date.now();
  const auth=await requireAdminApi();if("response" in auth)return auth.response;const{supabase}=auth;
  const searchParams=new URL(request.url).searchParams;const date=searchParams.get("date");const status=searchParams.get("status") as AppointmentStatus|null;
  if(date&&!isIsoDate(date))return Response.json({error:"Некорректная дата."},{status:400});
  if(status&&!statuses.includes(status))return Response.json({error:"Некорректный статус."},{status:400});
  let query=supabase.from("appointments").select("*,service:services!appointments_service_id_fkey(id,name),doctor:doctors!appointments_doctor_id_fkey(id,name,specialty,phone)").or(`status.in.(new,confirmed),appointment_date.gte.${archiveCutoffDate()}`).order("appointment_date").order("appointment_time");if(date)query=query.eq("appointment_date",date);if(status)query=query.eq("status",status);
  const {data,error}=await query;if(error){safeServerError("api/admin/appointments GET",error);return Response.json({error:"Не удалось загрузить записи."},{status:500})}
  type JoinedAppointment={id:string;patient_name:string;patient_phone:string;comment:string|null;service_id:string;doctor_id:string;appointment_date:string;appointment_time:string;status:AppointmentStatus;created_at:string;service:{id:string;name:string}|null;doctor:{id:string;name:string|null;specialty:string;phone:string|null}|null};
  const durationMs=measureServerDuration("api.admin.appointments",startedAt);return Response.json({appointments:((data??[]) as unknown as JoinedAppointment[]).map(item=>({id:item.id,patientName:item.patient_name,patientPhone:item.patient_phone,comment:item.comment,serviceId:item.service_id,doctorId:item.doctor_id,appointmentDate:item.appointment_date,appointmentTime:item.appointment_time.slice(0,5),status:item.status,createdAt:item.created_at,service:item.service,doctor:item.doctor}))},{headers:{"Cache-Control":"no-store, max-age=0","Server-Timing":`appointments;dur=${durationMs}`}});
}

export async function POST(request:Request){
  const originError=mutationOriginError(request);if(originError)return originError;
  const auth=await requireAppointmentAdmin();if("response" in auth)return auth.response;const{supabase}=auth;
  let body:{serviceId?:string;doctorId?:string;date?:string;time?:string;patientName?:string;phone?:string;comment?:string};
  try{body=await request.json()}catch{return Response.json({error:"Проверьте данные записи."},{status:400})}
  const phone=body.phone?normalizeKazakhstanPhone(body.phone):null;
  if(!isUuid(body.serviceId)||!isUuid(body.doctorId)||!isIsoDate(body.date)||!isTime(body.time)||!isTrimmedText(body.patientName,1,120)||!isOptionalText(body.comment,1000)||!phone)return Response.json({error:"Проверьте данные записи."},{status:400});
  let slots;
  try{slots=await getAvailableSlots(supabase,body.serviceId,body.doctorId,body.date)}catch(error){safeServerError("api/admin/appointments availability",error);return Response.json({error:"Не удалось создать запись. Попробуйте ещё раз."},{status:500})}
  if(!slots.some(slot=>slot.available&&slot.doctorId===body.doctorId&&slot.time===body.time))return Response.json({error:"Это время уже занято. Выберите другое.",code:"slot_taken"},{status:409});
  const{data,error}=await supabase.rpc("create_admin_appointment",{p_service_id:body.serviceId,p_doctor_id:body.doctorId,p_date:body.date,p_time:body.time,p_patient_name:body.patientName.trim(),p_patient_phone:phone,p_comment:body.comment?.trim()||null});
  if(slotError(error))return Response.json({error:"Это время уже занято. Выберите другое.",code:"slot_taken"},{status:409});
  if(error){logDatabaseError("POST create_admin_appointment",error);return Response.json({error:"Не удалось создать запись. Попробуйте ещё раз."},{status:500})}
  return Response.json({ok:true,id:data,message:"Запись создана"},{status:201});
}

export async function PATCH(request:Request){
  const originError=mutationOriginError(request);if(originError)return originError;
  const auth=await requireAppointmentAdmin();if("response" in auth)return auth.response;const{supabase}=auth;
  let body:{id?:string;status?:AppointmentStatus;action?:"reschedule";doctorId?:string;date?:string;time?:string};try{body=await request.json()}catch{return Response.json({error:"Некорректные данные."},{status:400})}
  if(body.action==="reschedule"){
    if(!isUuid(body.id)||!isUuid(body.doctorId)||!isIsoDate(body.date)||!isTime(body.time))return Response.json({error:"Некорректные данные переноса."},{status:400});
    const{data:current,error:currentError}=await supabase.from("appointments").select("service_id,status").eq("id",body.id).maybeSingle();if(currentError||!current)return Response.json({error:"Запись не найдена."},{status:404});if(current.status!=="new"&&current.status!=="confirmed")return Response.json({error:"Эту запись уже нельзя перенести."},{status:409});
    let slots;
    try{slots=await getAvailableSlots(supabase,current.service_id,body.doctorId,body.date,body.id)}catch(error){safeServerError("api/admin/appointments reschedule availability",error);return Response.json({error:"Не удалось перенести запись. Попробуйте ещё раз."},{status:500})}
    if(!slots.some(slot=>slot.available&&slot.doctorId===body.doctorId&&slot.time===body.time))return Response.json({error:"Это время уже занято. Выберите другое.",code:"slot_taken"},{status:409});
    const{data,error}=await supabase.rpc("reschedule_admin_appointment",{p_appointment_id:body.id,p_doctor_id:body.doctorId,p_date:body.date,p_time:body.time});if(slotError(error))return Response.json({error:"Это время уже занято. Выберите другое.",code:"slot_taken"},{status:409});if(error){logDatabaseError("PATCH reschedule_admin_appointment",error);return Response.json({error:"Не удалось перенести запись. Попробуйте ещё раз."},{status:500})}
    return Response.json({ok:true,id:data,message:"Запись перенесена"});
  }
  const allowedFrom:Partial<Record<AppointmentStatus,AppointmentStatus[]>>={confirmed:["new"],completed:["confirmed"],cancelled:["new","confirmed"]};
  if(!isUuid(body.id)||!body.status||!allowedFrom[body.status])return Response.json({error:"Некорректные данные."},{status:400});
  let query=supabase.from("appointments").update({status:body.status}).eq("id",body.id);const previousStatuses=allowedFrom[body.status]!;
  query=previousStatuses.length===1?query.eq("status",previousStatuses[0]):query.in("status",previousStatuses);
  const {data,error}=await query.select("id,status").maybeSingle();if(error){safeServerError("api/admin/appointments PATCH",error);return Response.json({error:"Не удалось изменить статус."},{status:500})}
  if(!data)return Response.json({error:"Статус записи уже изменился. Обновите список.",code:"invalid_transition"},{status:409});
  return Response.json({ok:true,appointment:data});
}
