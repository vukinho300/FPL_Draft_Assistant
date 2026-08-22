import { createClient, type SupabaseClient } from '@supabase/supabase-js'

import {
  readSupabaseBrowserConfig,
  type SupabaseBrowserEnvironment,
} from './config.ts'

/** Creates the public browser client. It never reads or accepts privileged server credentials. */
export function createSupabaseBrowserClient(
  environment: SupabaseBrowserEnvironment,
): SupabaseClient {
  const config = readSupabaseBrowserConfig(environment)
  return createClient(config.url, config.publishableKey, {
    auth: {
      autoRefreshToken: true,
      detectSessionInUrl: true,
      persistSession: true,
    },
  })
}

let browserClient: SupabaseClient | undefined

/**
 * Lazily initializes one browser client when a later auth/data feature first needs it.
 * Keeping this lazy lets the existing unauthenticated dashboard run during F3.
 */
export function getSupabaseBrowserClient(): SupabaseClient {
  browserClient ??= createSupabaseBrowserClient(import.meta.env)
  return browserClient
}
