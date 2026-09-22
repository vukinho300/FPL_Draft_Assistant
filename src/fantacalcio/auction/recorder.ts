import { type AuctionRole } from './ledger.ts'
import { type AuctionSnapshot, type PersistedAuctionEvent } from './repository.ts'

export type FutureCanonicalPlayer = Readonly<{
  playerRef: string
  displayName: string
  club: string
  role: AuctionRole
}>

export type ManualPlayerEntry = Readonly<{
  source: 'MANUAL'
  playerRef: string
  displayName: string
}>

/** The future player search will return FutureCanonicalPlayer; this is only the temporary no-dataset path. */
export function manualPlayerEntry(rawName: string): ManualPlayerEntry {
  const displayName = rawName.trim()
  if (displayName.length === 0) throw new Error('Enter a player name or reference')
  return { source: 'MANUAL', playerRef: `manual:${displayName}`, displayName }
}

export function displayPlayerRef(playerRef: string): string {
  return playerRef.startsWith('manual:') ? playerRef.slice('manual:'.length) : playerRef
}

export function exportAuctionSnapshot(snapshot: AuctionSnapshot, derivedManagers: readonly unknown[]): string {
  return JSON.stringify({
    exportedAt: new Date().toISOString(),
    session: { id: snapshot.sessionId, season: snapshot.season, configuration: snapshot.config },
    managers: snapshot.managers,
    events: snapshot.events,
    derivedManagerSummaries: derivedManagers,
  }, null, 2)
}

export function activeSales(events: readonly PersistedAuctionEvent[]): readonly PersistedAuctionEvent[] {
  const undone = new Set(events.filter((event) => event.kind === 'UNDO').map((event) => event.revertsSaleId))
  return events.filter((event) => event.kind === 'SALE' && !undone.has(event.id))
}

export function auctionErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  const normalized = message.toLowerCase()
  if (normalized.includes('already owned')) return 'That player is already owned. Reloaded history before allowing another sale.'
  if (normalized.includes('no remaining slot')) return 'That manager has no remaining slot for this role.'
  if (normalized.includes('outside legal range') || normalized.includes('legal bid')) return 'The price is outside the manager’s legal bid range.'
  if (normalized.includes('duplicate') || normalized.includes('unique')) return 'This request may already have been recorded. The server history was reconciled.'
  if (normalized.includes('access required') || normalized.includes('permission') || normalized.includes('401') || normalized.includes('403')) return 'Your Fantacalcio session is not authorized. Sign in again and retry.'
  if (normalized.includes('network') || normalized.includes('fetch')) return 'Network problem. Server history was checked before another sale can be recorded.'
  return 'The auction record could not be saved. Server history was checked before retrying.'
}
