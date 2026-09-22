import type { SupabaseClient } from '@supabase/supabase-js'

import { getSupabaseBrowserClient } from './client.ts'
import type { Database } from './database.types.ts'

/** The database policy limits this lookup to the signed-in user's own grant. */
export async function hasFantacalcioAccess(
  authUserId: string,
  client: SupabaseClient<Database> = getSupabaseBrowserClient(),
): Promise<boolean> {
  const { data, error } = await client
    .from('fantacalcio_access')
    .select('auth_user_id')
    .eq('auth_user_id', authUserId)
    .maybeSingle()

  return error === null && data?.auth_user_id === authUserId
}
