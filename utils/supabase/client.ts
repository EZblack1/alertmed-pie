import { createBrowserClient } from "@supabase/ssr"
import { supabaseUrl, supabaseAnonKey } from "@/app/env"

export function createClient() {
  return createBrowserClient(supabaseUrl, supabaseAnonKey)
}
