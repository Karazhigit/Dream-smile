import { getAvailableSlots } from "@/lib/supabase/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { normalizeKazakhstanPhone } from "@/lib/phone";

type Payload={serviceId?:string;doctorId?:string;date?:string;time?:string;patientName?:string;phone?:string;comment?:string};
export async function POST(request:Request){
  const supabase=createSupabaseServerClient();
  if(!supabase) return Response.json({error:"Система записи пока не подключена.",code:"not_configured"},{status:503});
  const body=await request.json() as Payload;
  const phone=body.phone?normalizeKazakhstanPhone(body.phone):null;
  if(!body.serviceId||!body.doctorId||!body.date||!body.time||!body.patientName?.trim()||!phone) return Response.json({error:"Проверьте имя и номер телефона."},{status:400});
  const slots=await getAvailableSlots(supabase,body.serviceId,body.doctorId,body.date);
  if(!slots.some(slot=>slot.available&&slot.time===body.time&&slot.doctorId===body.doctorId)) return Response.json({error:"Это время только что заняли. Выберите другое.",code:"slot_taken"},{status:409});
  let{error}=await supabase.rpc("create_public_appointment",{p_service_id:body.serviceId,p_doctor_id:body.doctorId,p_date:body.date,p_time:body.time,p_patient_name:body.patientName.trim(),p_patient_phone:phone,p_comment:body.comment?.trim()||null});
  if(error?.code==="PGRST202")({error}=await supabase.from("appointments").insert({patient_name:body.patientName.trim(),patient_phone:phone,comment:body.comment?.trim()||null,service_id:body.serviceId,doctor_id:body.doctorId,appointment_date:body.date,appointment_time:body.time,status:"new"}));
  if(error?.code==="23505") return Response.json({error:"Это время только что заняли. Выберите другое.",code:"slot_taken"},{status:409});
  if(error){console.error("[api/appointments POST] Supabase insert failed",error);return Response.json({error:"Не удалось создать заявку. Попробуйте позже."},{status:500})}
  return Response.json({message:"Заявка на запись создана. Клиника подтвердит время."},{status:201});
}
