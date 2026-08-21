import { describe, expect, it } from 'vitest'

import type { PlayerOwnershipEntry } from '../domain/transactions.ts'
import { selectPlayerDirectory } from './playerDirectory.ts'

function entry({
  id,
  fullName,
  position = 'MID',
  ownerManagerId = null,
  ownerName = 'FREE AGENT',
  officialDraftRank = null,
  draftDayMvpRank = null,
  modelRankAtDraft = null,
}: {
  readonly id: string
  readonly fullName: string
  readonly position?: 'GK' | 'DEF' | 'MID' | 'FWD'
  readonly ownerManagerId?: string | null
  readonly ownerName?: string | 'FREE AGENT'
  readonly officialDraftRank?: number | null
  readonly draftDayMvpRank?: number | null
  readonly modelRankAtDraft?: number | null
}): PlayerOwnershipEntry {
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
    draftDayMvpRank,
    modelRankAtDraft,
  }
}

const directory = [
  entry({ id: 'owned-gk', fullName: 'Alana Keeper', position: 'GK', ownerManagerId: 'vuk', ownerName: 'Vuk', officialDraftRank: 8, draftDayMvpRank: 4, modelRankAtDraft: 6 }),
  entry({ id: 'free-gk', fullName: 'Ben Keeper', position: 'GK', officialDraftRank: 3, draftDayMvpRank: 2, modelRankAtDraft: null }),
  entry({ id: 'owned-mid', fullName: 'Chris Midfielder', ownerManagerId: 'diego', ownerName: 'Diego', officialDraftRank: 5, draftDayMvpRank: 6, modelRankAtDraft: 2 }),
  entry({ id: 'free-mid', fullName: 'Dani Midfielder', officialDraftRank: null, draftDayMvpRank: null, modelRankAtDraft: null }),
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
})
