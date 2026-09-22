import { createClient } from '@supabase/supabase-js'

import type { Database } from '../src/services/supabase/database.types.ts'
import { internalLoginEmail } from './league-accounts.ts'

function requiredEnvironment(name: string): string {
  const value = process.env[name]?.trim()
  if (value === undefined || value === '') throw new Error(`Missing required admin environment variable: ${name}`)
  return value
}

async function provision(): Promise<void> {
  const url = requiredEnvironment('SUPABASE_URL')
  const secretKey = requiredEnvironment('SUPABASE_SECRET_KEY')
  const authUserId = requiredEnvironment('FANTACALCIO_AUTH_USER_ID')
  if (!secretKey.startsWith('sb_secret_')) throw new Error('SUPABASE_SECRET_KEY must be a Supabase secret key')
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(authUserId)) {
    throw new Error('FANTACALCIO_AUTH_USER_ID must be the verified Auth UUID for Vuk')
  }

  const admin = createClient<Database>(url, secretKey, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
  })
  const { data: authData, error: authError } = await admin.auth.admin.getUserById(authUserId)
  if (authError !== null || authData.user?.id !== authUserId) {
    throw new Error(`Unable to verify the supplied Auth user: ${authError?.message ?? 'user not found'}`)
  }
  const { data: account, error: accountError } = await admin
    .from('league_accounts')
    .select('team_slug, auth_user_id')
    .eq('auth_user_id', authUserId)
    .maybeSingle()
  // This is a one-time provisioning guard, not the runtime authorization rule.
  // Runtime access depends only on the explicit fantacalcio_access row.
  if (
    accountError !== null || account?.team_slug !== 'jakin-goff'
    || account.auth_user_id !== authUserId
    || authData.user.email?.toLowerCase() !== internalLoginEmail('jakin-goff')
  ) {
    throw new Error('The supplied Auth UUID is not the verified existing Vuk account binding')
  }

  const { data: grants, error: grantsError } = await admin
    .from('fantacalcio_access')
    .select('auth_user_id')
  if (grantsError !== null || grants === null) {
    throw new Error(`Unable to inspect Fantacalcio grants: ${grantsError?.message ?? 'unknown error'}`)
  }
  if (grants.some((grant) => grant.auth_user_id !== authUserId)) {
    throw new Error('An unexpected Fantacalcio grant exists; refusing to provision another user')
  }
  if (grants.length === 0) {
    const { error: insertError } = await admin
      .from('fantacalcio_access')
      .insert({ auth_user_id: authUserId })
    if (insertError !== null) throw new Error(`Unable to grant Fantacalcio access: ${insertError.message}`)
  }

  const { data: verified, error: verifyError } = await admin
    .from('fantacalcio_access')
    .select('auth_user_id')
  if (verifyError !== null || verified?.length !== 1 || verified[0].auth_user_id !== authUserId) {
    throw new Error('Final Fantacalcio grant verification failed')
  }
  console.log('Verified exactly one Fantacalcio grant for the supplied Vuk Auth user ID.')
}

provision().catch((error: unknown) => {
  console.error(`Fantacalcio access provisioning failed: ${error instanceof Error ? error.message : 'unknown error'}`)
  process.exitCode = 1
})
