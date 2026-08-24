import { describe, expect, it } from 'vitest'

import { normalizeFplDraftFixtures } from './fixtures.ts'
import { normalizeFplDraftLiveEvent } from './liveEvent.ts'

function rawFixture() {
  return {
    id: 10,
    event: 1,
    kickoff_time: '2026-08-24T19:00:00Z',
    started: true,
    finished: false,
    finished_provisional: false,
    provisional_start_time: false,
    minutes: 62,
    team_h: 3,
    team_a: 4,
    team_h_score: 1,
    team_a_score: 0,
    stats: [
      { s: 'goals_scored', h: [{ element: 101, value: 1 }], a: [] },
      { s: 'assists', h: [{ element: 102, value: 1 }], a: [] },
      { s: 'penalties_saved', h: [], a: [] },
      { s: 'yellow_cards', h: [], a: [{ element: 103, value: 1 }] },
    ],
  }
}

function stats(overrides: Record<string, unknown> = {}) {
  return {
    minutes: 62,
    starts: 1,
    goals_scored: 1,
    assists: 0,
    clean_sheets: 0,
    goals_conceded: 0,
    own_goals: 0,
    penalties_saved: 0,
    penalties_missed: 0,
    yellow_cards: 0,
    red_cards: 0,
    saves: 0,
    bonus: 2,
    bps: 29,
    defensive_contribution: 5,
    total_points: 8,
    in_dreamteam: true,
    ...overrides,
  }
}

describe('FPL Draft live event and fixture contracts', () => {
  it('normalizes live player points and the verified scoring-event fields', () => {
    const live = normalizeFplDraftLiveEvent({
      elements: { '101': { explain: [], stats: stats() } },
      fixtures: [rawFixture()],
    }, 1)

    expect(live.players).toEqual([{
      elementId: '101',
      stats: {
        minutes: 62,
        starts: 1,
        goalsScored: 1,
        assists: 0,
        cleanSheets: 0,
        goalsConceded: 0,
        ownGoals: 0,
        penaltiesSaved: 0,
        penaltiesMissed: 0,
        yellowCards: 0,
        redCards: 0,
        saves: 0,
        bonus: 2,
        bonusPointsSystem: 29,
        defensiveContribution: 5,
        totalPoints: 8,
        inDreamTeam: true,
      },
    }])
    expect(live.fixtures[0]).toMatchObject({
      fixtureId: 10,
      eventId: 1,
      started: true,
      finishedProvisional: false,
      homeScore: 1,
      awayScore: 0,
    })
  })

  it('normalizes fixture event facts and player-side event attribution', () => {
    const fixture = normalizeFplDraftFixtures([rawFixture()], 1)[0]
    expect(fixture.stats.map(({ identifier }) => identifier)).toEqual([
      'goals_scored',
      'assists',
      'penalties_saved',
      'yellow_cards',
    ])
    expect(fixture.stats[0].home).toEqual([{ elementId: '101', value: 1 }])
    expect(fixture.stats[3].away).toEqual([{ elementId: '103', value: 1 }])
  })

  it('rejects malformed numeric scoring values and contradictory fixture events', () => {
    expect(() => normalizeFplDraftLiveEvent({
      elements: { '101': { stats: stats({ total_points: '8' }) } },
      fixtures: [rawFixture()],
    }, 1)).toThrow(/total_points must be an integer/)
    expect(() => normalizeFplDraftFixtures([{ ...rawFixture(), event: 2 }], 1)).toThrow(
      /references event 2 instead of 1/,
    )
  })
})
