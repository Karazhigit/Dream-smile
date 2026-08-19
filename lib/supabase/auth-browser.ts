"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

let authClient:SupabaseClient<Database>|undefined;

export function createSupabaseAuthBrowserClient(){
  if(authClient)return authClient;
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if(!url||!anonKey)return null;
  authClient=createBrowserClient<Database>(url,anonKey);
  return authClient;
}
