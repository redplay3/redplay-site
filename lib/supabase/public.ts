import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseConfig } from "./config";

let publicClient: SupabaseClient | null = null;

export function createPublicClient() {
  const config = getSupabaseConfig();
  if (!config) return null;

  publicClient ??= createClient(config.url, config.key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: "redplay-public" },
  });
  return publicClient;
}
