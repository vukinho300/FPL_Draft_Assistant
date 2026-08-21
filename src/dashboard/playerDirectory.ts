import type { Position } from '../domain/player.ts'
import {
  rankPlayersByMvpConsensus,
  type DraftRankingSignal,
} from '../domain/draftRanking.ts'
import type { PlayerOwnershipEntry } from '../domain/transactions.ts'

export type PlayerOwnershipFilter = 'ALL' | 'FREE_AGENTS' | 'OWNED'
export const PLAYER_OWNERSHIP_FILTERS = ['ALL', 'FREE_AGENTS', 'OWNED'] as const

export type PlayerDirectorySort = 'OFFICIAL' | 'FORM' | 'TOTAL_POINTS' | 'MVP'
export const PLAYER_DIRECTORY_SORTS = ['OFFICIAL', 'FORM', 'TOTAL_POINTS', 'MVP'] as const

export interface PlayerDirectoryFilters {
  readonly search: string
  readonly position: Position | 'ALL'
  readonly ownership: PlayerOwnershipFilter
  readonly sort: PlayerDirectorySort
}

export interface PlayerDirectoryEntry extends PlayerOwnershipEntry {
  /** Full-pool project consensus recomputed from live official rank plus frozen model evidence. */
  readonly mvpConsensusRank: number
  /** Frozen 2026/27 preseason model evidence; null when no trusted exact signal exists. */
  readonly draftModelRank: number | null
  readonly draftModelUnavailableReason: string | null
}

export type PlayerDirectoryLeaderMetric = 'FORM' | 'TOTAL_POINTS'

export function getPlayerDirectorySortLabel(sort: PlayerDirectorySort): string {
  const labels: Readonly<Record<PlayerDirectorySort, string>> = {
    OFFICIAL: 'Official FPL Draft rank',
    FORM: 'Form',
    TOTAL_POINTS: 'Total Points',
    MVP: 'MVP consensus',
  }
  return labels[sort]
}

export function buildRankedPlayerDirectory(
  ownershipEntries: readonly PlayerOwnershipEntry[],
  signals: readonly DraftRankingSignal[],
): readonly PlayerDirectoryEntry[] {
  const ownershipByPlayerId = new Map(
    ownershipEntries.map((entry) => [entry.player.id, entry]),
  )
  if (ownershipByPlayerId.size !== ownershipEntries.length) {
    throw new Error('Player ownership directory IDs must be unique')
  }

  return Object.freeze(
    rankPlayersByMvpConsensus(
      ownershipEntries.map(({ player }) => player),
      signals,
    ).map((ranked) => {
      const ownership = ownershipByPlayerId.get(ranked.player.id)
      if (ownership === undefined) {
        throw new Error(`Missing ownership entry for player ${ranked.player.id}`)
      }
      return Object.freeze({
        ...ownership,
        mvpConsensusRank: ranked.consensusRank,
        draftModelRank: ranked.modelSignal?.modelSignalAvailable === true
          ? ranked.modelSignal.modelRank
          : null,
        draftModelUnavailableReason: ranked.modelSignal?.modelSignalAvailable === true
          ? null
          : ranked.modelSignal?.unavailableReason ?? 'no frozen 2026/27 draft model signal',
      })
    }),
  )
}

export function getPlayerDirectoryName(entry: PlayerDirectoryEntry): string {
  return entry.player.fullName ?? entry.player.displayName
}

function valueFor(entry: PlayerDirectoryEntry, sort: PlayerDirectorySort): number | null {
  if (sort === 'OFFICIAL') return entry.player.officialDraftRank
  if (sort === 'FORM') return entry.player.form ?? null
  if (sort === 'TOTAL_POINTS') return entry.player.totalPoints ?? null
  return entry.mvpConsensusRank
}

function compareDirectoryEntries(
  left: PlayerDirectoryEntry,
  right: PlayerDirectoryEntry,
  sort: PlayerDirectorySort,
): number {
  const leftValue = valueFor(left, sort)
  const rightValue = valueFor(right, sort)
  if (leftValue !== null && rightValue === null) return -1
  if (leftValue === null && rightValue !== null) return 1
  if (leftValue !== null && rightValue !== null && leftValue !== rightValue) {
    return sort === 'FORM' || sort === 'TOTAL_POINTS'
      ? rightValue - leftValue
      : leftValue - rightValue
  }

  return getPlayerDirectoryName(left).localeCompare(getPlayerDirectoryName(right))
    || left.player.id.localeCompare(right.player.id)
}

/** Top current-season performers from the same shared directory data. */
export function getPlayerDirectoryLeaders(
  entries: readonly PlayerDirectoryEntry[],
  metric: PlayerDirectoryLeaderMetric,
  limit = 3,
): readonly PlayerDirectoryEntry[] {
  const sort: PlayerDirectorySort = metric
  return [...entries]
    .filter((entry) => valueFor(entry, sort) !== null)
    .sort((left, right) => compareDirectoryEntries(left, right, sort))
    .slice(0, limit)
}

export function formatPlayerForm(value: number | null | undefined): string {
  return value === null || value === undefined ? '—' : value.toFixed(1)
}

/** Shared desktop/mobile filtering plus deterministic rank- and score-aware sorting. */
export function selectPlayerDirectory(
  entries: readonly PlayerDirectoryEntry[],
  filters: PlayerDirectoryFilters,
): readonly PlayerDirectoryEntry[] {
  const query = filters.search.trim().toLocaleLowerCase()

  return [...entries]
    .filter((entry) => (
      (filters.position === 'ALL' || entry.player.position === filters.position)
      && (filters.ownership === 'ALL'
        || (filters.ownership === 'OWNED' && entry.ownerManagerId !== null)
        || (filters.ownership === 'FREE_AGENTS' && entry.ownerManagerId === null))
      && (query === ''
        || getPlayerDirectoryName(entry).toLocaleLowerCase().includes(query)
        || entry.ownerName.toLocaleLowerCase().includes(query))
    ))
    .sort((left, right) => compareDirectoryEntries(left, right, filters.sort))
}
