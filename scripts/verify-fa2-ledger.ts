import { randomUUID } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

import { replayAuction, summarizeManager, type AuctionEvent, type AuctionRole } from '../src/fantacalcio/auction/ledger.ts'
import type { Database } from '../src/services/supabase/database.types.ts'
import { INITIAL_LEAGUE_ACCOUNTS, internalLoginEmail } from './league-accounts.ts'

type EventRow = Database['public']['Tables']['fantacalcio_auction_events']['Row']
type EventInsert = Database['public']['Tables']['fantacalcio_auction_events']['Insert']
type LocalStatus = { apiUrl: string; publishableKey: string; secretKey: string }

const TEST_PASSWORD = 'local-fa1-fixture-password-only'
const UNBOUND_EMAIL = 'unbound-fa2-rls@auth.kile-n-others.invalid'
const MANAGER_NAMES = ['Achi', 'Massi', 'Peps', 'Vuk', 'Dan', 'Paolo', 'Gian/Edu', 'Francesco']

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function localStatus(): LocalStatus {
  const scriptDirectory = fileURLToPath(new URL('.', import.meta.url))
  const binary = process.platform === 'win32'
    ? `${scriptDirectory}../node_modules/.bin/supabase.cmd`
    : `${scriptDirectory}../node_modules/.bin/supabase`
  const workdir = process.env.FA2_SUPABASE_WORKDIR
  const args = ['status', '--output', 'json', ...(workdir ? ['--workdir', workdir] : [])]
  const raw = process.platform === 'win32'
    ? execFileSync(process.env.ComSpec ?? 'cmd.exe', ['/d', '/s', '/c', `${binary} ${args.join(' ')}`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
    : execFileSync(binary, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
  const status = JSON.parse(raw) as Record<string, string>
  const apiUrl = status.API_URL ?? status['API URL']
  const publishableKey = status.PUBLISHABLE_KEY ?? status['Publishable key']
  const secretKey = status.SECRET_KEY ?? status['Secret key']
  assert(apiUrl && publishableKey && secretKey, 'Local Supabase status is missing API credentials')
  assert(['127.0.0.1', 'localhost', '::1'].includes(new URL(apiUrl).hostname), 'FA2 verification refuses a hosted project')
  assert(secretKey.startsWith('sb_secret_'), 'Local Supabase status did not provide a secret key')
  return { apiUrl, publishableKey, secretKey }
}

function client(status: LocalStatus, admin = false): SupabaseClient<Database> {
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
  assert(error === null && data.user !== null, `Unable to create local Auth fixture: ${error?.message}`)
  return data.user.id
}

async function signedIn(status: LocalStatus, email: string): Promise<SupabaseClient<Database>> {
  const signedInClient = client(status)
  const { error } = await signedInClient.auth.signInWithPassword({ email, password: TEST_PASSWORD })
  assert(error === null, `Unable to sign in local fixture: ${error?.message}`)
  return signedInClient
}

function assertNoRows(result: { data: unknown; error: unknown }, message: string): void {
  assert(result.error !== null || (Array.isArray(result.data) && result.data.length === 0), message)
}

function toDomainEvent(row: EventRow): AuctionEvent {
  const base = { id: row.id, sequenceNo: row.sequence_no, clientRequestId: row.client_request_id }
  if (row.kind === 'SALE') {
    assert(row.manager_id && row.player_ref && row.role && row.price, 'Stored sale is malformed')
    return { ...base, kind: 'SALE', managerId: row.manager_id, playerRef: row.player_ref, role: row.role as AuctionRole, price: row.price }
  }
  assert(row.kind === 'UNDO' && row.reverts_sale_id, 'Stored undo is malformed')
  return { ...base, kind: 'UNDO', revertsSaleId: row.reverts_sale_id }
}

async function append(signedInClient: SupabaseClient<Database>, input: EventInsert): Promise<EventRow> {
  const { data, error } = await signedInClient.from('fantacalcio_auction_events').insert(input).select('*').single()
  assert(error === null && data !== null, `Auction append failed: ${error?.message}`)
  return data
}

async function expectAppendDenied(signedInClient: SupabaseClient<Database>, input: EventInsert, reason: string): Promise<void> {
  const { error } = await signedInClient.from('fantacalcio_auction_events').insert(input)
  assert(error !== null, reason)
}

async function verify(): Promise<void> {
  const status = localStatus()
  const admin = client(status, true)
  const { data: realSession, error: realSessionError } = await admin.from('fantacalcio_auction_sessions').select('*').eq('season', '2026/27').single()
  assert(realSessionError === null && realSession !== null, `Missing seeded 2026/27 auction: ${realSessionError?.message}`)
  assert(realSession.initial_credits === 500 && realSession.minimum_price === 1, 'Incorrect seeded budget or minimum price')
  assert(realSession.por_slots === 3 && realSession.dif_slots === 8 && realSession.cen_slots === 8 && realSession.att_slots === 6, 'Incorrect seeded role slots')
  assert(realSession.position_sequence === null && realSession.next_event_sequence === 0, 'Auction order or event sequence was invented')
  const { data: realManagers, error: realManagersError } = await admin.from('fantacalcio_auction_managers').select('display_name').eq('session_id', realSession.id)
  assert(realManagersError === null && realManagers !== null, `Cannot read seeded managers: ${realManagersError?.message}`)
  assert(JSON.stringify(realManagers.map((row) => row.display_name).sort()) === JSON.stringify([...MANAGER_NAMES].sort()), 'Seeded managers do not match confirmed list')
  const { data: realEvents, error: realEventsError } = await admin.from('fantacalcio_auction_events').select('id').eq('session_id', realSession.id)
  assert(realEventsError === null && realEvents?.length === 0, 'The production-configured session contains fabricated test sales')

  const { data: accounts, error: accountError } = await admin.from('league_accounts').select('id, team_slug, auth_user_id')
  assert(accountError === null && accounts?.length === 6, 'Expected six local FPL account rows')
  const authIds = new Map<string, string>()
  for (const definition of INITIAL_LEAGUE_ACCOUNTS) {
    const authId = await fixtureUser(admin, internalLoginEmail(definition.teamSlug))
    const account = accounts.find((row) => row.team_slug === definition.teamSlug)
    assert(account && (account.auth_user_id === null || account.auth_user_id === authId), 'Existing local FPL fixture binding differs')
    if (account.auth_user_id === null) {
      const { error } = await admin.from('league_accounts').update({ auth_user_id: authId }).eq('id', account.id)
      assert(error === null, `Unable to bind local FPL fixture: ${error?.message}`)
    }
    authIds.set(definition.teamSlug, authId)
  }
  const vukAuthId = authIds.get('jakin-goff')!
  const { data: grants, error: grantsError } = await admin.from('fantacalcio_access').select('auth_user_id')
  assert(grantsError === null && grants !== null && grants.every((grant) => grant.auth_user_id === vukAuthId), 'Unexpected local Fantacalcio grant')
  if (grants.length === 0) {
    const { error } = await admin.from('fantacalcio_access').insert({ auth_user_id: vukAuthId })
    assert(error === null, `Unable to grant local Vuk fixture: ${error?.message}`)
  }
  await fixtureUser(admin, UNBOUND_EMAIL)

  // The real migration seed stays untouched. Disposable local-only rows exercise writes.
  const { data: fixtureSession, error: fixtureError } = await admin.from('fantacalcio_auction_sessions').insert({
    season: `local-fa2-${randomUUID()}`,
    initial_credits: 500, minimum_price: 1, por_slots: 3, dif_slots: 8, cen_slots: 8, att_slots: 6,
  }).select('*').single()
  assert(fixtureError === null && fixtureSession !== null, `Unable to create local auction fixture: ${fixtureError?.message}`)
  const { data: fixtureManagers, error: managersError } = await admin.from('fantacalcio_auction_managers').insert(
    MANAGER_NAMES.map((display_name) => ({ session_id: fixtureSession.id, display_name })),
  ).select('id, display_name')
  assert(managersError === null && fixtureManagers?.length === 8, `Unable to create local managers: ${managersError?.message}`)
  const managerId = (name: string) => {
    const id = fixtureManagers.find((manager) => manager.display_name === name)?.id
    assert(id, `Missing local manager ${name}`)
    return id
  }
  const saleInput = (name: string, playerRef: string, role: AuctionRole, price: number, clientRequestId = randomUUID()): EventInsert => ({
    session_id: fixtureSession.id, client_request_id: clientRequestId, kind: 'SALE',
    manager_id: managerId(name), player_ref: playerRef, role, price,
  })
  const vuk = await signedIn(status, internalLoginEmail('jakin-goff'))
  const anonymous = client(status)
  const unbound = await signedIn(status, UNBOUND_EMAIL)

  for (const unauthorized of [anonymous, unbound]) {
    assertNoRows(await unauthorized.from('fantacalcio_auction_sessions').select('id'), 'Unauthorized caller can read sessions')
    assertNoRows(await unauthorized.from('fantacalcio_auction_managers').select('id'), 'Unauthorized caller can read managers')
    assertNoRows(await unauthorized.from('fantacalcio_auction_events').select('id'), 'Unauthorized caller can read events')
    await expectAppendDenied(unauthorized, saleInput('Vuk', `test-denied-${randomUUID()}`, 'POR', 1), 'Unauthorized caller can append a sale')
  }
  for (const definition of INITIAL_LEAGUE_ACCOUNTS.filter((account) => account.teamSlug !== 'jakin-goff')) {
    const member = await signedIn(status, internalLoginEmail(definition.teamSlug))
    assertNoRows(await member.from('fantacalcio_auction_sessions').select('id'), `${definition.teamSlug} can read sessions`)
    assertNoRows(await member.from('fantacalcio_auction_managers').select('id'), `${definition.teamSlug} can read managers`)
    assertNoRows(await member.from('fantacalcio_auction_events').select('id'), `${definition.teamSlug} can read events`)
    await expectAppendDenied(member, saleInput('Vuk', `test-denied-${randomUUID()}`, 'POR', 1), `${definition.teamSlug} can append a sale`)
    await member.auth.signOut()
  }

  const { data: visibleSessions, error: visibleSessionError } = await vuk.from('fantacalcio_auction_sessions').select('id').eq('id', realSession.id)
  assert(visibleSessionError === null && visibleSessions?.length === 1, 'Vuk cannot read the 2026/27 session')
  const { data: visibleManagers, error: visibleManagersError } = await vuk.from('fantacalcio_auction_managers').select('id').eq('session_id', realSession.id)
  assert(visibleManagersError === null && visibleManagers?.length === 8, 'Vuk cannot read the eight configured managers')

  const playerRef = `test-player-${randomUUID()}`
  await expectAppendDenied(vuk, saleInput('Vuk', `test-overbid-${randomUUID()}`, 'POR', 477), 'Opening overbid was accepted')
  await expectAppendDenied(vuk, saleInput('Vuk', `test-free-${randomUUID()}`, 'POR', 0), 'Zero-price sale was accepted')
  const firstRequestId = randomUUID()
  const firstSale = await append(vuk, saleInput('Vuk', playerRef, 'POR', 20, firstRequestId))
  assert(firstSale.sequence_no === 1 && firstSale.actor_auth_user_id === vukAuthId, 'Sale was not sequenced or audited correctly')
  await expectAppendDenied(vuk, saleInput('Achi', playerRef, 'POR', 1), 'Duplicate player ownership was accepted')
  await expectAppendDenied(vuk, saleInput('Vuk', `test-retry-${randomUUID()}`, 'POR', 1, firstRequestId), 'Reused request ID created a second sale')

  const loadState = async () => {
    const { data, error } = await vuk.from('fantacalcio_auction_events').select('*').eq('session_id', fixtureSession.id).order('sequence_no')
    assert(error === null && data !== null, `Unable to reload auction history: ${error?.message}`)
    return replayAuction({
      initialCredits: fixtureSession.initial_credits,
      minimumPrice: fixtureSession.minimum_price,
      requiredSlots: { POR: fixtureSession.por_slots, DIF: fixtureSession.dif_slots, CEN: fixtureSession.cen_slots, ATT: fixtureSession.att_slots },
    }, fixtureManagers.map((manager) => manager.id), data.map(toDomainEvent))
  }
  let state = await loadState()
  assert(summarizeManager(state, managerId('Vuk')).remainingCredits === 480, 'Vuk budget did not persist after sale')
  assert(summarizeManager(state, managerId('Vuk')).remainingSlots.POR === 2, 'Vuk POR slot did not persist after sale')
  assert(state.activeSalesByPlayer.get(playerRef)?.managerId === managerId('Vuk'), 'Ownership did not persist after sale')
  assert(summarizeManager(state, managerId('Achi')).remainingCredits === 500, 'Other manager budget changed')

  const update = await vuk.from('fantacalcio_auction_events').update({ price: 1 }).eq('id', firstSale.id).select('id')
  assertNoRows(update, 'Browser can mutate sale history')
  const deletion = await vuk.from('fantacalcio_auction_events').delete().eq('id', firstSale.id).select('id')
  assertNoRows(deletion, 'Browser can delete sale history')
  const sessionEdit = await vuk.from('fantacalcio_auction_sessions').update({ initial_credits: 999 }).eq('id', fixtureSession.id).select('id')
  assertNoRows(sessionEdit, 'Browser can change auction configuration')

  const undoEvent = await append(vuk, { session_id: fixtureSession.id, client_request_id: randomUUID(), kind: 'UNDO', reverts_sale_id: firstSale.id, note: 'Correct test sale' })
  assert(undoEvent.sequence_no === 2, 'Undo did not follow sale in ledger sequence')
  await expectAppendDenied(vuk, { session_id: fixtureSession.id, client_request_id: randomUUID(), kind: 'UNDO', reverts_sale_id: firstSale.id }, 'Double undo was accepted')
  state = await loadState()
  assert(state.events.length === 2 && state.events[0].kind === 'SALE' && state.events[1].kind === 'UNDO', 'Undo erased audit history')
  assert(summarizeManager(state, managerId('Vuk')).remainingCredits === 500, 'Undo did not restore exact credits')
  assert(summarizeManager(state, managerId('Vuk')).remainingSlots.POR === 3, 'Undo did not restore exact role slot')
  assert(!state.activeSalesByPlayer.has(playerRef), 'Undo did not release player ownership')

  await append(vuk, saleInput('Achi', playerRef, 'POR', 15))
  state = await loadState()
  assert(state.activeSalesByPlayer.get(playerRef)?.managerId === managerId('Achi'), 'Player was not available for resale after undo')
  assert(summarizeManager(state, managerId('Achi')).remainingCredits === 485, 'Corrected sale budget is wrong')
  for (let index = 0; index < 3; index += 1) await append(vuk, saleInput('Vuk', `test-cap-${randomUUID()}`, 'POR', 1))
  await expectAppendDenied(vuk, saleInput('Vuk', `test-fourth-${randomUUID()}`, 'POR', 1), 'Fourth POR sale was accepted')
  await append(vuk, saleInput('Peps', `test-max-${randomUUID()}`, 'ATT', 476))
  await expectAppendDenied(vuk, saleInput('Peps', `test-reserve-${randomUUID()}`, 'ATT', 2), 'Reserve-breaking bid was accepted')
  await append(vuk, saleInput('Peps', `test-min-${randomUUID()}`, 'ATT', 1))
  state = await loadState()
  assert(summarizeManager(state, managerId('Peps')).remainingCredits === 23, 'Max-bid reserve was not preserved')
  assert(state.events.length === 8, 'Rejected requests changed the persistent event count')
  assert(state.events.map((event) => event.sequenceNo).every((sequenceNo, index) => sequenceNo === index + 1), 'Ledger history is not chronologically sequenced')
  const contestedPlayer = `test-concurrent-${randomUUID()}`
  const [contenderA, contenderB] = await Promise.all([
    vuk.from('fantacalcio_auction_events').insert(saleInput('Dan', contestedPlayer, 'DIF', 1)).select('id').single(),
    vuk.from('fantacalcio_auction_events').insert(saleInput('Paolo', contestedPlayer, 'DIF', 1)).select('id').single(),
  ])
  assert(Number(contenderA.error === null) + Number(contenderB.error === null) === 1, 'Concurrent duplicate sale did not produce exactly one winner')
  state = await loadState()
  assert(state.events.length === 9 && state.activeSalesByPlayer.has(contestedPlayer), 'Concurrent duplicate sale corrupted persisted ownership')
  const { data: finalSession, error: finalSessionError } = await admin.from('fantacalcio_auction_sessions').select('initial_credits, next_event_sequence').eq('id', fixtureSession.id).single()
  assert(finalSessionError === null && finalSession?.initial_credits === 500 && finalSession.next_event_sequence === 9, 'Rejected or unauthorized writes changed session state')
  await vuk.auth.signOut()
  await unbound.auth.signOut()
  console.log('FA2 local verification passed: seeded eight-manager session, sale/undo/reload, money and slots, sequential/concurrent duplicate denial, immutable history, five FPL users and anonymous/unbound denial.')
}

verify().catch((error: unknown) => {
  console.error(`FA2 local verification failed: ${error instanceof Error ? error.message : 'unknown error'}`)
  process.exitCode = 1
})
