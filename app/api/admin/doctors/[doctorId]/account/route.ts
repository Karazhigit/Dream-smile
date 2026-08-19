import { requireAdminApi } from "@/lib/supabase/admin-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const uuidPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const emailPattern=/^\S+@\S+\.\S+$/;

function configurationError(){return Response.json({error:"Создание аккаунтов не настроено на сервере."},{status:503})}

export async function POST(request:Request,{params}:{params:Promise<{doctorId:string}>}){
  const auth=await requireAdminApi();if("response" in auth)return auth.response;
  const{doctorId}=await params;if(!uuidPattern.test(doctorId))return Response.json({error:"Специалист не указан."},{status:400});
  let body:{email?:string;password?:string};try{body=await request.json()}catch{return Response.json({error:"Проверьте данные аккаунта."},{status:400})}const email=body.email?.trim().toLowerCase();if(!email||!emailPattern.test(email)||!body.password||body.password.length<8)return Response.json({error:"Проверьте email и пароль. Пароль должен содержать минимум 8 символов."},{status:400});
  const admin=createSupabaseAdminClient();if(!admin)return configurationError();
  const[{data:doctor,error:doctorError},{data:existing,error:accountError}]=await Promise.all([admin.from("doctors").select("id").eq("id",doctorId).maybeSingle(),admin.from("doctor_accounts").select("id").eq("doctor_id",doctorId).maybeSingle()]);
  if(doctorError||accountError){console.error("[api/admin/doctors/account POST] Precheck failed",{doctorCode:doctorError?.code,accountCode:accountError?.code});return Response.json({error:"Не удалось проверить данные специалиста."},{status:500})}if(!doctor)return Response.json({error:"Специалист не найден."},{status:404});if(existing)return Response.json({error:"У этого врача уже есть аккаунт."},{status:409});
  const{data:createData,error:createError}=await admin.auth.admin.createUser({email,password:body.password,email_confirm:true,app_metadata:{role:"doctor"}});
  if(createError||!createData.user){const duplicate=createError?.code==="email_exists"||/already|exist|registered/i.test(createError?.message??"");if(!duplicate)console.error("[api/admin/doctors/account POST] Auth user creation failed",{code:createError?.code,message:createError?.message});return Response.json({error:duplicate?"Пользователь с таким email уже существует.":"Не удалось создать аккаунт врача."},{status:duplicate?409:500})}
  const user=createData.user;const{error:linkError}=await admin.from("doctor_accounts").insert({doctor_id:doctorId,user_id:user.id});
  if(linkError){const{error:rollbackError}=await admin.auth.admin.deleteUser(user.id);if(rollbackError)console.error("[api/admin/doctors/account POST] Auth rollback failed",{code:rollbackError.code,message:rollbackError.message});console.error("[api/admin/doctors/account POST] Account link failed",{code:linkError.code,message:linkError.message});return Response.json({error:linkError.code==="23505"?"У этого врача уже есть аккаунт.":"Не удалось связать аккаунт с врачом."},{status:linkError.code==="23505"?409:500})}
  return Response.json({account:{userId:user.id,email:user.email??email,status:"active"},message:"Аккаунт врача создан"},{status:201});
}

export async function DELETE(_request:Request,{params}:{params:Promise<{doctorId:string}>}){
  const auth=await requireAdminApi();if("response" in auth)return auth.response;const{doctorId}=await params;if(!uuidPattern.test(doctorId))return Response.json({error:"Специалист не указан."},{status:400});const admin=createSupabaseAdminClient();if(!admin)return configurationError();
  const{data:account,error:accountError}=await admin.from("doctor_accounts").select("user_id").eq("doctor_id",doctorId).maybeSingle();if(accountError){console.error("[api/admin/doctors/account DELETE] Account lookup failed",{code:accountError.code,message:accountError.message});return Response.json({error:"Не удалось проверить аккаунт врача."},{status:500})}if(!account)return Response.json({error:"Аккаунт врача не подключён."},{status:404});
  const{error:deleteError}=await admin.auth.admin.deleteUser(account.user_id);if(deleteError){console.error("[api/admin/doctors/account DELETE] Auth user deletion failed",{code:deleteError.code,message:deleteError.message});return Response.json({error:"Не удалось отключить аккаунт врача."},{status:500})}
  const{error:cleanupError}=await admin.from("doctor_accounts").delete().eq("doctor_id",doctorId);if(cleanupError)console.error("[api/admin/doctors/account DELETE] Link cleanup failed",{code:cleanupError.code,message:cleanupError.message});
  return Response.json({message:"Аккаунт врача отключён"});
}
