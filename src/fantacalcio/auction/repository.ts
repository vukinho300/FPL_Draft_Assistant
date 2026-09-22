import type { SupabaseClient } from '@supabase/supabase-js'

import { AUCTION_ROLES, type AuctionConfig, type AuctionEvent, type AuctionRole, type SaleEvent, type UndoEvent } from './ledger.ts'
import { getSupabaseBrowserClient } from '../../services/supabase/client.ts'
import type { Database } from '../../services/supabase/database.types.ts'

export type AuctionManager = Readonly<{ id: string; displayName: string }>

export type PersistedAuctionEvent = AuctionEvent & Readonly<{
  recordedAt: string
  note: string | null
}>

export type AuctionSnapshot = Readonly<{
  sessionId: string
  season: string
  config: AuctionConfig
  managers: readonly AuctionManager[]
  events: readonly PersistedAuctionEvent[]
}>

export type SaleDraft = Readonly<{
  sessionId: string
  clientRequestId: string
  managerId: string
  playerRef: string
  role: AuctionRole
  price: number
}>

export type UndoDraft = Readonly<{
  sessionId: string
  clientRequestId: string
  revertsSaleId: string
}>

export interface AuctionRepository {
  load(): Promise<AuctionSnapshot>
  recordSale(draft: SaleDraft): Promise<void>
  recordUndo(draft: UndoDraft): Promise<void>
}

function asRole(value: string | null): AuctionRole {
  if (value !== null && AUCTION_ROLES.includes(value as AuctionRole)) return value as AuctionRole
  throw new Error('Auction history contains an invalid role')
}

function asPersistedEvent(row: Database['public']['Tables']['fantacalcio_auction_events']['Row']): PersistedAuctionEvent {
  if (row.kind === 'SALE') {
    if (row.manager_id === null || row.player_ref === null || row.role === null || row.price === null) {
      throw new Error('Auction sale history is incomplete')
    }
    const event: SaleEvent = {
      id: row.id,
      sequenceNo: row.sequence_no,
      clientRequestId: row.client_request_id,
      kind: 'SALE',
      managerId: row.manager_id,
      playerRef: row.player_ref,
      role: asRole(row.role),
      price: row.price,
    }
    return { ...event, recordedAt: row.recorded_at, note: row.note }
  }
  if (row.kind === 'UNDO' && row.reverts_sale_id !== null) {
    const event: UndoEvent = {
      id: row.id,
      sequenceNo: row.sequence_no,
      clientRequestId: row.client_request_id,
      kind: 'UNDO',
      revertsSaleId: row.reverts_sale_id,
    }
    return { ...event, recordedAt: row.recorded_at, note: row.note }
  }
  throw new Error('Auction history contains an invalid event')
}

export function createSupabaseAuctionRepository(
  client?: SupabaseClient<Database>,
): AuctionRepository {
  const resolveClient = (): SupabaseClient<Database> => client ?? getSupabaseBrowserClient()
  return {
    async load(): Promise<AuctionSnapshot> {
      const activeClient = resolveClient()
      const { data: session, error: sessionError } = await activeClient
        .from('fantacalcio_auction_sessions')
        .select('*')
        .eq('season', '2026/27')
        .maybeSingle()
      if (sessionError !== null) throw sessionError
      if (session === null) throw new Error('The 2026/27 auction session is unavailable')

      const [{ data: managers, error: managersError }, { data: events, error: eventsError }] = await Promise.all([
        activeClient.from('fantacalcio_auction_managers').select('*').eq('session_id', session.id),
        activeClient.from('fantacalcio_auction_events').select('*').eq('session_id', session.id).order('sequence_no', { ascending: true }),
      ])
      if (managersError !== null) throw managersError
      if (eventsError !== null) throw eventsError
      return {
        sessionId: session.id,
        season: session.season,
        config: {
          initialCredits: session.initial_credits,
          minimumPrice: session.minimum_price,
          requiredSlots: { POR: session.por_slots, DIF: session.dif_slots, CEN: session.cen_slots, ATT: session.att_slots },
        },
        managers: managers.map(({ id, display_name }) => ({ id, displayName: display_name })),
        events: events.map(asPersistedEvent),
      }
    },
    async recordSale(draft: SaleDraft): Promise<void> {
      const { error } = await resolveClient().from('fantacalcio_auction_events').insert({
        session_id: draft.sessionId,
        client_request_id: draft.clientRequestId,
        kind: 'SALE',
        manager_id: draft.managerId,
        player_ref: draft.playerRef,
        role: draft.role,
        price: draft.price,
      })
      if (error !== null) throw error
    },
    async recordUndo(draft: UndoDraft): Promise<void> {
      const { error } = await resolveClient().from('fantacalcio_auction_events').insert({
        session_id: draft.sessionId,
        client_request_id: draft.clientRequestId,
        kind: 'UNDO',
        reverts_sale_id: draft.revertsSaleId,
      })
      if (error !== null) throw error
    },
  }
}
