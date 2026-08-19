import { requireAdminApi } from "@/lib/supabase/admin-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { normalizeKazakhstanPhone } from "@/lib/phone";

function failed(operation:string,error:unknown,message:string){console.error(`[api/admin/doctors ${operation}] Supabase query failed`,error);return Response.json({error:message},{status:500})}

export async function GET(){
  const auth=await requireAdminApi();if("response" in auth)return auth.response;const{supabase}=auth;
  const{data,error}=await supabase.from("doctors").select("*").order("created_at");if(error)return failed("GET",error,"Не удалось загрузить специалистов.");
  const service=createSupabaseAdminClient();const accountMap=new Map<string,{userId:string;email:string;status:"active"|"disabled"}>();
  if(service){const{data:accounts,error:accountsError}=await service.from("doctor_accounts").select("doctor_id,user_id");if(accountsError&&accountsError.code!=="PGRST205")console.error("[api/admin/doctors GET] Doctor accounts query failed",accountsError);if(!accountsError){const rows=accounts??[];const users=await Promise.all(rows.map(account=>service.auth.admin.getUserById(account.user_id)));users.forEach(({data:{user}},index)=>{if(user?.email)accountMap.set(rows[index].doctor_id,{userId:user.id,email:user.email,status:user.banned_until&&new Date(user.banned_until)>new Date()?"disabled":"active"})})}}
  return Response.json({doctors:(data??[]).map(item=>({id:item.id,name:item.name,specialty:item.specialty,phone:item.phone??null,active:item.active,createdAt:item.created_at,account:accountMap.get(item.id)??null}))});
}

export async function POST(request:Request){
  const auth=await requireAdminApi();if("response" in auth)return auth.response;const{supabase}=auth;
  const body=await request.json() as {name?:string;specialty?:string;phone?:string};if(!body.specialty?.trim())return Response.json({error:"Введите специальность."},{status:400});const phone=body.phone?.trim()?normalizeKazakhstanPhone(body.phone):null;if(body.phone?.trim()&&!phone)return Response.json({error:"Проверьте номер телефона."},{status:400});
  const{error}=await supabase.from("doctors").insert({name:body.name?.trim()||null,specialty:body.specialty.trim(),phone});if(error)return failed("POST",error,"Не удалось добавить специалиста.");
  return Response.json({ok:true},{status:201});
}

export async function PATCH(request:Request){
  const auth=await requireAdminApi();if("response" in auth)return auth.response;const{supabase}=auth;
  const body=await request.json() as {id?:string;name?:string|null;specialty?:string;phone?:string|null;active?:boolean};if(!body.id)return Response.json({error:"Некорректные данные."},{status:400});
  const update:{name?:string|null;specialty?:string;phone?:string|null;active?:boolean}={};if(body.name!==undefined)update.name=body.name?.trim()||null;if(body.specialty!==undefined){if(!body.specialty.trim())return Response.json({error:"Специальность не может быть пустой."},{status:400});update.specialty=body.specialty.trim()}if(body.phone!==undefined){const phone=body.phone?.trim()?normalizeKazakhstanPhone(body.phone):null;if(body.phone?.trim()&&!phone)return Response.json({error:"Проверьте номер телефона."},{status:400});update.phone=phone}if(body.active!==undefined)update.active=body.active;
  const{error}=await supabase.from("doctors").update(update).eq("id",body.id);if(error)return failed("PATCH",error,"Не удалось сохранить специалиста.");
  return Response.json({ok:true});
}
