import { describe, expect, it } from 'vitest'

import { POSITION_DROPOFF_WEIGHT } from './bestFit.ts'
import { calculateBestPair } from './bestPair.ts'
import type { RankedDraftPlayer } from './draftRanking.ts'
import { createDraftConfiguration, type Manager } from './manager.ts'
import type { Player, Position } from './player.ts'
import { generateSnakeDraftSchedule } from './draftSchedule.ts'

function managers(count: number): Manager[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `manager-${index + 1}`,
    displayName: `Manager ${index + 1}`,
  }))
}

function schedule(count: number) {
  const configured = managers(count)
  return generateSnakeDraftSchedule(
    createDraftConfiguration(configured, configured[0].id),
  )
}

function ranked(
  id: string,
  position: Position,
  score: number,
  rank: number,
): RankedDraftPlayer {
  return {
    player: {
      id,
      displayName: id,
      position,
      club: { id: 'club', name: 'Club', shortName: 'CLU' },
      officialDraftRank: rank,
    },
    consensusRank: rank,
    consensusScore: score,
    officialRankPercentileScore: score,
    modelRankPercentileScore: null,
    modelSignal: null,
  }
}

function board(entries: readonly [string, Position, number][]): RankedDraftPlayer[] {
  return entries.map(([id, position, score], index) =>
    ranked(id, position, score, index + 1),
  )
}

function fillerBoard(): RankedDraftPlayer[] {
  const positions: Position[] = ['GK', 'DEF', 'MID', 'FWD']
  return Array.from({ length: 20 }, (_, index) =>
    ranked(
      `Player ${index + 1}`,
      positions[index % positions.length],
      1 - index * 0.03,
      index + 1,
    ),
  )
}

function roster(position: Position, count: number): Player[] {
  return Array.from({ length: count }, (_, index) =>
    ranked(`Roster ${position} ${index + 1}`, position, 0, 100 + index).player,
  )
}

