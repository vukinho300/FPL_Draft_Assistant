import { describe, expect, it } from 'vitest'

import { createDraftConfiguration, type Manager } from './manager.ts'
import type { Player, Position } from './player.ts'
import type { RankedDraftPlayer } from './draftRanking.ts'
import { filterAvailableRankedPlayers } from './draftRanking.ts'
import { generateSnakeDraftSchedule } from './draftSchedule.ts'
import { calculateBestFit, getBestFitScenario } from './bestFit.ts'

function managers(count: number): Manager[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `manager-${index + 1}`,
    displayName: `Manager ${index + 1}`,
  }))
}

function schedule(count: number) {
  const configured = managers(count)
  return generateSnakeDraftSchedule(createDraftConfiguration(configured, configured[0].id))
}

function ranked(id: string, position: Position, score: number, rank: number): RankedDraftPlayer {
  const player: Player = {
    id,
    displayName: id,
    position,
    club: { id: 'club', name: 'Club', shortName: 'CLU' },
    officialDraftRank: rank,
  }
  return {
    player,
    consensusRank: rank,
    consensusScore: score,
    officialRankPercentileScore: score,
    modelRankPercentileScore: null,
    modelSignal: null,
  }
}

function scarcityBoard(): RankedDraftPlayer[] {
  const deepGoalkeepers = Array.from({ length: 15 }, (_, index) =>
    ranked(`GK${index + 1}`, 'GK', 0.98 - index * 0.01, index + 1),
  )
  return [
    ...deepGoalkeepers.slice(0, 8),
    ranked('Scarce FWD', 'FWD', 0.9, 9),
    ranked('Near FWD', 'FWD', 0.89, 10),
    ...deepGoalkeepers.slice(8),
    ranked('Fallback FWD', 'FWD', 0.1, 18),
    ranked('MID1', 'MID', 0.09, 19),
    ranked('DEF1', 'DEF', 0.08, 20),
  ].map((item, index) => ({ ...item, consensusRank: index + 1 }))
}

describe('Best Fit', () => {
  it('may prefer scarce FWD over deep GK even when GK is empty', () => {
    const result = calculateBestFit(scarcityBoard(), [], schedule(6), 'manager-1', 0)
    expect(result.bestAvailable?.player.position).toBe('GK')
    expect(result.recommendations[0].rankedPlayer.player.id).toBe('Scarce FWD')
    expect(result.positionScenarios.map(({ position }) => position)).toEqual(['GK', 'DEF', 'MID', 'FWD'])
  })

  it('makes scarcity stronger over a longer Turn Horizon', () => {
    const board = scarcityBoard()
    const short = calculateBestFit(board, [], schedule(2), 'manager-1', 0)
    const long = calculateBestFit(board, [], schedule(6), 'manager-1', 0)
    const shortFwd = short.recommendations.find(({ rankedPlayer }) => rankedPlayer.player.position === 'FWD')
    const longFwd = long.recommendations.find(({ rankedPlayer }) => rankedPlayer.player.position === 'FWD')
    expect(longFwd?.facts.positionDropoff).toBeGreaterThan(shortFwd?.facts.positionDropoff ?? 0)
  })

  it('never recommends a full-roster position or a drafted player', () => {
    const board = scarcityBoard()
    const roster = [ranked('my-gk-1', 'GK', 0, 50).player, ranked('my-gk-2', 'GK', 0, 51).player]
    const available = filterAvailableRankedPlayers(board, new Set(['Scarce FWD']), '', 'ALL')
    const result = calculateBestFit(available, roster, schedule(6), 'manager-1', 0)
    expect(result.recommendations.some(({ rankedPlayer }) => rankedPlayer.player.position === 'GK')).toBe(false)
    expect(result.recommendations.some(({ rankedPlayer }) => rankedPlayer.player.id === 'Scarce FWD')).toBe(false)
  })

  it('works with official-only evidence', () => {
    const result = calculateBestFit(scarcityBoard(), [], schedule(6), 'manager-1', 0)
    expect(result.recommendations).toHaveLength(5)
    expect(result.recommendations.every(({ rankedPlayer }) => rankedPlayer.modelSignal === null)).toBe(true)
  })

  it('looks beyond a consecutive 12/13 turn to pick 24', () => {
    const scenario = getBestFitScenario(schedule(6), 'manager-1', 11)
    expect(scenario.upcomingUserTurnPickNumbers).toEqual([12, 13])
    expect(scenario.followingUserPickNumber).toBe(24)
    expect(scenario.opponentSelections).toBe(10)
  })

  it('emits deterministic facts and no unsupported probability fields', () => {
    const result = calculateBestFit(scarcityBoard(), [], schedule(6), 'manager-1', 0)
    expect(JSON.stringify(result)).not.toMatch(/probability|chance|survival/i)
  })
})
