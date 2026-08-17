import { describe, expect, it } from 'vitest'

import type { Player } from './player.ts'
import {
  filterAvailableRankedPlayers,
  OFFICIAL_RANK_WEIGHT,
  MODEL_RANK_WEIGHT,
  rankPlayersByMvpConsensus,
  type DraftRankingSignal,
} from './draftRanking.ts'

function player(id: string, rank: number | null, position: Player['position'] = 'MID'): Player {
  return {
    id,
    displayName: `Player ${id}`,
    position,
    club: { id: 'club', name: 'Club', shortName: 'CLU' },
    officialDraftRank: rank,
  }
}

function signal(id: string, rank: number | null, available = rank !== null): DraftRankingSignal {
  return {
    draftPlayerId: id,
    modelPredictedSeasonPoints: available ? 100 : null,
    modelRank: rank,
    modelPositionRank: rank,
    modelSignalAvailable: available,
    unavailableReason: available ? null : 'insufficient EPL history',
  }
}

describe('MVP consensus ranking', () => {
  it('uses exact 70/30 rank-percentile arithmetic without mutating official rank', () => {
    const players = [player('1', 1), player('2', 2), player('3', 3), player('4', 4)]
    const ranked = rankPlayersByMvpConsensus(players, [
      signal('1', 4),
      signal('2', 3),
      signal('3', 2),
      signal('4', 1),
    ])
    const secondEvidence = ranked.find(({ player: item }) => item.id === '2')
    expect(secondEvidence?.consensusScore).toBeCloseTo(
      OFFICIAL_RANK_WEIGHT * (2 / 3) + MODEL_RANK_WEIGHT * (1 / 3),
    )
    expect(players.map(({ officialDraftRank }) => officialDraftRank)).toEqual([1, 2, 3, 4])
  })

  it('falls back to 100% official rank when the model signal is missing', () => {
    const ranked = rankPlayersByMvpConsensus(
      [player('1', 1), player('2', 2), player('3', 3), player('4', 4)],
      [signal('1', null, false)],
    )
    expect(ranked[0].consensusScore).toBe(1)
    expect(ranked[1].consensusScore).toBeCloseTo(2 / 3)
    expect(ranked[2].consensusScore).toBeCloseTo(1 / 3)
    expect(ranked[3].consensusScore).toBe(0)
    expect(ranked[0].modelSignal?.modelSignalAvailable).toBe(false)
  })

  it('keeps cold-start and null-ranked players valid without treating missing history as zero quality', () => {
    const ranked = rankPlayersByMvpConsensus(
      [player('cold', 1), player('null', null)],
      [signal('cold', null, false)],
    )
    expect(ranked[0].player.id).toBe('cold')
    expect(ranked[0].consensusScore).toBe(1)
    expect(ranked[1].player.id).toBe('null')
  })

  it('uses deterministic name and ID ties', () => {
    const tied = [
      { ...player('b', 1), displayName: 'Same' },
      { ...player('a', 1), displayName: 'Same' },
      { ...player('c', 1), displayName: 'Alpha' },
    ]
    expect(rankPlayersByMvpConsensus(tied, []).map(({ player: item }) => item.id)).toEqual([
      'c',
      'a',
      'b',
    ])
  })

  it('filters by position and search and removes drafted players', () => {
    const ranked = rankPlayersByMvpConsensus(
      [player('1', 1, 'GK'), player('2', 2, 'FWD'), player('3', 3, 'FWD')],
      [],
    )
    expect(
      filterAvailableRankedPlayers(ranked, new Set(['2']), 'Player', 'FWD').map(
        ({ player: item }) => item.id,
      ),
    ).toEqual(['3'])
  })
})
