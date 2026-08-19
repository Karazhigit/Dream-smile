import { getAvailableSlots } from "@/lib/supabase/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { normalizeKazakhstanPhone } from "@/lib/phone";
import { checkPublicWriteRateLimit,isIsoDate,isOptionalText,isTime,isTrimmedText,isUuid,requestBodySizeError,safeServerError } from "@/lib/api-security";

type Payload={serviceId?:string;doctorId?:string;date?:string;time?:string;patientName?:string;phone?:string;comment?:string};
export async function POST(request:Request){
  const sizeError=requestBodySizeError(request);if(sizeError)return sizeError;
  const limited=checkPublicWriteRateLimit(request);if(limited)return limited;
  const supabase=createSupabaseServerClient();
  if(!supabase) return Response.json({error:"Система записи пока не подключена.",code:"not_configured"},{status:503});
  let body:Payload;try{body=await request.json()}catch{return Response.json({error:"Проверьте данные записи."},{status:400})}
  const phone=body.phone?normalizeKazakhstanPhone(body.phone):null;
  if(!isUuid(body.serviceId)||!isUuid(body.doctorId)||!isIsoDate(body.date)||!isTime(body.time)||!isTrimmedText(body.patientName,1,120)||!isOptionalText(body.comment,1000)||!phone) return Response.json({error:"Проверьте имя и номер телефона."},{status:400});
  let slots;try{slots=await getAvailableSlots(supabase,body.serviceId,body.doctorId,body.date)}catch(error){safeServerError("api/appointments availability",error);return Response.json({error:"Не удалось проверить время. Попробуйте позже."},{status:500})}
  if(!slots.some(slot=>slot.available&&slot.time===body.time&&slot.doctorId===body.doctorId)) return Response.json({error:"Это время только что заняли. Выберите другое.",code:"slot_taken"},{status:409});
  const writeClient=createSupabaseAdminClient();if(!writeClient)return Response.json({error:"Система записи временно недоступна.",code:"not_configured"},{status:503});
  const{error}=await writeClient.rpc("create_public_appointment",{p_service_id:body.serviceId,p_doctor_id:body.doctorId,p_date:body.date,p_time:body.time,p_patient_name:body.patientName.trim(),p_patient_phone:phone,p_comment:body.comment?.trim()||null});
  if(error?.code==="23505") return Response.json({error:"Это время только что заняли. Выберите другое.",code:"slot_taken"},{status:409});
  if(error){safeServerError("api/appointments insert",error);return Response.json({error:"Не удалось создать заявку. Попробуйте позже."},{status:500})}
  return Response.json({message:"Заявка на запись создана. Клиника подтвердит время."},{status:201});
}
