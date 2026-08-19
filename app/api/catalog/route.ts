import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(){
  const supabase=createSupabaseServerClient();
  if(!supabase) return Response.json({error:"Система записи пока не подключена.",code:"not_configured"},{status:503});
  const [{data:services,error:servicesError},{data:doctors,error:doctorsError}]=await Promise.all([
    supabase.from("services").select("id,name,duration_minutes,active,created_at").eq("active",true).order("name"),
    supabase.from("doctors").select("id,name,specialty,active,created_at").eq("active",true).order("specialty"),
  ]);
  if(servicesError||doctorsError){console.error("[api/catalog] Supabase query failed",{servicesError,doctorsError});return Response.json({error:"Не удалось загрузить данные для записи."},{status:500})}
  return Response.json({services:(services??[]).map(item=>({id:item.id,name:item.name,durationMinutes:item.duration_minutes,active:item.active,createdAt:item.created_at})),doctors:(doctors??[]).map(item=>({id:item.id,name:item.name,specialty:item.specialty,active:item.active,createdAt:item.created_at}))});
}
