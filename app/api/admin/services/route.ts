import { requireAdminApi } from "@/lib/supabase/admin-auth";

function failed(operation:string,error:unknown,message:string){console.error(`[api/admin/services ${operation}] Supabase query failed`,error);return Response.json({error:message},{status:500})}

export async function GET(){
  const auth=await requireAdminApi();if("response" in auth)return auth.response;const{supabase}=auth;
  const{data,error}=await supabase.from("services").select("*").order("created_at");if(error)return failed("GET",error,"Не удалось загрузить услуги.");
  return Response.json({services:(data??[]).map(item=>({id:item.id,name:item.name,durationMinutes:item.duration_minutes,active:item.active,createdAt:item.created_at}))});
}

export async function POST(request:Request){
  const auth=await requireAdminApi();if("response" in auth)return auth.response;const{supabase}=auth;
  const body=await request.json() as {name?:string;durationMinutes?:number|null};if(!body.name?.trim())return Response.json({error:"Введите название."},{status:400});
  const{error}=await supabase.from("services").insert({name:body.name.trim(),duration_minutes:body.durationMinutes&&body.durationMinutes>0?body.durationMinutes:null});if(error)return failed("POST",error,"Не удалось добавить услугу.");
  return Response.json({ok:true},{status:201});
}

export async function PATCH(request:Request){
  const auth=await requireAdminApi();if("response" in auth)return auth.response;const{supabase}=auth;
  const body=await request.json() as {id?:string;name?:string;durationMinutes?:number|null;active?:boolean};if(!body.id)return Response.json({error:"Некорректные данные."},{status:400});
  const update:{name?:string;duration_minutes?:number|null;active?:boolean}={};if(body.name!==undefined){if(!body.name.trim())return Response.json({error:"Название не может быть пустым."},{status:400});update.name=body.name.trim()}if(body.durationMinutes!==undefined)update.duration_minutes=body.durationMinutes&&body.durationMinutes>0?body.durationMinutes:null;if(body.active!==undefined)update.active=body.active;
  const{error}=await supabase.from("services").update(update).eq("id",body.id);if(error)return failed("PATCH",error,"Не удалось сохранить услугу.");
  return Response.json({ok:true});
}
