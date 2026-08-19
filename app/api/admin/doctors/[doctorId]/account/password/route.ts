import { requireAdminApi } from "@/lib/supabase/admin-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { mutationOriginError,safeServerError } from "@/lib/api-security";

const uuidPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function PATCH(request:Request,{params}:{params:Promise<{doctorId:string}>}){
  const originError=mutationOriginError(request);if(originError)return originError;
  const auth=await requireAdminApi();if("response" in auth)return auth.response;const{doctorId}=await params;if(!uuidPattern.test(doctorId))return Response.json({error:"Специалист не указан."},{status:400});let body:{password?:string};try{body=await request.json()}catch{return Response.json({error:"Проверьте новый пароль."},{status:400})}if(!body.password||body.password.length<8||body.password.length>128)return Response.json({error:"Пароль должен содержать от 8 до 128 символов."},{status:400});const admin=createSupabaseAdminClient();if(!admin)return Response.json({error:"Управление аккаунтами не настроено на сервере."},{status:503});
  const{data:account,error:accountError}=await admin.from("doctor_accounts").select("user_id").eq("doctor_id",doctorId).maybeSingle();if(accountError){safeServerError("api/admin/doctors/account/password lookup",accountError);return Response.json({error:"Не удалось проверить аккаунт врача."},{status:500})}if(!account)return Response.json({error:"Аккаунт врача не подключён."},{status:404});
  const{error}=await admin.auth.admin.updateUserById(account.user_id,{password:body.password});if(error){safeServerError("api/admin/doctors/account/password update",error);return Response.json({error:"Не удалось изменить пароль врача."},{status:500})}
  return Response.json({message:"Пароль врача изменён"});
}
