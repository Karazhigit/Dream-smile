import { getAvailableSlots } from "@/lib/supabase/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request:Request){
  const supabase=createSupabaseServerClient();
  if(!supabase) return Response.json({error:"Система записи пока не подключена.",code:"not_configured"},{status:503});
  const {searchParams}=new URL(request.url);const serviceId=searchParams.get("serviceId");const doctorId=searchParams.get("doctorId")||undefined;const date=searchParams.get("date");
  if(!serviceId||!date||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(date)) return Response.json({error:"Некорректные параметры."},{status:400});
  const today=new Date();today.setHours(0,0,0,0);if(new Date(`${date}T00:00:00`)<today) return Response.json({slots:[]});
  const slots=await getAvailableSlots(supabase,serviceId,doctorId,date);
  return Response.json({slots});
}
