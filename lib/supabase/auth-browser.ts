"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { getSupabasePublicKey } from "./public-config";

let authClient:SupabaseClient<Database>|undefined;

export function createSupabaseAuthBrowserClient(){
  if(authClient)return authClient;
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey=getSupabasePublicKey();
  if(!url||!anonKey)return null;
  authClient=createBrowserClient<Database>(url,anonKey);
  return authClient;
}
