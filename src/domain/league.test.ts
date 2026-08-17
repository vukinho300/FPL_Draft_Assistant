import { describe, expect, it } from 'vitest'

import {
  DEFAULT_RESERVE_BUFFER,
  FPL_DRAFT_SQUAD_SIZE,
  MAX_LEAGUE_SIZE,
  MIN_LEAGUE_SIZE,
  ROSTER_REQUIREMENTS,
  calculateCandidateTargets,
  calculateRosterDemand,
  validateLeagueSize,
} from './league.ts'

describe('FPL Draft league rules', () => {
  it('records the official 15-player roster contract', () => {
    expect(ROSTER_REQUIREMENTS).toEqual({ GK: 2, DEF: 5, MID: 5, FWD: 3 })
    expect(Object.values(ROSTER_REQUIREMENTS).reduce((sum, count) => sum + count, 0)).toBe(
      FPL_DRAFT_SQUAD_SIZE,
    )
  })

  it('records the project reserve heuristic separately from official rules', () => {
    expect(DEFAULT_RESERVE_BUFFER).toBe(0.35)
  })
})

describe('league-size calculations', () => {
  it.each([
    {
      managers: 2,
      demand: { positions: { GK: 4, DEF: 10, MID: 10, FWD: 6 }, total: 30 },
      targets: { positions: { GK: 6, DEF: 14, MID: 14, FWD: 9 }, total: 43 },
    },
    {
      managers: 6,
      demand: { positions: { GK: 12, DEF: 30, MID: 30, FWD: 18 }, total: 90 },
      targets: { positions: { GK: 17, DEF: 41, MID: 41, FWD: 25 }, total: 124 },
    },
    {
      managers: 8,
      demand: { positions: { GK: 16, DEF: 40, MID: 40, FWD: 24 }, total: 120 },
      targets: { positions: { GK: 22, DEF: 54, MID: 54, FWD: 33 }, total: 163 },
    },
    {
      managers: 16,
      demand: { positions: { GK: 32, DEF: 80, MID: 80, FWD: 48 }, total: 240 },
      targets: { positions: { GK: 44, DEF: 108, MID: 108, FWD: 65 }, total: 325 },
    },
  ])('calculates per-position demand and targets for $managers managers', (example) => {
    expect(calculateRosterDemand(example.managers)).toEqual(example.demand)
    expect(calculateCandidateTargets(example.managers)).toEqual(example.targets)
  })

  it('accepts the minimum and maximum supported league sizes', () => {
    expect(() => validateLeagueSize(MIN_LEAGUE_SIZE)).not.toThrow()
    expect(() => validateLeagueSize(MAX_LEAGUE_SIZE)).not.toThrow()
  })

  it.each([1, 17, 6.5])('rejects invalid league size %s', (managerCount) => {
    expect(() => validateLeagueSize(managerCount)).toThrowError(
      expect.objectContaining({
        name: 'InvalidLeagueSizeError',
        received: managerCount,
        minimum: 2,
        maximum: 16,
      }),
    )
  })
})
