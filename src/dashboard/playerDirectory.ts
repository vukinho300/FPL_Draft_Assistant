import type { Position } from '../domain/player.ts'
import {
  rankPlayersByMvpConsensus,
  type DraftRankingSignal,
} from '../domain/draftRanking.ts'
import type { PlayerOwnershipEntry } from '../domain/transactions.ts'

export type PlayerOwnershipFilter = 'ALL' | 'FREE_AGENTS' | 'OWNED'
export const PLAYER_OWNERSHIP_FILTERS = ['ALL', 'FREE_AGENTS', 'OWNED'] as const

export type PlayerDirectorySort = 'OFFICIAL' | 'MVP' | 'MODEL'
export const PLAYER_DIRECTORY_SORTS = ['OFFICIAL', 'MVP', 'MODEL'] as const

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

function rankFor(entry: PlayerDirectoryEntry, sort: PlayerDirectorySort): number | null {
  if (sort === 'OFFICIAL') return entry.player.officialDraftRank
  if (sort === 'MVP') return entry.mvpConsensusRank
  return entry.draftModelRank
}

function compareDirectoryEntries(
  left: PlayerDirectoryEntry,
  right: PlayerDirectoryEntry,
  sort: PlayerDirectorySort,
): number {
  const leftRank = rankFor(left, sort)
  const rightRank = rankFor(right, sort)
  if (leftRank !== null && rightRank === null) return -1
  if (leftRank === null && rightRank !== null) return 1
  if (leftRank !== null && rightRank !== null && leftRank !== rightRank) return leftRank - rightRank

  return getPlayerDirectoryName(left).localeCompare(getPlayerDirectoryName(right))
    || left.player.id.localeCompare(right.player.id)
}

/** Shared desktop/mobile player-directory filtering and deterministic best-rank-first sorting. */
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
