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
  const { data: initialProfiles, error: initialProfilesError } = await admin
    .from('team_profiles')
    .select('account_id, avatar_path')
  assert(initialProfilesError === null && initialProfiles !== null, `Unable to read local team profiles: ${initialProfilesError?.message}`)
  assert(initialProfiles.length === 6, 'Expected exactly six seeded team profiles')
  assert(initialProfiles.every(({ avatar_path }) => avatar_path === null), 'Fresh team profiles must use avatar fallbacks')

  const { data: avatarBucket, error: avatarBucketError } = await admin.storage.getBucket('team-avatars')
  assert(avatarBucketError === null && avatarBucket !== null, `Unable to read the team avatar bucket: ${avatarBucketError?.message}`)
  assert(avatarBucket.public === false, 'Team avatars must remain in a private bucket')
  assert(avatarBucket.file_size_limit === 2 * 1024 * 1024, 'Team avatar bucket must enforce the 2 MB limit')

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
  assertDenied(
    await anonymous.from('team_profiles').select('account_id'),
    'Anonymous clients must not read team profiles',
  )

  const member = await signIn(status, internalLoginEmail('dindi'))
  const owner = await signIn(status, internalLoginEmail('jakin-goff'))
  const memberResult = await member.from('league_accounts').select('id, team_name, role')
  assert(memberResult.error === null && memberResult.data?.length === 6, 'A league member must read all six league identities')
  const ownerResult = await owner.from('league_accounts').select('id, team_name, role')
  assert(ownerResult.error === null && ownerResult.data?.length === 6, 'The league owner must read all six league identities')
  assert(
    ownerResult.data.some((account) => account.team_name === 'Jakin Goff' && account.role === 'LEAGUE_OWNER'),
    'The authenticated Jakin Goff local fixture must resolve as LEAGUE_OWNER',
  )
  const memberProfiles = await member.from('team_profiles').select('account_id, avatar_path')
  assert(memberProfiles.error === null && memberProfiles.data?.length === 6, 'A league member must read all six team profiles')
  const ownerProfiles = await owner.from('team_profiles').select('account_id, avatar_path')
  assert(ownerProfiles.error === null && ownerProfiles.data?.length === 6, 'The league owner must read all six team profiles')
  assert(
    memberResult.data.some((account) => account.team_name === 'Dindi' && account.role === 'MEMBER'),
    'The authenticated Dindi local fixture must resolve as MEMBER',
  )

  const dindi = initialAccounts.find((account) => account.team_slug === 'dindi')
  const jakin = initialAccounts.find((account) => account.team_slug === 'jakin-goff')
  assert(dindi !== undefined && jakin !== undefined, 'Expected Dindi and Jakin Goff fixture accounts')

  const firstAvatarPath = `${dindi.id}/local-avatar-one`
  const secondAvatarPath = `${dindi.id}/local-avatar-two`
  const avatar = new Blob([new Uint8Array([137, 80, 78, 71])], { type: 'image/png' })
  const firstUpload = await member.storage.from('team-avatars').upload(firstAvatarPath, avatar, {
    contentType: 'image/png',
    upsert: false,
  })
  assert(firstUpload.error === null, `A member must upload their own avatar: ${firstUpload.error?.message}`)
  const overwrite = await member.storage.from('team-avatars').upload(firstAvatarPath, avatar, {
    contentType: 'image/png',
    upsert: true,
  })
  assert(overwrite.error === null, `A member must replace their own avatar object: ${overwrite.error?.message}`)
  const ownProfileUpdate = await member
    .from('team_profiles')
    .update({ avatar_path: firstAvatarPath })
    .eq('account_id', dindi.id)
    .select('account_id, avatar_path')
    .single()
  assert(ownProfileUpdate.error === null && ownProfileUpdate.data?.avatar_path === firstAvatarPath, 'A member must update their own avatar path')
  const signedAvatar = await member.storage.from('team-avatars').createSignedUrl(firstAvatarPath, 60)
  assert(signedAvatar.error === null && signedAvatar.data?.signedUrl !== undefined, 'A league member must create an authenticated signed avatar URL')
  const downloadedAvatar = await owner.storage.from('team-avatars').download(firstAvatarPath)
  assert(downloadedAvatar.error === null && downloadedAvatar.data !== null, 'Another league member must read a league-visible avatar')

  const secondUpload = await member.storage.from('team-avatars').upload(secondAvatarPath, avatar, {
    contentType: 'image/png',
    upsert: false,
  })
  assert(secondUpload.error === null, `A member must upload a replacement avatar: ${secondUpload.error?.message}`)
  const replaceProfile = await member
    .from('team_profiles')
    .update({ avatar_path: secondAvatarPath })
    .eq('account_id', dindi.id)
    .select('avatar_path')
    .single()
  assert(replaceProfile.error === null && replaceProfile.data?.avatar_path === secondAvatarPath, 'A replacement avatar path must persist')
  const oldAvatarRemoval = await member.storage.from('team-avatars').remove([firstAvatarPath])
  assert(oldAvatarRemoval.error === null, `A member must remove their own previous avatar: ${oldAvatarRemoval.error?.message}`)

  assertDenied(
    await member.from('team_profiles').update({ avatar_path: `${jakin.id}/attack` }).eq('account_id', jakin.id).select('account_id'),
    'A member must not update another team profile',
  )
  assertDenied(
    await member.storage.from('team-avatars').upload(`${jakin.id}/attack`, avatar, { contentType: 'image/png' }),
    'A member must not upload into another team folder',
  )
  assertDenied(
    await owner.storage.from('team-avatars').upload(`${dindi.id}/owner-overreach`, avatar, { contentType: 'image/png' }),
    'LEAGUE_OWNER must not receive unrequested avatar repair access',
  )
  const ownerAvatarPath = `${jakin.id}/local-owner-avatar`
  const ownerAvatarUpload = await owner.storage.from('team-avatars').upload(ownerAvatarPath, avatar, { contentType: 'image/png' })
  assert(ownerAvatarUpload.error === null, `The league owner must upload only its own avatar: ${ownerAvatarUpload.error?.message}`)
  assertDenied(
    await member.storage.from('team-avatars').remove([ownerAvatarPath]),
    'A member must not remove another team avatar',
  )
  assertDenied(
    await anonymous.storage.from('team-avatars').download(secondAvatarPath),
    'Anonymous clients must not read private team avatars',
  )

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

  const { error: memberSignOutError } = await member.auth.signOut()
  assert(memberSignOutError === null, `Unable to sign out local member fixture: ${memberSignOutError?.message}`)
  const { error: ownerSignOutError } = await owner.auth.signOut()
  assert(ownerSignOutError === null, `Unable to sign out local owner fixture: ${ownerSignOutError?.message}`)

  console.log('A1/A2/A3 local verification passed: account resolution, profile reads, owner-scoped avatar upload/replace, private league avatar access, cross-team denial, constrained owner access, and sign-out.')
}

verifyRls().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown RLS verification failure'
  console.error(`A1 local RLS verification failed: ${message}`)
  process.exitCode = 1
})
