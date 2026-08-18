import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AppointmentStatus } from "@/types/database";

const statuses:AppointmentStatus[]=["new","confirmed","completed","cancelled"];
export async function GET(request:Request){
  const supabase=createSupabaseServerClient();if(!supabase)return Response.json({error:"Supabase не подключён.",code:"not_configured"},{status:503});
  const date=new URL(request.url).searchParams.get("date");
  let query=supabase.from("appointments").select("*").order("appointment_date").order("appointment_time");if(date)query=query.eq("appointment_date",date);
  const {data,error}=await query;if(error)return Response.json({error:"Не удалось загрузить записи."},{status:500});
  const serviceIds=[...new Set((data??[]).map(item=>item.service_id))];const doctorIds=[...new Set((data??[]).map(item=>item.doctor_id))];
  const [{data:services},{data:doctors}]=await Promise.all([
    serviceIds.length?supabase.from("services").select("id,name").in("id",serviceIds):Promise.resolve({data:[]}),
    doctorIds.length?supabase.from("doctors").select("id,name,specialty").in("id",doctorIds):Promise.resolve({data:[]}),
  ]);
  const serviceMap=new Map((services??[]).map(item=>[item.id,item]));const doctorMap=new Map((doctors??[]).map(item=>[item.id,item]));
  return Response.json({appointments:(data??[]).map(item=>({id:item.id,patientName:item.patient_name,patientPhone:item.patient_phone,comment:item.comment,serviceId:item.service_id,doctorId:item.doctor_id,appointmentDate:item.appointment_date,appointmentTime:item.appointment_time.slice(0,5),status:item.status,createdAt:item.created_at,service:serviceMap.get(item.service_id)??null,doctor:doctorMap.get(item.doctor_id)??null}))});
}

export async function PATCH(request:Request){
  const supabase=createSupabaseServerClient();if(!supabase)return Response.json({error:"Supabase не подключён.",code:"not_configured"},{status:503});
  const body=await request.json() as {id?:string;status?:AppointmentStatus};if(!body.id||!body.status||!statuses.includes(body.status))return Response.json({error:"Некорректные данные."},{status:400});
  const {error}=await supabase.from("appointments").update({status:body.status}).eq("id",body.id);if(error)return Response.json({error:"Не удалось изменить статус."},{status:500});
  return Response.json({ok:true});
}