describe('Best Pair', () => {
  it('is inactive at Pick 1 and after the first pick of a 12/13 turn', () => {
    expect(calculateBestPair(fillerBoard(), [], schedule(6), 'manager-1', 0).active).toBe(false)
    const afterPick12 = calculateBestPair(
      fillerBoard(),
      [],
      schedule(6),
      'manager-1',
      12,
    )
    expect(afterPick12.active).toBe(false)
    expect(afterPick12.scenario.currentUserTurnPickNumbers).toEqual([13])
  })

  it('uses the real six-manager Pick 12/13 horizon through Pick 24', () => {
    const result = calculateBestPair(
      fillerBoard(),
      [],
      schedule(6),
      'manager-1',
      11,
    )
    expect(result.active).toBe(true)
    expect(result.scenario.currentUserTurnPickNumbers).toEqual([12, 13])
    expect(result.scenario.followingUserPickNumber).toBe(24)
    expect(result.scenario.opponentSelections).toBe(10)
    expect(result.shortlistSize).toBe(15)
    expect(result.recommendations).toHaveLength(5)
  })

  it('beats a greedy top-two choice when joint scarcity justifies another pair', () => {
    const players = board([
      ['Top GK', 'GK', 0.99],
      ['Deep DEF', 'DEF', 0.98],
      ['Scarce FWD', 'FWD', 0.95],
      ['GK replacement', 'GK', 0.94],
      ['DEF replacement', 'DEF', 0.93],
      ['MID 1', 'MID', 0.92],
      ['MID 2', 'MID', 0.91],
      ['GK 3', 'GK', 0.9],
      ['DEF 3', 'DEF', 0.89],
      ['MID 3', 'MID', 0.88],
      ['GK 4', 'GK', 0.87],
      ['FWD fallback', 'FWD', 0.1],
      ['DEF 4', 'DEF', 0.09],
      ['MID 4', 'MID', 0.08],
    ])
    const result = calculateBestPair(players, [], schedule(2), 'manager-1', 3)
    const selectedIds = result.recommendations[0].rankedPlayers.map(({ player }) => player.id)
    expect(selectedIds).not.toEqual(['Top GK', 'Deep DEF'])
    expect(result.recommendations[0].pairScarcity).toBeGreaterThan(0)
  })

  it('compares two same-position selections with two separate replacement slots', () => {
    const players = board([
      ['FWD A', 'FWD', 0.9],
      ['FWD B', 'FWD', 0.8],
      ['GK A', 'GK', 0.7],
      ['MID A', 'MID', 0.65],
      ['FWD replacement 1', 'FWD', 0.4],
      ['FWD replacement 2', 'FWD', 0.3],
      ['DEF A', 'DEF', 0.29],
      ['GK B', 'GK', 0.28],
      ['MID B', 'MID', 0.27],
      ['DEF B', 'DEF', 0.26],
      ['GK C', 'GK', 0.25],
      ['MID C', 'MID', 0.24],
    ])
    const result = calculateBestPair(players, [], schedule(2), 'manager-1', 3)
    const samePosition = result.recommendations.find(
      ({ rankedPlayers }) => rankedPlayers.every(({ player }) => player.position === 'FWD'),
    )
    expect(samePosition).toBeDefined()
    const facts = samePosition?.positionFacts[0]
    expect(facts?.selectedConsensusScores).toEqual([0.9, 0.8])
    expect(facts?.replacementConsensusScores).toEqual([0.4, 0.3])
    expect(facts?.jointPositionDropoff).toBeCloseTo(1)
    expect(samePosition?.bestPairScore).toBeCloseTo(1.7 + POSITION_DROPOFF_WEIGHT)
  })

  it('rejects pair-level roster-cap violations', () => {
    const players = fillerBoard()
    const fourDef = calculateBestPair(
      players,
      roster('DEF', 4),
      schedule(6),
      'manager-1',
      11,
      100,
    )
    expect(
      fourDef.recommendations.some(({ rankedPlayers }) =>
        rankedPlayers.every(({ player }) => player.position === 'DEF'),
      ),
    ).toBe(false)

    const twoGk = calculateBestPair(
      players,
      roster('GK', 2),
      schedule(6),
      'manager-1',
      11,
      100,
    )
    expect(
      twoGk.recommendations.some(({ rankedPlayers }) =>
        rankedPlayers.some(({ player }) => player.position === 'GK'),
      ),
    ).toBe(false)

    const fourMid = calculateBestPair(
      players,
      roster('MID', 4),
      schedule(6),
      'manager-1',
      11,
      100,
    )
    expect(
      fourMid.recommendations.some(({ rankedPlayers }) =>
        rankedPlayers.every(({ player }) => player.position === 'MID'),
      ),
    ).toBe(false)
    expect(
      fourMid.recommendations.some(({ rankedPlayers }) => {
        const positions = rankedPlayers.map(({ player }) => player.position)
        return positions.includes('MID') && positions.includes('FWD')
      }),
    ).toBe(true)
  })

  it.each([2, 6, 16])(
    'derives consecutive turns and following horizons for %i managers',
    (managerCount) => {
      const completedPickCount = managerCount * 2 - 1
      const result = calculateBestPair(
        fillerBoard(),
        [],
        schedule(managerCount),
        'manager-1',
        completedPickCount,
      )
      expect(result.active).toBe(true)
      expect(result.scenario.currentUserTurnPickNumbers).toEqual([
        managerCount * 2,
        managerCount * 2 + 1,
      ])
      expect(result.scenario.followingUserPickNumber).toBe(managerCount * 4)
      expect(result.scenario.opponentSelections).toBe(managerCount * 2 - 2)
    },
  )

  it('does not mutate supplied board or roster arrays or emit probability language', () => {
    const players = fillerBoard()
    const userRoster = roster('DEF', 1)
    const playerIds = players.map(({ player }) => player.id)
    const rosterIds = userRoster.map(({ id }) => id)
    const result = calculateBestPair(
      players,
      userRoster,
      schedule(6),
      'manager-1',
      11,
    )
    expect(players.map(({ player }) => player.id)).toEqual(playerIds)
    expect(userRoster.map(({ id }) => id)).toEqual(rosterIds)
    expect(JSON.stringify(result)).not.toMatch(/probability|chance|likely|survival/i)
  })
})
