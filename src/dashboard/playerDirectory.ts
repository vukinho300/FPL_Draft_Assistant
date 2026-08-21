import type { Position } from '../domain/player.ts'
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

export function getPlayerDirectoryName(entry: PlayerOwnershipEntry): string {
  return entry.player.fullName ?? entry.player.displayName
}

function rankFor(entry: PlayerOwnershipEntry, sort: PlayerDirectorySort): number | null {
  if (sort === 'OFFICIAL') return entry.player.officialDraftRank
  if (sort === 'MVP') return entry.draftDayMvpRank
  return entry.modelRankAtDraft
}

function compareDirectoryEntries(
  left: PlayerOwnershipEntry,
  right: PlayerOwnershipEntry,
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
  entries: readonly PlayerOwnershipEntry[],
  filters: PlayerDirectoryFilters,
): readonly PlayerOwnershipEntry[] {
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
