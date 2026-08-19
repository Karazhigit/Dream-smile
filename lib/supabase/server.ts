import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { getSupabasePublicKey } from "./public-config";

export function isSupabaseConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && getSupabasePublicKey());
}

export function createSupabaseServerClient(): SupabaseClient<Database> | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = getSupabasePublicKey();
  if (!url || !anonKey) return null;
  return createClient<Database>(url, anonKey, { auth: { persistSession:false, autoRefreshToken:false, detectSessionInUrl:false } });
}
