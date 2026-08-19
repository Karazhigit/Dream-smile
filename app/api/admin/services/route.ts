import { requireAdminApi } from "@/lib/supabase/admin-auth";
import { isTrimmedText,isUuid,mutationOriginError,safeServerError } from "@/lib/api-security";

function failed(operation:string,error:unknown,message:string){safeServerError(`api/admin/services ${operation}`,error);return Response.json({error:message},{status:500})}

export async function GET(){
  const auth=await requireAdminApi();if("response" in auth)return auth.response;const{supabase}=auth;
  const{data,error}=await supabase.from("services").select("*").order("created_at");if(error)return failed("GET",error,"Не удалось загрузить услуги.");
  return Response.json({services:(data??[]).map(item=>({id:item.id,name:item.name,durationMinutes:item.duration_minutes,active:item.active,createdAt:item.created_at}))},{headers:{"Cache-Control":"private, no-store"}});
}

export async function POST(request:Request){
  const originError=mutationOriginError(request);if(originError)return originError;
  const auth=await requireAdminApi();if("response" in auth)return auth.response;const{supabase}=auth;
  let body:{name?:string;durationMinutes?:number|null};try{body=await request.json()}catch{return Response.json({error:"Проверьте данные услуги."},{status:400})}if(!isTrimmedText(body.name,1,120)||body.durationMinutes!==undefined&&body.durationMinutes!==null&&(!Number.isInteger(body.durationMinutes)||body.durationMinutes<1||body.durationMinutes>480))return Response.json({error:"Проверьте данные услуги."},{status:400});
  const{error}=await supabase.from("services").insert({name:body.name.trim(),duration_minutes:body.durationMinutes&&body.durationMinutes>0?body.durationMinutes:null});if(error)return failed("POST",error,"Не удалось добавить услугу.");
  return Response.json({ok:true},{status:201});
}

export async function PATCH(request:Request){
  const originError=mutationOriginError(request);if(originError)return originError;
  const auth=await requireAdminApi();if("response" in auth)return auth.response;const{supabase}=auth;
  let body:{id?:string;name?:string;durationMinutes?:number|null;active?:boolean};try{body=await request.json()}catch{return Response.json({error:"Некорректные данные."},{status:400})}if(!isUuid(body.id)||body.durationMinutes!==undefined&&body.durationMinutes!==null&&(!Number.isInteger(body.durationMinutes)||body.durationMinutes<1||body.durationMinutes>480))return Response.json({error:"Некорректные данные."},{status:400});
  const update:{name?:string;duration_minutes?:number|null;active?:boolean}={};if(body.name!==undefined){if(!isTrimmedText(body.name,1,120))return Response.json({error:"Название не может быть пустым."},{status:400});update.name=body.name.trim()}if(body.durationMinutes!==undefined)update.duration_minutes=body.durationMinutes;if(body.active!==undefined)update.active=body.active;
  const{error}=await supabase.from("services").update(update).eq("id",body.id);if(error)return failed("PATCH",error,"Не удалось сохранить услугу.");
  return Response.json({ok:true});
}
