import { getAvailableSlots } from "@/lib/supabase/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type Payload={serviceId?:string;doctorId?:string;date?:string;time?:string;patientName?:string;phone?:string;comment?:string};
export async function POST(request:Request){
  const supabase=createSupabaseServerClient();
  if(!supabase) return Response.json({error:"Система записи пока не подключена.",code:"not_configured"},{status:503});
  const body=await request.json() as Payload;
  if(!body.serviceId||!body.doctorId||!body.date||!body.time||!body.patientName?.trim()||!body.phone?.trim()) return Response.json({error:"Заполните обязательные поля."},{status:400});
  const slots=await getAvailableSlots(supabase,body.serviceId,body.doctorId,body.date);
  if(!slots.some(slot=>slot.time===body.time&&slot.doctorId===body.doctorId)) return Response.json({error:"Это время уже занято. Выберите другое.",code:"slot_taken"},{status:409});
  const {error}=await supabase.from("appointments").insert({patient_name:body.patientName.trim(),patient_phone:body.phone.trim(),comment:body.comment?.trim()||null,service_id:body.serviceId,doctor_id:body.doctorId,appointment_date:body.date,appointment_time:body.time,status:"new"});
  if(error?.code==="23505") return Response.json({error:"Это время уже занято. Выберите другое.",code:"slot_taken"},{status:409});
  if(error) return Response.json({error:"Не удалось создать заявку. Попробуйте позже."},{status:500});
  return Response.json({message:"Заявка на запись создана. Клиника подтвердит время."},{status:201});
}
