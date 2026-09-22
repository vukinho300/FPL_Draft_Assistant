import { AUCTION_VALUE_RELEASE } from './economics.ts'
import type { CanonicalPlayer } from './playerPool.ts'

export type PlayerEnrichment = Readonly<{
  playerRef: string
  fantalabId: string
  tiers: readonly string[]
  price: number | null
  percentage: number | null
  tags: readonly string[]
  target: boolean | null
  injured: boolean | null
  injuryCode: number
  injuryRisk: boolean
  hasStrategy: boolean
}>
export type Enrichment = Readonly<{
  schema: 1
  scope: 'LOCAL_ONLY'
  release: string
  checkedAt: string
  listoneVersion: string
  listoneSeason: string
  source: 'https://api.fantalab.it/v2'
  strategy: Readonly<{ id: string; name: string; creator: 'SOS Fanta'; season: 's_26_27'; format: 'classic'; list: 'serie-a'; credits: number; tierMapping: Record<string, string> }>
  players: readonly PlayerEnrichment[]
}>

function requireValid(condition: unknown): asserts condition {
  if (!condition) throw new Error('Invalid FantaLab enrichment: contract, provenance or exact identity mismatch')
}
function object(value: unknown): Record<string, unknown> {
  requireValid(value !== null && typeof value === 'object' && !Array.isArray(value))
  return value as Record<string, unknown>
}
function exactKeys(value: Record<string, unknown>, allowed: readonly string[]): void {
  requireValid(Object.keys(value).length === allowed.length && Object.keys(value).every(key => allowed.includes(key)))
}
function text(value: unknown): string { requireValid(typeof value === 'string' && value.length > 0); return value }
function nullableNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null
  requireValid((typeof value === 'number' || typeof value === 'string') && value !== '')
  const number = Number(value)
  requireValid(Number.isFinite(number) && number >= 0)
  return number
}
const safeTag = /^[a-z][a-z0-9_]{0,63}$/

// Only the allowlisted FL1 fields enter this adapter; comments/session data never enter the artifact.
export function normalizeEnrichment(raw: unknown, pool: readonly CanonicalPlayer[]): Enrichment {
  const input = object(raw), sourceStrategy = object(input.strategy)
  requireValid(sourceStrategy.creator === 'SOS Fanta' && sourceStrategy.season === 's_26_27'
    && sourceStrategy.format === 'classic' && sourceStrategy.list === 'serie-a')
  const tierMapping = Object.fromEntries(Object.entries(object(sourceStrategy.tierMapping)).map(([id, value]) => [id, text(object(value).name)]))
  const credits = nullableNumber(sourceStrategy.credits)
  requireValid(credits !== null && credits > 0)
  const strategy: Enrichment['strategy'] = { id: text(sourceStrategy.id), name: text(sourceStrategy.name), creator: 'SOS Fanta',
    season: 's_26_27', format: 'classic', list: 'serie-a', credits, tierMapping }
  requireValid(Array.isArray(input.listone) && Array.isArray(input.rows))
  const byRef = new Map<string, Record<string, unknown>>(), ids = new Set<string>()
  for (const value of input.listone) {
    const player = object(value), id = text(player.player_id)
    requireValid(Number.isSafeInteger(Number(player.fantacalcio_id)) && Number(player.fantacalcio_id) > 0 && !ids.has(id))
    const ref = `fantacalcio:fc:${player.fantacalcio_id}`
    requireValid(!byRef.has(ref)); ids.add(id); byRef.set(ref, player)
  }
  const strategyRows = new Map<string, Record<string, unknown>>()
  for (const value of input.rows) {
    const row = object(value), id = text(row.player_id)
    requireValid(row.strategy_id === strategy.id && !strategyRows.has(id))
    // Historical strategy entries outside the current listone are not imported.
    strategyRows.set(id, row)
  }
  const players = pool.map(({ playerRef }): PlayerEnrichment => {
    const player = byRef.get(playerRef)
    requireValid(player && Number.isSafeInteger(player.injured) && Number(player.injured) >= 0)
    const fantalabId = text(player.player_id), row = strategyRows.get(fantalabId)
    const tiers = row ? [row.fascia, row.fascia_second, row.fascia_third].filter(value => value !== null && value !== undefined).map(String) : []
    requireValid(tiers.every(id => id === '0' || Object.hasOwn(tierMapping, id)))
    const notes = row?.notes ?? []
    requireValid(Array.isArray(notes) && notes.every(tag => typeof tag === 'string' && safeTag.test(tag)))
    const tags = [...new Set(notes as string[])].sort()
    const target = row?.target ?? null
    requireValid(target === null || typeof target === 'boolean' || target === 0 || target === 1)
    return { playerRef, fantalabId, tiers, price: nullableNumber(row?.price), percentage: nullableNumber(row?.perc_price),
      tags, target: target === null ? null : Boolean(target), injuryCode: Number(player.injured),
      injured: player.injured === 0 ? false : player.injured === 1 ? true : null,
      injuryRisk: tags.includes('rischio_infortuni'), hasStrategy: row !== undefined }
  })
  const result: Enrichment = { schema: 1, scope: 'LOCAL_ONLY', release: AUCTION_VALUE_RELEASE.id, checkedAt: text(input.checkedAt),
    listoneVersion: text(input.listoneVersion), listoneSeason: text(input.listoneSeason), source: 'https://api.fantalab.it/v2', strategy, players }
  validateEnrichment(result, pool)
  return result
}

