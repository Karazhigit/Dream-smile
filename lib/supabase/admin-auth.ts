import "server-only";

import type { User } from "@supabase/supabase-js";
import { createSupabaseAuthServerClient } from "./auth-server";

export function isAdminUser(user:User|null|undefined){return user?.app_metadata?.role==="admin"}

export async function getAdminUser(){
  const supabase=await createSupabaseAuthServerClient();
  if(!supabase)return {supabase:null,user:null};
  const{data:{user},error}=await supabase.auth.getUser();
  if(error||!isAdminUser(user))return {supabase,user:null};
  return {supabase,user};
}

export async function requireAdminApi(){
  const supabase=await createSupabaseAuthServerClient();
  if(!supabase)return {response:Response.json({error:"Supabase не подключён."},{status:503})} as const;
  const{data:{user},error}=await supabase.auth.getUser();
  if(error||!user)return {response:Response.json({error:"Требуется авторизация."},{status:401})} as const;
  if(!isAdminUser(user))return {response:Response.json({error:"Недостаточно прав."},{status:403})} as const;
  return {supabase,user} as const;
}
