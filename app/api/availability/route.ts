import { getAvailabilityRange, getAvailableSlots } from "@/lib/supabase/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireAdminApi } from "@/lib/supabase/admin-auth";
import { measureServerDuration } from "@/lib/server-duration";
import { isIsoDate,isUuid,safeServerError } from "@/lib/api-security";

const noStoreHeaders={"Cache-Control":"no-store, max-age=0"};

export async function GET(request:Request){
  const startedAt=Date.now();
  try{
  let supabase=createSupabaseServerClient();
  if(!supabase) return Response.json({error:"Система записи пока не подключена.",code:"not_configured"},{status:503});
  const {searchParams}=new URL(request.url);const serviceId=searchParams.get("serviceId");const doctorId=searchParams.get("doctorId")||undefined;const date=searchParams.get("date");const from=searchParams.get("from");const to=searchParams.get("to");const excludeAppointmentId=searchParams.get("excludeAppointmentId")||undefined;
  if(excludeAppointmentId){if(!isUuid(excludeAppointmentId))return Response.json({error:"Некорректные параметры."},{status:400});const auth=await requireAdminApi();if("response" in auth)return auth.response;supabase=auth.supabase}
  if(!isUuid(serviceId)||doctorId!==undefined&&!isUuid(doctorId)) return Response.json({error:"Некорректные параметры."},{status:400});
  if(from&&to&&isIsoDate(from)&&isIsoDate(to)){
    const fromDate=new Date(`${from}T00:00:00Z`);const toDate=new Date(`${to}T00:00:00Z`);
    if(toDate<fromDate||toDate.getTime()-fromDate.getTime()>42*86400000) return Response.json({error:"Некорректный диапазон дат."},{status:400});
    const range=await getAvailabilityRange(supabase,serviceId,doctorId,from,to,excludeAppointmentId);
    const durationMs=measureServerDuration("api.availability.range",startedAt);return Response.json({availableDates:Object.entries(range).filter(([,slots])=>slots.some(slot=>slot.available)).map(([value])=>value),slotsByDate:range},{headers:{...noStoreHeaders,"Server-Timing":`availability;dur=${durationMs}`}});
  }
  if(!isIsoDate(date)) return Response.json({error:"Некорректные параметры."},{status:400});
  const today=new Date();today.setHours(0,0,0,0);if(new Date(`${date}T00:00:00`)<today) return Response.json({slots:[]},{headers:noStoreHeaders});
  const slots=await getAvailableSlots(supabase,serviceId,doctorId,date,excludeAppointmentId);
  const durationMs=measureServerDuration("api.availability.slots",startedAt);return Response.json({slots},{headers:{...noStoreHeaders,"Server-Timing":`availability;dur=${durationMs}`}});
  }catch(error){
    safeServerError("api/availability",error);
    return Response.json({error:"Не удалось загрузить свободное время."},{status:500,headers:noStoreHeaders});
  }
}
