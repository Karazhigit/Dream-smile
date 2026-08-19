import "server-only";

import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { createSupabaseAuthServerClient } from "./auth-server";

export type DoctorIdentity={id:string;name:string|null;specialty:string;phone:string|null};
type AuthorizedDoctor={supabase:SupabaseClient<Database>;user:User;doctor:DoctorIdentity};

export async function getDoctorAccess(){
  const supabase=await createSupabaseAuthServerClient();
  if(!supabase)return{supabase:null,user:null,doctor:null};
  const{data:{user},error:userError}=await supabase.auth.getUser();
  if(userError||!user)return{supabase,user:null,doctor:null};
  const{data,error}=await supabase.from("doctor_accounts").select("doctor:doctors!doctor_accounts_doctor_id_fkey(id,name,specialty,phone)").eq("user_id",user.id).maybeSingle();
  if(error){console.error("[doctor-auth] Doctor account lookup failed",{code:error.code,message:error.message});return{supabase,user,doctor:null}}
  const joined=data as unknown as{doctor:DoctorIdentity|null}|null;
  return{supabase,user,doctor:joined?.doctor??null};
}

export async function requireDoctorApi(){
  const access=await getDoctorAccess();
  if(!access.supabase)return{response:Response.json({error:"Supabase не подключён."},{status:503})} as const;
  if(!access.user)return{response:Response.json({error:"Сессия истекла. Войдите снова."},{status:401})} as const;
  if(!access.doctor)return{response:Response.json({error:"Нет доступа."},{status:403})} as const;
  return access as AuthorizedDoctor;
}
