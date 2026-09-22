import type { AuctionRole, ManagerSummary } from './ledger.ts'
import { parseCsvRows, type CanonicalPlayer } from './playerPool.ts'

export const AUCTION_VALUE_RELEASE = Object.freeze({
  id: 'fms-2026-09-22-b87cf673a837',
  selectedModel: 'shrink_k30',
  projectionsSha256: '514f4e002b5d46e7e782f1be5d30942d55a70c6bfb49783048f5602c101e2c3d',
  count: 534,
  dataAsOf: '2026-09-22T15:27:24.030803+00:00',
})

export type AuctionValuePlayer = CanonicalPlayer & Readonly<{
  projection: number
  positionRank: number
  overallRank: number
  confidence: 'LOW' | 'MEDIUM'
  fvm: number
  fvm500: number
}>

export type MarketSignal = 'MODEL > MARKET' | 'MARKET > MODEL' | 'ALIGNED'
export type DecisionState = 'ENTER BID' | 'GOOD VALUE' | 'REASONABLE' | 'NEAR LIMIT' | 'STOP / SAVE'

function finiteNumber(raw: string, field: string): number {
  const value = Number(raw)
  if (!Number.isFinite(value)) throw new Error(`Auction value release has invalid ${field}`)
  return value
}

export function parseAuctionValueRelease(csv: string): readonly AuctionValuePlayer[] {
  const rows = parseCsvRows(csv)
  const header = rows.shift()
  if (header === undefined) throw new Error('Auction value release is empty')
  const fields = ['playerRef', 'name', 'club', 'role', 'projection', 'position_rank', 'overall_rank', 'confidence', 'FVM_benchmark'] as const
  const columns = fields.map((field) => header.indexOf(field))
  if (columns.some((column) => column < 0)) throw new Error('Auction value release has missing contract fields')
  const seen = new Set<string>()
  const players = rows.map((row) => {
    const [playerRef, displayName, club, role, rawProjection, rawPositionRank, rawOverallRank, confidence, rawFvm] = columns.map((column) => row[column]!)
    if (!/^fantacalcio:fc:\d+$/.test(playerRef) || seen.has(playerRef) || !displayName || !club
      || !['POR', 'DIF', 'CEN', 'ATT'].includes(role) || !['LOW', 'MEDIUM'].includes(confidence)) {
      throw new Error('Auction value release contains an invalid or duplicate player')
    }
    seen.add(playerRef)
    const fvm = finiteNumber(rawFvm, 'FVM')
    return { playerRef, displayName, club, role: role as AuctionRole, eligibility: 'SELECTABLE' as const,
      projection: finiteNumber(rawProjection, 'projection'), positionRank: finiteNumber(rawPositionRank, 'position rank'),
      overallRank: finiteNumber(rawOverallRank, 'overall rank'), confidence: confidence as 'LOW' | 'MEDIUM', fvm, fvm500: fvm / 2 }
  })
  if (players.length !== AUCTION_VALUE_RELEASE.count) throw new Error(`Expected ${AUCTION_VALUE_RELEASE.count} projection rows; found ${players.length}`)
  return players
}

export async function loadAuctionValueRelease(file: Blob): Promise<readonly AuctionValuePlayer[]> {
  const bytes = await file.arrayBuffer()
  const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)))
    .map((value) => value.toString(16).padStart(2, '0')).join('')
  if (hash !== AUCTION_VALUE_RELEASE.projectionsSha256) throw new Error('This is not the accepted frozen FM-S auction value release')
  return parseAuctionValueRelease(new TextDecoder('utf-8').decode(bytes))
}

export function rankAvailable(players: readonly AuctionValuePlayer[], role: AuctionRole | 'ALL', soldRefs: ReadonlySet<string>): readonly AuctionValuePlayer[] {
  return players.filter((player) => !soldRefs.has(player.playerRef) && (role === 'ALL' || player.role === role))
    .sort((left, right) => left.overallRank - right.overallRank)
}

export function marketComparison(player: AuctionValuePlayer, rolePlayers: readonly AuctionValuePlayer[]): Readonly<{
  modelPercentile: number; marketPercentile: number; marketRank: number; signal: MarketSignal
}> {
  const withinRole = rolePlayers.filter((candidate) => candidate.role === player.role)
  const market = [...withinRole].sort((left, right) => right.fvm500 - left.fvm500 || left.positionRank - right.positionRank)
  const marketRank = market.findIndex((candidate) => candidate.playerRef === player.playerRef) + 1
  const denominator = Math.max(1, withinRole.length - 1)
  const modelPercentile = 1 - (player.positionRank - 1) / denominator
  const marketPercentile = 1 - (marketRank - 1) / denominator
  const difference = modelPercentile - marketPercentile
  return { modelPercentile, marketPercentile, marketRank, signal: difference >= 0.12 ? 'MODEL > MARKET' : difference <= -0.12 ? 'MARKET > MODEL' : 'ALIGNED' }
}

