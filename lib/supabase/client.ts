import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { getSupabasePublicKey } from "./public-config";

let browserClient: SupabaseClient<Database> | null | undefined;

export function createSupabaseBrowserClient(): SupabaseClient<Database> | null {
  if (browserClient !== undefined) return browserClient;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = getSupabasePublicKey();
  browserClient = url && anonKey ? createClient<Database>(url, anonKey) : null;
  return browserClient;
}
