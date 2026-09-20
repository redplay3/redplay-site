import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseConfig } from "./config";

let browserClient: ReturnType<typeof createBrowserClient> | null = null;

export function createClient() {
  const config = getSupabaseConfig();
  if (!config) throw new Error("Supabase is not configured");
  browserClient ??= createBrowserClient(config.url, config.key);
  return browserClient;
}

