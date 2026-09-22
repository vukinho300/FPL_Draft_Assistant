import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '../src/services/supabase/database.types.ts'
import { INITIAL_LEAGUE_ACCOUNTS, internalLoginEmail } from './league-accounts.ts'

const TEST_PASSWORD = 'local-fa1-fixture-password-only'
const UNBOUND_EMAIL = 'unbound-fa1-rls@auth.kile-n-others.invalid'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function localStatus(): { apiUrl: string; publishableKey: string; secretKey: string } {
  const scriptDirectory = fileURLToPath(new URL('.', import.meta.url))
  const binary = process.platform === 'win32'
    ? `${scriptDirectory}../node_modules/.bin/supabase.cmd`
    : `${scriptDirectory}../node_modules/.bin/supabase`
  const workdir = process.env.FA1_SUPABASE_WORKDIR
  const args = ['status', '--output', 'json', ...(workdir ? ['--workdir', workdir] : [])]
  const raw = process.platform === 'win32'
    ? execFileSync(process.env.ComSpec ?? 'cmd.exe', ['/d', '/s', '/c', `${binary} ${args.join(' ')}`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
    : execFileSync(binary, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
  const status = JSON.parse(raw) as Record<string, string>
  const apiUrl = status.API_URL ?? status['API URL']
  const publishableKey = status.PUBLISHABLE_KEY ?? status['Publishable key']
  const secretKey = status.SECRET_KEY ?? status['Secret key']
  assert(apiUrl && publishableKey && secretKey, 'Local Supabase status is missing API credentials')
  assert(['127.0.0.1', 'localhost', '::1'].includes(new URL(apiUrl).hostname), 'FA1 RLS verification refuses a hosted project')
  assert(secretKey.startsWith('sb_secret_'), 'Local Supabase status did not provide a secret key')
  return { apiUrl, publishableKey, secretKey }
}

function createLocalClient(status: ReturnType<typeof localStatus>, admin = false): SupabaseClient<Database> {
  return createClient<Database>(status.apiUrl, admin ? status.secretKey : status.publishableKey, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
  })
}

async function fixtureUser(admin: SupabaseClient<Database>, email: string): Promise<string> {
  const { data: listed, error: listError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  assert(listError === null, `Unable to list local Auth users: ${listError?.message}`)
  const existing = listed.users.find((user) => user.email?.toLowerCase() === email)
  if (existing) return existing.id
  const { data, error } = await admin.auth.admin.createUser({ email, password: TEST_PASSWORD, email_confirm: true })
  assert(error === null && data.user !== null, `Unable to create local fixture: ${error?.message}`)
  return data.user.id
}

async function signedIn(status: ReturnType<typeof localStatus>, email: string): Promise<SupabaseClient<Database>> {
  const client = createLocalClient(status)
  const { error } = await client.auth.signInWithPassword({ email, password: TEST_PASSWORD })
  assert(error === null, `Unable to sign in local fixture: ${error?.message}`)
  return client
}

function assertNoRows(result: { data: unknown; error: unknown }, message: string): void {
  assert(result.error !== null || (Array.isArray(result.data) && result.data.length === 0), message)
}

async function verify(): Promise<void> {
  const status = localStatus()
  const admin = createLocalClient(status, true)
  const { data: accounts, error: accountError } = await admin.from('league_accounts').select('id, team_slug, auth_user_id')
  assert(accountError === null && accounts?.length === 6, 'Expected six local league account rows')
  const userIds = new Map<string, string>()
  for (const definition of INITIAL_LEAGUE_ACCOUNTS) {
    const userId = await fixtureUser(admin, internalLoginEmail(definition.teamSlug))
    const account = accounts.find((row) => row.team_slug === definition.teamSlug)
    assert(account !== undefined, `Missing local league account: ${definition.teamSlug}`)
    assert(account.auth_user_id === null || account.auth_user_id === userId, 'Existing local fixture account has a different binding')
    if (account.auth_user_id === null) {
      const { error } = await admin.from('league_accounts').update({ auth_user_id: userId }).eq('id', account.id)
      assert(error === null, `Unable to bind local account: ${error?.message}`)
    }
    userIds.set(definition.teamSlug, userId)
  }
  await fixtureUser(admin, UNBOUND_EMAIL)
  const vukId = userIds.get('jakin-goff')!

  const { data: existing, error: existingError } = await admin.from('fantacalcio_access').select('auth_user_id')
  assert(existingError === null && existing !== null, `Unable to inspect grants: ${existingError?.message}`)
  assert(existing.every((row) => row.auth_user_id === vukId), 'Unexpected local Fantacalcio grant exists')

  const anonymous = createLocalClient(status)
  assertNoRows(await anonymous.from('fantacalcio_access').select('auth_user_id'), 'Anonymous caller can read a grant')
  const anonymousInsert = await anonymous.from('fantacalcio_access').insert({ auth_user_id: vukId })
  assert(anonymousInsert.error !== null, 'Anonymous caller can create a grant')

  const vuk = await signedIn(status, internalLoginEmail('jakin-goff'))
  if (existing.length === 0) {
    assertNoRows(await vuk.from('fantacalcio_access').select('auth_user_id'), 'FPL owner role alone granted Fantacalcio access')
    const { error } = await admin.from('fantacalcio_access').insert({ auth_user_id: vukId })
    assert(error === null, `Admin could not grant Vuk access: ${error?.message}`)
  }
  const own = await vuk.from('fantacalcio_access').select('auth_user_id, granted_at')
  assert(own.error === null && own.data?.length === 1 && own.data[0].auth_user_id === vukId, 'Vuk cannot read his explicit grant')
  const originalGrantedAt = own.data[0].granted_at

  for (const definition of INITIAL_LEAGUE_ACCOUNTS.filter((account) => account.teamSlug !== 'jakin-goff')) {
    const member = await signedIn(status, internalLoginEmail(definition.teamSlug))
    const rows = await member.from('fantacalcio_access').select('auth_user_id')
    assertNoRows(rows, `${definition.teamSlug} can read Fantacalcio grants`)
    const insert = await member.from('fantacalcio_access').insert({ auth_user_id: userIds.get(definition.teamSlug)! })
    assert(insert.error !== null, `${definition.teamSlug} can grant itself Fantacalcio access`)
    await member.auth.signOut()
  }
  const unbound = await signedIn(status, UNBOUND_EMAIL)
  assertNoRows(await unbound.from('fantacalcio_access').select('auth_user_id'), 'Unbound Auth user can read Fantacalcio grants')
  const unboundInsert = await unbound.from('fantacalcio_access').insert({ auth_user_id: vukId })
  assert(unboundInsert.error !== null, 'Unbound Auth user can grant access')

  const vukUpdate = await vuk.from('fantacalcio_access').update({ granted_at: '2000-01-01T00:00:00Z' }).eq('auth_user_id', vukId).select('auth_user_id')
  assertNoRows(vukUpdate, 'Vuk can update his own grant')
  const vukDelete = await vuk.from('fantacalcio_access').delete().eq('auth_user_id', vukId).select('auth_user_id')
  assertNoRows(vukDelete, 'Vuk can delete his own grant')
  const { data: final, error: finalError } = await admin.from('fantacalcio_access').select('auth_user_id, granted_at')
  assert(
    finalError === null && final?.length === 1 && final[0].auth_user_id === vukId && final[0].granted_at === originalGrantedAt,
    'Final grant set changed after a client write attempt',
  )
  await vuk.auth.signOut()
  await unbound.auth.signOut()
  console.log('FA1 local RLS verification passed: explicit Vuk grant, five FPL members denied, unbound and anonymous denied, client writes denied.')
}

verify().catch((error: unknown) => {
  console.error(`FA1 local RLS verification failed: ${error instanceof Error ? error.message : 'unknown error'}`)
  process.exitCode = 1
})
