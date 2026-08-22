import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '../src/services/supabase/database.types.ts'
import {
  INITIAL_LEAGUE_ACCOUNTS,
  internalLoginEmail,
} from './league-accounts.ts'

const LOCAL_A1_TEST_PASSWORD = 'local-a1-fixture-password-only'
const LOCAL_A1_UNBOUND_EMAIL = 'unbound-a1-rls@auth.kile-n-others.invalid'

interface LocalSupabaseStatus {
  readonly apiUrl: string
  readonly dbUrl: string
  readonly publishableKey: string
  readonly secretKey: string
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

function runSupabaseStatus(): Record<string, unknown> {
  const scriptDirectory = fileURLToPath(new URL('.', import.meta.url))
  const binary = process.platform === 'win32'
    ? `${scriptDirectory}../node_modules/.bin/supabase.cmd`
    : `${scriptDirectory}../node_modules/.bin/supabase`
  const command = process.platform === 'win32'
    ? process.env.ComSpec ?? 'cmd.exe'
    : binary
  const args = process.platform === 'win32'
    ? ['/d', '/s', '/c', `${binary} status --output json`]
    : ['status', '--output', 'json']
  const raw = execFileSync(command, args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  const parsed: unknown = JSON.parse(raw)
  assert(parsed !== null && typeof parsed === 'object', 'Unable to parse Supabase local status')
  return parsed as Record<string, unknown>
}

function statusValue(status: Record<string, unknown>, ...keys: readonly string[]): string {
  for (const key of keys) {
    const value = status[key]
    if (typeof value === 'string' && value !== '') {
      return value
    }
  }
  throw new Error(`Supabase local status did not provide ${keys.join(' or ')}`)
}

function readLocalStatus(): LocalSupabaseStatus {
  const status = runSupabaseStatus()
  const apiUrl = statusValue(status, 'API_URL', 'API URL')
  const dbUrl = statusValue(status, 'DB_URL', 'DB URL')
  const publishableKey = statusValue(status, 'PUBLISHABLE_KEY', 'Publishable key')
  const secretKey = statusValue(status, 'SECRET_KEY', 'Secret key')
  const hostname = new URL(apiUrl).hostname
  assert(
    hostname === '127.0.0.1' || hostname === 'localhost' || hostname === '::1',
    'A1 RLS verification refuses to target a non-local Supabase URL',
  )
  assert(secretKey.startsWith('sb_secret_'), 'Local Supabase status did not provide a secret key')
  return { apiUrl, dbUrl, publishableKey, secretKey }
}

function readPrivateAuthorizationFlags(
  dbUrl: string,
  authUserId: string,
): { readonly member: boolean; readonly owner: boolean } {
  const sql = [
    `select set_config('request.jwt.claim.sub', '${authUserId}', false);`,
    "select private.is_current_league_member()::text || ',' || private.is_current_league_owner()::text;",
  ].join(' ')
  let output: string
  try {
    output = execFileSync('psql', ['--dbname', dbUrl, '--tuples-only', '--no-align', '--command', sql], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  } catch {
    throw new Error('Unable to run the local database authorization-helper check')
  }
  const result = output.trim().split(/\r?\n/).at(-1)
  const [member, owner] = result?.split(',') ?? []
  assert(member === 'true' || member === 'false', 'Invalid local member helper result')
  assert(owner === 'true' || owner === 'false', 'Invalid local owner helper result')
  return { member: member === 'true', owner: owner === 'true' }
}

function createAdminClient(status: LocalSupabaseStatus): SupabaseClient<Database> {
  return createClient<Database>(status.apiUrl, status.secretKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  })
}

function createPublicClient(status: LocalSupabaseStatus): SupabaseClient<Database> {
  return createClient<Database>(status.apiUrl, status.publishableKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  })
}

async function createOrReadLocalFixtureUser(
  admin: SupabaseClient<Database>,
  email: string,
): Promise<string> {
  const { data: listed, error: listError } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  })
  assert(listError === null, `Unable to list local Auth users: ${listError?.message}`)
  const existing = listed.users.find((user) => user.email?.toLowerCase() === email)
  if (existing !== undefined) {
    return existing.id
  }

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password: LOCAL_A1_TEST_PASSWORD,
    email_confirm: true,
  })
  assert(createError === null && created.user !== null, `Unable to create local fixture user: ${createError?.message}`)
  return created.user.id
}

async function signIn(
  status: LocalSupabaseStatus,
  email: string,
): Promise<SupabaseClient<Database>> {
  const client = createPublicClient(status)
  const { error } = await client.auth.signInWithPassword({
    email,
    password: LOCAL_A1_TEST_PASSWORD,
  })
  assert(error === null, `Unable to sign in local fixture user: ${error?.message}`)
  return client
}

function assertDenied(
  result: { readonly data: unknown; readonly error: { readonly message: string } | null },
  message: string,
): void {
  const returnedRows = Array.isArray(result.data) ? result.data.length : result.data === null ? 0 : 1
  assert(result.error !== null || returnedRows === 0, message)
}

