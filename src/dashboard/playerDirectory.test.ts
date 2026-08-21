import { describe, expect, it } from 'vitest'

import type { DraftRankingSignal } from '../domain/draftRanking.ts'
import type { PlayerOwnershipEntry } from '../domain/transactions.ts'
import {
  buildRankedPlayerDirectory,
  selectPlayerDirectory,
  type PlayerDirectoryEntry,
} from './playerDirectory.ts'

function entry({
  id,
  fullName,
  position = 'MID',
  ownerManagerId = null,
  ownerName = 'FREE AGENT',
  officialDraftRank = null,
  mvpConsensusRank = 1,
  draftModelRank = null,
  draftModelUnavailableReason = draftModelRank === null ? 'unavailable' : null,
}: {
  readonly id: string
  readonly fullName: string
  readonly position?: 'GK' | 'DEF' | 'MID' | 'FWD'
  readonly ownerManagerId?: string | null
  readonly ownerName?: string | 'FREE AGENT'
  readonly officialDraftRank?: number | null
  readonly mvpConsensusRank?: number
  readonly draftModelRank?: number | null
  readonly draftModelUnavailableReason?: string | null
}): PlayerDirectoryEntry {
  return {
    player: {
      id,
      displayName: fullName.split(' ').at(-1) ?? fullName,
      fullName,
      position,
      club: { id: 'club', name: 'Fixture Club', shortName: 'FIX' },
      officialDraftRank,
    },
    ownerManagerId,
    ownerName,
    originalDraftPick: null,
    mvpConsensusRank,
    draftModelRank,
    draftModelUnavailableReason,
  }
}

const directory = [
  entry({ id: 'owned-gk', fullName: 'Alana Keeper', position: 'GK', ownerManagerId: 'vuk', ownerName: 'Vuk', officialDraftRank: 8, mvpConsensusRank: 4, draftModelRank: 6 }),
  entry({ id: 'free-gk', fullName: 'Ben Keeper', position: 'GK', officialDraftRank: 3, mvpConsensusRank: 2, draftModelRank: null }),
  entry({ id: 'owned-mid', fullName: 'Chris Midfielder', ownerManagerId: 'diego', ownerName: 'Diego', officialDraftRank: 5, mvpConsensusRank: 6, draftModelRank: 2 }),
  entry({ id: 'free-mid', fullName: 'Dani Midfielder', officialDraftRank: null, mvpConsensusRank: 7, draftModelRank: null }),
] as const

function select(overrides: Partial<Parameters<typeof selectPlayerDirectory>[1]> = {}) {
  return selectPlayerDirectory(directory, {
    search: '',
    position: 'ALL',
    ownership: 'ALL',
    sort: 'OFFICIAL',
    ...overrides,
  })
}

describe('shared player directory selector', () => {
  it('joins full-pool model evidence by exact Draft player ID and ranks free agents too', () => {
    const ownership: PlayerOwnershipEntry[] = directory.map(({
      mvpConsensusRank: _mvpConsensusRank,
      draftModelRank: _draftModelRank,
      ...entry
    }) => entry)
    const signals: DraftRankingSignal[] = [
      { draftPlayerId: 'owned-gk', modelPredictedSeasonPoints: 100, modelRank: 2, modelPositionRank: 1, modelSignalAvailable: true, unavailableReason: null },
      { draftPlayerId: 'free-gk', modelPredictedSeasonPoints: 110, modelRank: 1, modelPositionRank: 1, modelSignalAvailable: true, unavailableReason: null },
      { draftPlayerId: 'owned-mid', modelPredictedSeasonPoints: null, modelRank: null, modelPositionRank: null, modelSignalAvailable: false, unavailableReason: 'insufficient EPL history' },
    ]

    const ranked = buildRankedPlayerDirectory(ownership, signals)

    expect(ranked).toHaveLength(4)
    expect(new Set(ranked.map(({ mvpConsensusRank }) => mvpConsensusRank))).toEqual(new Set([1, 2, 3, 4]))
    expect(ranked.find(({ player }) => player.id === 'free-gk')?.draftModelRank).toBe(1)
    expect(ranked.find(({ player }) => player.id === 'owned-mid')?.draftModelRank).toBeNull()
    expect(ranked.find(({ player }) => player.id === 'owned-mid')?.draftModelUnavailableReason).toBe('insufficient EPL history')
    expect(ranked.find(({ player }) => player.id === 'free-mid')?.draftModelUnavailableReason).toBe('no frozen 2026/27 draft model signal')
  })

  it('searches the normalized full player name', () => {
    expect(select({ search: 'Alana' }).map(({ player }) => player.id)).toEqual(['owned-gk'])
  })

  it('composes position, ownership, and search filters', () => {
    expect(select({ position: 'GK', ownership: 'FREE_AGENTS' }).map(({ player }) => player.id)).toEqual(['free-gk'])
    expect(select({ search: 'Chris', position: 'MID', ownership: 'OWNED' }).map(({ player }) => player.id)).toEqual(['owned-mid'])
  })

  it('sorts each trusted rank best first and leaves missing ranks after ranked players', () => {
    expect(select({ sort: 'OFFICIAL' }).map(({ player }) => player.id)).toEqual(['free-gk', 'owned-mid', 'owned-gk', 'free-mid'])
    expect(select({ sort: 'MVP' }).map(({ player }) => player.id)).toEqual(['free-gk', 'owned-gk', 'owned-mid', 'free-mid'])
    expect(select({ sort: 'MODEL' }).map(({ player }) => player.id)).toEqual(['owned-mid', 'owned-gk', 'free-gk', 'free-mid'])
  })

  it('uses full name then stable ID as deterministic rank tie-breakers', () => {
    const tied = [
      entry({ id: 'b', fullName: 'Same Name', officialDraftRank: 1 }),
      entry({ id: 'a', fullName: 'Same Name', officialDraftRank: 1 }),
      entry({ id: 'c', fullName: 'Alpha Name', officialDraftRank: 1 }),
    ]
    expect(selectPlayerDirectory(tied, { search: '', position: 'ALL', ownership: 'ALL', sort: 'OFFICIAL' }).map(({ player }) => player.id)).toEqual(['c', 'a', 'b'])
  })

  it('compares rank values numerically rather than lexicographically', () => {
    const numericRanks = [
      entry({ id: '100', fullName: 'Rank One Hundred', officialDraftRank: 100 }),
      entry({ id: '10', fullName: 'Rank Ten', officialDraftRank: 10 }),
      entry({ id: '2', fullName: 'Rank Two', officialDraftRank: 2 }),
      entry({ id: 'none', fullName: 'Unranked', officialDraftRank: null }),
    ]
    expect(selectPlayerDirectory(numericRanks, { search: '', position: 'ALL', ownership: 'ALL', sort: 'OFFICIAL' }).map(({ player }) => player.id)).toEqual(['2', '10', '100', 'none'])
  })
})
