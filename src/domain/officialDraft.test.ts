import { describe, expect, it } from 'vitest'

import { officialDraft202627 } from '../data/leagues/kile-n-others/officialDraft2026-27.ts'
import { POSITION_ORDER, ROSTER_REQUIREMENTS } from './league.ts'
import { restoreValidatedDraftPicks, validateOfficialDraftSnapshot } from './officialDraft.ts'

describe('Kile N Others immutable official draft', () => {
  it('validates 90 unique scheduled picks and six complete legal rosters', () => {
    expect(() => validateOfficialDraftSnapshot(officialDraft202627)).not.toThrow()
    expect(officialDraft202627.picks).toHaveLength(90)
    expect(officialDraft202627.picks.map(({ overallPickNumber }) => overallPickNumber)).toEqual(
      Array.from({ length: 90 }, (_, index) => index + 1),
    )
    expect(new Set(officialDraft202627.picks.map(({ draftPlayerId }) => draftPlayerId))).toHaveLength(90)
    expect(officialDraft202627.finalRosters).toHaveLength(6)
    officialDraft202627.finalRosters.forEach((roster) => {
      expect(roster.players).toHaveLength(15)
      expect(roster.positionCounts).toEqual(ROSTER_REQUIREMENTS)
      POSITION_ORDER.forEach((position) => {
        expect(roster.players.filter((player) => player.position === position)).toHaveLength(
          ROSTER_REQUIREMENTS[position],
        )
      })
    })
  })

  it('cannot be mutated through its exported nested structures', () => {
    expect(Object.isFrozen(officialDraft202627)).toBe(true)
    expect(Object.isFrozen(officialDraft202627.picks)).toBe(true)
    expect(Object.isFrozen(officialDraft202627.finalRosters[0].players)).toBe(true)
    expect(() => {
      ;(officialDraft202627.picks as unknown as unknown[]).push({})
    }).toThrow()
  })

  it('restores a validated DraftPick array only when explicitly requested', () => {
    const picks = restoreValidatedDraftPicks(officialDraft202627)
    expect(picks).toHaveLength(90)
    expect(picks[0]).toEqual({
      overallPickNumber: 1,
      roundNumber: 1,
      managerId: 'demo-manager-1',
      playerId: '411',
    })
    expect(Object.isFrozen(picks)).toBe(true)
  })
})