async function verifyRls(): Promise<void> {
  const status = readLocalStatus()
  const admin = createAdminClient(status)

  const { data: initialAccounts, error: initialError } = await admin
    .from('league_accounts')
    .select('id, team_slug, team_name, manager_name, role, auth_user_id')
    .order('team_slug')
  assert(initialError === null && initialAccounts !== null, `Unable to read local account registry: ${initialError?.message}`)
  assert(initialAccounts.length === INITIAL_LEAGUE_ACCOUNTS.length, 'Expected exactly six initial league accounts')
  assert(initialAccounts.filter((account) => account.role === 'LEAGUE_OWNER').length === 1, 'Expected exactly one LEAGUE_OWNER')
  assert(
    initialAccounts.some((account) => account.team_slug === 'jakin-goff' && account.role === 'LEAGUE_OWNER'),
    'Expected Jakin Goff to be the LEAGUE_OWNER',
  )

  const fixtureUserIds = new Map<string, string>()
  for (const definition of INITIAL_LEAGUE_ACCOUNTS) {
    fixtureUserIds.set(
      definition.teamSlug,
      await createOrReadLocalFixtureUser(admin, internalLoginEmail(definition.teamSlug)),
    )
  }
  const unboundUserId = await createOrReadLocalFixtureUser(admin, LOCAL_A1_UNBOUND_EMAIL)

  for (const account of initialAccounts) {
    const fixtureUserId = fixtureUserIds.get(account.team_slug)
    assert(fixtureUserId !== undefined, `Missing fixture user for ${account.team_name}`)
    const { error: bindError } = await admin
      .from('league_accounts')
      .update({ auth_user_id: fixtureUserId })
      .eq('id', account.id)
    assert(bindError === null, `Unable to bind local fixture account: ${bindError?.message}`)
  }

  const ownerFlags = readPrivateAuthorizationFlags(
    status.dbUrl,
    fixtureUserIds.get('jakin-goff') ?? '',
  )
  const memberFlags = readPrivateAuthorizationFlags(
    status.dbUrl,
    fixtureUserIds.get('dindi') ?? '',
  )
  assert(ownerFlags.member && ownerFlags.owner, 'Jakin Goff must be recognized as the league owner')
  assert(memberFlags.member && !memberFlags.owner, 'A normal member must not be recognized as the league owner')

  const anonymous = createPublicClient(status)
  const anonymousResult = await anonymous.from('league_accounts').select('id')
  assertDenied(anonymousResult, 'Anonymous clients must not read league accounts')

  const member = await signIn(status, internalLoginEmail('dindi'))
  const owner = await signIn(status, internalLoginEmail('jakin-goff'))
  const memberResult = await member.from('league_accounts').select('id, team_name, role')
  assert(memberResult.error === null && memberResult.data?.length === 6, 'A league member must read all six league identities')
  const ownerResult = await owner.from('league_accounts').select('id, team_name, role')
  assert(ownerResult.error === null && ownerResult.data?.length === 6, 'The league owner must read all six league identities')

  const dindi = initialAccounts.find((account) => account.team_slug === 'dindi')
  const jakin = initialAccounts.find((account) => account.team_slug === 'jakin-goff')
  assert(dindi !== undefined && jakin !== undefined, 'Expected Dindi and Jakin Goff fixture accounts')

  assertDenied(
    await member
      .from('league_accounts')
      .update({ team_name: 'Dindi compromised' })
      .eq('id', dindi.id)
      .select('id'),
    'A member must not update their own account row during A1',
  )
  assertDenied(
    await member
      .from('league_accounts')
      .update({ role: 'LEAGUE_OWNER' })
      .eq('id', dindi.id)
      .select('id'),
    'A member must not promote themselves',
  )
  assertDenied(
    await member
      .from('league_accounts')
      .update({ auth_user_id: unboundUserId })
      .eq('id', dindi.id)
      .select('id'),
    'A member must not rebind their Auth user',
  )
  assertDenied(
    await member
      .from('league_accounts')
      .update({ team_name: 'Jakin compromised' })
      .eq('id', jakin.id)
      .select('id'),
    'A member must not update another account',
  )
  assertDenied(
    await member
      .from('league_accounts')
      .insert({
        team_slug: 'attacker',
        team_name: 'Attacker',
        manager_name: 'Attacker',
        role: 'LEAGUE_OWNER',
      })
      .select('id'),
    'A member must not insert a LEAGUE_OWNER account',
  )
  assertDenied(
    await owner
      .from('league_accounts')
      .update({ team_name: 'Owner overreach' })
      .eq('id', jakin.id)
      .select('id'),
    'LEAGUE_OWNER must not receive broad table mutation rights in A1',
  )

  const { data: finalAccounts, error: finalError } = await admin
    .from('league_accounts')
    .select('team_slug, team_name, role, auth_user_id')
    .order('team_slug')
  assert(finalError === null && finalAccounts !== null, `Unable to verify final registry: ${finalError?.message}`)
  assert(finalAccounts.length === 6, 'Denied direct API writes must not add an account')
  assert(
    finalAccounts.some((account) => account.team_slug === 'dindi' && account.team_name === 'Dindi' && account.role === 'MEMBER' && account.auth_user_id === fixtureUserIds.get('dindi')),
    'Denied member writes must leave Dindi unchanged',
  )
  assert(
    finalAccounts.some((account) => account.team_slug === 'jakin-goff' && account.team_name === 'Jakin Goff' && account.role === 'LEAGUE_OWNER'),
    'Denied writes must preserve the Jakin Goff LEAGUE_OWNER mapping',
  )

  console.log('A1 local RLS verification passed: anonymous denial, member read access, mutation denial, and constrained owner access.')
}

verifyRls().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown RLS verification failure'
  console.error(`A1 local RLS verification failed: ${message}`)
  process.exitCode = 1
})