export function validateEnrichment(value: unknown, pool: readonly CanonicalPlayer[]): asserts value is Enrichment {
  const data = object(value), strategy = object(data.strategy)
  exactKeys(data, ['schema', 'scope', 'release', 'checkedAt', 'listoneVersion', 'listoneSeason', 'source', 'strategy', 'players'])
  exactKeys(strategy, ['id', 'name', 'creator', 'season', 'format', 'list', 'credits', 'tierMapping'])
  requireValid(data.schema === 1 && data.scope === 'LOCAL_ONLY' && data.release === AUCTION_VALUE_RELEASE.id
    && data.source === 'https://api.fantalab.it/v2' && Number.isFinite(Date.parse(text(data.checkedAt))))
  text(data.listoneVersion); text(data.listoneSeason); text(strategy.id); text(strategy.name)
  requireValid(strategy.creator === 'SOS Fanta' && strategy.season === 's_26_27' && strategy.format === 'classic'
    && strategy.list === 'serie-a' && typeof strategy.credits === 'number' && strategy.credits > 0)
  const mapping = object(strategy.tierMapping)
  requireValid(Object.entries(mapping).every(([id, label]) => /^\d+$/.test(id) && typeof label === 'string' && label.length > 0))
  requireValid(Array.isArray(data.players) && data.players.length === 534 && pool.length === 534)
  const expected = new Set(pool.map(player => player.playerRef)), seen = new Set<string>(), ids = new Set<string>()
  requireValid(expected.size === 534)
  for (const value of data.players) {
    const row = object(value), ref = text(row.playerRef), id = text(row.fantalabId)
    exactKeys(row, ['playerRef', 'fantalabId', 'tiers', 'price', 'percentage', 'tags', 'target', 'injured', 'injuryCode', 'injuryRisk', 'hasStrategy'])
    requireValid(expected.has(ref) && !seen.has(ref) && !ids.has(id)); seen.add(ref); ids.add(id)
    requireValid(Number.isSafeInteger(row.injuryCode) && Number(row.injuryCode) >= 0
      && row.injured === (row.injuryCode === 0 ? false : row.injuryCode === 1 ? true : null)
      && typeof row.injuryRisk === 'boolean' && typeof row.hasStrategy === 'boolean')
    requireValid(row.target === null || typeof row.target === 'boolean')
    requireValid([row.price, row.percentage].every(value => value === null || (typeof value === 'number' && Number.isFinite(value) && value >= 0)))
    requireValid(Array.isArray(row.tags) && row.tags.every(tag => typeof tag === 'string' && safeTag.test(tag))
      && row.injuryRisk === row.tags.includes('rischio_infortuni'))
    requireValid(Array.isArray(row.tiers) && row.tiers.every(id => typeof id === 'string' && (id === '0' || Object.hasOwn(mapping, id))))
    requireValid(row.hasStrategy || (row.price === null && row.percentage === null && row.target === null && row.tiers.length === 0 && row.tags.length === 0))
  }
}

export async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
}
export async function encodeEnrichment(data: Enrichment): Promise<string> {
  const payload = JSON.stringify(data)
  return JSON.stringify({ payload, sha256: await sha256(payload) })
}
export async function loadEnrichment(contents: string, pool: readonly CanonicalPlayer[]): Promise<Enrichment> {
  const envelope = object(JSON.parse(contents))
  exactKeys(envelope, ['payload', 'sha256'])
  const payload = text(envelope.payload)
  requireValid(envelope.sha256 === await sha256(payload))
  const result: unknown = JSON.parse(payload)
  validateEnrichment(result, pool)
  return result
}
export function healthLabel(player: PlayerEnrichment | undefined): string {
  return player === undefined ? 'Health enrichment not loaded' : player.injured === null ? `Status unverified (source code ${player.injuryCode})`
    : player.injured ? 'INJURED' : 'Not currently flagged injured'
}
