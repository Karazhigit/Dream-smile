import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/types/database";
import { getSupabasePublicKey } from "./public-config";

export async function createSupabaseAuthServerClient(){
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey=getSupabasePublicKey();
  if(!url||!anonKey)return null;
  const cookieStore=await cookies();
  return createServerClient<Database>(url,anonKey,{cookies:{
    getAll(){return cookieStore.getAll()},
    setAll(cookiesToSet){try{cookiesToSet.forEach(({name,value,options})=>cookieStore.set(name,value,options))}catch{/* Server Components are read-only; proxy refreshes the session cookies. */}},
  }});
}
