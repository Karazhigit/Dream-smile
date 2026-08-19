import { requireAdminApi } from "@/lib/supabase/admin-auth";
import { archiveCutoffDate } from "@/lib/clinic-date";
import type { AppointmentStatus } from "@/types/database";
import { safeServerError } from "@/lib/api-security";

const relationSelect="*,service:services!appointments_service_id_fkey(id,name),doctor:doctors!appointments_doctor_id_fkey(id,name,specialty)";

export async function GET(request:Request){
  const auth=await requireAdminApi();if("response" in auth)return auth.response;const{supabase}=auth;
  const params=new URL(request.url).searchParams;const status=params.get("status")??"all";const search=(params.get("search")??"").trim().slice(0,100);const page=Math.max(1,Number.parseInt(params.get("page")??"1",10)||1);const limit=Math.min(50,Math.max(1,Number.parseInt(params.get("limit")??"50",10)||50));
  if(!["all","completed","cancelled"].includes(status))return Response.json({error:"Некорректный статус."},{status:400});
  if(search&&!/^[\p{L}\p{N}\s+()-]+$/u.test(search))return Response.json({error:"Некорректный поиск."},{status:400});
  const requestedStatuses:AppointmentStatus[]=status==="all"?["completed","cancelled"]:[status as AppointmentStatus];
  let query=supabase.from("appointments").select(relationSelect,{count:"exact"}).in("status",requestedStatuses).lt("appointment_date",archiveCutoffDate()).order("appointment_date",{ascending:false}).order("appointment_time",{ascending:false});
  if(search){const escaped=search.replace(/["\\]/g,"\\$&");query=query.or(`patient_name.ilike."*${escaped}*",patient_phone.ilike."*${escaped}*"`)}
  const from=(page-1)*limit;const{data,error,count}=await query.range(from,from+limit-1);if(error){safeServerError("api/admin/archive GET",error);return Response.json({error:"Не удалось загрузить архив."},{status:500})}
  type JoinedAppointment={id:string;patient_name:string;patient_phone:string;comment:string|null;service_id:string;doctor_id:string;appointment_date:string;appointment_time:string;status:AppointmentStatus;created_at:string;service:{id:string;name:string}|null;doctor:{id:string;name:string|null;specialty:string}|null};
  const total=count??0;const appointments=((data??[]) as unknown as JoinedAppointment[]).map(item=>({id:item.id,patientName:item.patient_name,patientPhone:item.patient_phone,comment:item.comment,serviceId:item.service_id,doctorId:item.doctor_id,appointmentDate:item.appointment_date,appointmentTime:item.appointment_time.slice(0,5),status:item.status,createdAt:item.created_at,service:item.service,doctor:item.doctor}));
  return Response.json({appointments,page,limit,total,totalPages:Math.max(1,Math.ceil(total/limit))},{headers:{"Cache-Control":"private, no-store"}});
}
