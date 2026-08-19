import { requireDoctorApi } from "@/lib/supabase/doctor-auth";
import { clinicToday, clinicTomorrow } from "@/lib/clinic-date";
import type { AppointmentStatus } from "@/types/database";

const relationSelect="*,service:services!appointments_service_id_fkey(id,name)";

export async function GET(request:Request){
  const auth=await requireDoctorApi();if("response" in auth)return auth.response;const{supabase,doctor}=auth;
  const params=new URL(request.url).searchParams;const requestedDoctorId=params.get("doctorId");if(requestedDoctorId&&requestedDoctorId!==doctor.id)return Response.json({error:"Нет доступа к записям другого врача."},{status:403});const filter=params.get("filter")??"today";if(!["today","tomorrow","upcoming"].includes(filter))return Response.json({error:"Некорректный фильтр."},{status:400});
  let query=supabase.from("appointments").select(relationSelect).eq("doctor_id",doctor.id).order("appointment_date").order("appointment_time");
  if(filter==="today")query=query.eq("appointment_date",clinicToday());else if(filter==="tomorrow")query=query.eq("appointment_date",clinicTomorrow());else query=query.gte("appointment_date",clinicToday());
  const{data,error}=await query;if(error){console.error("[api/doctor/appointments GET] Query failed",{code:error.code,message:error.message});return Response.json({error:"Не удалось загрузить записи."},{status:500})}
  type Joined={id:string;patient_name:string;patient_phone:string;comment:string|null;service_id:string;doctor_id:string;appointment_date:string;appointment_time:string;status:AppointmentStatus;created_at:string;service:{id:string;name:string}|null};
  const appointments=((data??[]) as unknown as Joined[]).map(item=>({id:item.id,patientName:item.patient_name,patientPhone:item.patient_phone,comment:item.comment,serviceId:item.service_id,doctorId:item.doctor_id,appointmentDate:item.appointment_date,appointmentTime:item.appointment_time.slice(0,5),status:item.status,createdAt:item.created_at,service:item.service,doctor}));
  return Response.json({appointments},{headers:{"Cache-Control":"no-store, max-age=0"}});
}

export async function PATCH(request:Request){
  const auth=await requireDoctorApi();if("response" in auth)return auth.response;let body:{id?:string;status?:string};try{body=await request.json()}catch{return Response.json({error:"Проверьте данные записи."},{status:400})}if(!body.id||body.status!=="completed")return Response.json({error:"Разрешено только завершение подтверждённой записи."},{status:400});
  const{data,error}=await auth.supabase.rpc("complete_doctor_appointment",{p_appointment_id:body.id});
  if(error?.code==="42501"||error?.message?.includes("doctor_appointment_forbidden")){return Response.json({error:"Нет доступа к этой записи."},{status:403})}
  if(error?.message?.includes("invalid_status_transition"))return Response.json({error:"Завершить можно только подтверждённую запись."},{status:409});
  if(error){console.error("[api/doctor/appointments PATCH] Completion failed",{code:error.code,message:error.message,details:error.details});return Response.json({error:"Не удалось завершить запись."},{status:500})}
  return Response.json({ok:true,id:data,status:"completed"});
}
