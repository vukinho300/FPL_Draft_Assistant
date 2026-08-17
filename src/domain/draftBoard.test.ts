import { describe, expect, it } from 'vitest'

import type { Player, Position } from './player.ts'
import {
  InsufficientCandidatePlayersError,
  buildDraftBoard,
  comparePlayersByOfficialDraftRank,
  rankPlayers,
} from './draftBoard.ts'
import { POSITION_ORDER, calculateCandidateTargets } from './league.ts'

const testClub = { id: 'test-club', name: 'Test Club', shortName: 'TST' }

function player(
  id: string,
  position: Position,
  officialDraftRank: number | null,
  displayName = `Player ${id}`,
): Player {
  return { id, position, officialDraftRank, displayName, club: testClub }
}

function sufficientPlayers(managerCount: number): Player[] {
  const targets = calculateCandidateTargets(managerCount)
  let rank = 1

  return POSITION_ORDER.flatMap((position) =>
    Array.from({ length: targets.positions[position] + 2 }, (_, index) => {
      const result = player(
        `${position}-${String(index + 1).padStart(3, '0')}`,
        position,
        rank,
      )
      rank += 1
      return result
    }),
  )
}

describe('official-rank-based ordering', () => {
  it('orders ranks, duplicate ranks, and null ranks deterministically', () => {
    const players = [
      player('null-b', 'MID', null, 'Beta'),
      player('rank-two', 'GK', 2, 'Keeper'),
      player('rank-one-z', 'FWD', 1, 'Zulu'),
      player('null-a-2', 'MID', null, 'Alpha'),
      player('rank-one-a', 'DEF', 1, 'Alpha'),
      player('null-a-1', 'MID', null, 'Alpha'),
    ]

    expect([...players].sort(comparePlayersByOfficialDraftRank).map(({ id }) => id)).toEqual([
      'rank-one-a',
      'rank-one-z',
      'rank-two',
      'null-a-1',
      'null-a-2',
      'null-b',
    ])
  })

  it('derives position rank from the same deterministic ordering', () => {
    const ranked = rankPlayers([
      player('fwd-2', 'FWD', 8),
      player('def-1', 'DEF', 2),
      player('fwd-1', 'FWD', 4),
      player('def-2', 'DEF', null),
    ])

    expect(ranked.map(({ player: rankedPlayer, positionRank }) => [rankedPlayer.id, positionRank]))
      .toEqual([
        ['def-1', 1],
        ['fwd-1', 1],
        ['fwd-2', 2],
        ['def-2', 2],
      ])
  })
})

describe('buildDraftBoard', () => {
  it('selects each positional pool, combines it in global order, and marks core demand', () => {
    const board = buildDraftBoard(sufficientPlayers(2).reverse(), 2)

    expect(board.rosterDemand).toEqual({
      positions: { GK: 4, DEF: 10, MID: 10, FWD: 6 },
      total: 30,
    })
    expect(board.candidateTargets).toEqual({
      positions: { GK: 6, DEF: 14, MID: 14, FWD: 9 },
      total: 43,
    })
    expect(board.entries).toHaveLength(43)

    for (const position of POSITION_ORDER) {
      const entries = board.entries.filter(({ player: entryPlayer }) =>
        entryPlayer.position === position,
      )
      expect(entries).toHaveLength(board.candidateTargets.positions[position])
      expect(entries.filter(({ insideCoreDemand }) => insideCoreDemand)).toHaveLength(
        board.rosterDemand.positions[position],
      )
      expect(entries.at(-1)).toMatchObject({
        positionRank: board.candidateTargets.positions[position],
        positionDemand: board.rosterDemand.positions[position],
        positionCandidateTarget: board.candidateTargets.positions[position],
        insideCoreDemand: false,
      })
    }

    expect(board.entries.map(({ player: entryPlayer }) => entryPlayer.officialDraftRank)).toEqual(
      [...board.entries]
        .sort((left, right) =>
          comparePlayersByOfficialDraftRank(left.player, right.player),
        )
        .map(({ player: entryPlayer }) => entryPlayer.officialDraftRank),
    )
  })

  it('reports the position, required target, and available count when data is insufficient', () => {
    const players = sufficientPlayers(2).filter(
      ({ position, id }) => position !== 'FWD' || Number(id.slice(-3)) <= 8,
    )

    expect(() => buildDraftBoard(players, 2)).toThrowError(
      expect.objectContaining({
        name: 'InsufficientCandidatePlayersError',
        position: 'FWD',
        requiredCandidateCount: 9,
        availablePlayerCount: 8,
      }) satisfies Partial<InsufficientCandidatePlayersError>,
    )
  })

  it('does not mutate the supplied Player array', () => {
    const players = sufficientPlayers(2).reverse()
    const originalIds = players.map(({ id }) => id)

    rankPlayers(players)
    buildDraftBoard(players, 2)

    expect(players.map(({ id }) => id)).toEqual(originalIds)
  })
})