export function replacementLevel(players: readonly AuctionValuePlayer[], role: AuctionRole, soldRefs: ReadonlySet<string>, remainingLeagueDemand: number): number {
  const available = rankAvailable(players, role, soldRefs)
  return available[Math.max(0, Math.min(available.length - 1, remainingLeagueDemand - 1))]?.projection ?? 0
}

export function bestAlternatives(players: readonly AuctionValuePlayer[], selected: AuctionValuePlayer, soldRefs: ReadonlySet<string>, limit = 5): readonly AuctionValuePlayer[] {
  return rankAvailable(players, selected.role, soldRefs).filter((candidate) => candidate.playerRef !== selected.playerRef).slice(0, limit)
}

export function recommendedMax(input: Readonly<{
  player: AuctionValuePlayer
  players: readonly AuctionValuePlayer[]
  soldRefs: ReadonlySet<string>
  vuk: ManagerSummary
  allManagers: readonly ManagerSummary[]
  minimumPrice: number
}>): Readonly<{ recommendedMax: number; replacementProjection: number; scarcity: number; comparableCount: number; alternative: AuctionValuePlayer | null; referenceRosterCost: number }> {
  const { player, players, soldRefs, vuk, allManagers, minimumPrice } = input
  const alternatives = bestAlternatives(players, player, soldRefs)
  const alternative = alternatives[0] ?? null
  const remainingDemand = allManagers.reduce((sum, manager) => sum + manager.remainingSlots[player.role], 0)
  const replacementProjection = replacementLevel(players, player.role, soldRefs, remainingDemand)
  const roleMarket = rankAvailable(players, player.role, soldRefs).slice(0, Math.max(1, remainingDemand))
  const creditPerProjection = roleMarket.reduce((sum, candidate) => sum + candidate.fvm500, 0)
    / Math.max(1, roleMarket.reduce((sum, candidate) => sum + candidate.projection, 0))
  const alternativeProjection = alternative?.projection ?? replacementProjection
  const alternativeAnchor = alternative?.fvm500 ?? minimumPrice
  const breakEven = alternativeAnchor + Math.max(0, player.projection - alternativeProjection) * creditPerProjection
  const scarcity = Math.max(0, player.projection - replacementProjection)
  const scarcityMultiplier = 1 + Math.min(0.25, scarcity / Math.max(1, player.projection) * 0.25)
  const comparableCount = rankAvailable(players, player.role, soldRefs)
    .filter((candidate) => candidate.playerRef !== player.playerRef && candidate.projection >= player.projection * 0.9).length
  const alternativePressure = 1 + (1 - Math.min(1, comparableCount / Math.max(1, vuk.remainingSlots[player.role] * 2))) * 0.35
  const rawCeiling = (player.fvm500 + breakEven) / 2 * scarcityMultiplier * alternativePressure
  const availableByRole = (['POR', 'DIF', 'CEN', 'ATT'] as const).map((role) => rankAvailable(players, role, soldRefs))
  const referenceRosterCost = (['POR', 'DIF', 'CEN', 'ATT'] as const).reduce((sum, role, index) =>
    sum + availableByRole[index]!.slice(0, vuk.remainingSlots[role]).reduce((roleSum, candidate) => roleSum + Math.max(minimumPrice, candidate.fvm500), 0), 0)
  const affordability = Math.min(1, vuk.remainingCredits / Math.max(vuk.remainingCredits, referenceRosterCost))
  const recommended = Math.max(minimumPrice, Math.floor(rawCeiling * affordability))
  return { recommendedMax: Math.min(vuk.maxLegalBid, recommended), replacementProjection, scarcity, comparableCount, alternative, referenceRosterCost }
}

export function decisionState(currentBid: number, ceiling: number): DecisionState {
  if (currentBid <= 0) return 'ENTER BID'
  if (currentBid > ceiling) return 'STOP / SAVE'
  if (currentBid >= ceiling * 0.9) return 'NEAR LIMIT'
  if (currentBid >= ceiling * 0.75) return 'REASONABLE'
  return 'GOOD VALUE'
}
