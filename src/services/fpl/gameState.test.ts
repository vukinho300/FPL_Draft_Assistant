import { describe, expect, it } from 'vitest'

import { FplDataError } from './errors.ts'
import { normalizeFplDraftFixtures } from './fixtures.ts'
import {
  deriveFplDraftGameweekState,
  normalizeFplDraftEventSchedule,
  normalizeFplDraftEventStatus,
  normalizeFplDraftGame,
} from './gameState.ts'

function rawFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    event: 1,
    kickoff_time: '2026-08-21T19:00:00Z',
    started: false,
    finished: false,
    finished_provisional: false,
    provisional_start_time: false,
    minutes: 0,
    team_h: 1,
    team_a: 2,
    team_h_score: null,
    team_a_score: null,
    stats: [],
    ...overrides,
  }
}

const rawGame = {
  current_event: 1,
  current_event_finished: false,
  next_event: 2,
  processing_status: 'n',
  trades_time_for_approval: true,
  waivers_processed: false,
}

const rawSchedule = {
  events: {
    current: 1,
    next: 2,
    data: [{
      id: 1,
      name: 'Gameweek 1',
      deadline_time: '2026-08-21T17:30:00Z',
      trades_time: '2026-08-19T17:30:00Z',
      waivers_time: '2026-08-20T17:30:00Z',
      finished: false,
    }],
  },
}

describe('FPL Draft Gameweek state contracts', () => {
  it('normalizes current event identity, deadlines, and official daily status codes', () => {
    expect(normalizeFplDraftGame(rawGame)).toMatchObject({
      currentEventId: 1,
      currentEventFinished: false,
      nextEventId: 2,
      processingStatus: 'n',
    })
    expect(normalizeFplDraftEventSchedule(rawSchedule).events[0]).toMatchObject({
      eventId: 1,
      deadlineTime: '2026-08-21T17:30:00Z',
    })
    expect(normalizeFplDraftEventStatus({
      status: [
        { bonus_added: false, date: '2026-08-21', event: 1, leagues_updated: true, points: 'l' },
        { bonus_added: true, date: '2026-08-22', event: 1, leagues_updated: true, points: 'r' },
      ],
      leagues: 'Updated',
    })).toEqual({
      days: [
        { bonusAdded: false, date: '2026-08-21', eventId: 1, leaguesUpdated: true, pointsStatus: 'LIVE' },
        { bonusAdded: true, date: '2026-08-22', eventId: 1, leaguesUpdated: true, pointsStatus: 'CONFIRMED' },
      ],
      leagueTableStatus: 'Updated',
    })
  })

  it('derives phases only from official event and fixture facts', () => {
    const game = normalizeFplDraftGame(rawGame)
    const event = normalizeFplDraftEventSchedule(rawSchedule).events[0]
    expect(deriveFplDraftGameweekState(
      game,
      event,
      normalizeFplDraftFixtures([rawFixture()], 1),
    ).phase).toBe('UPCOMING')
    expect(deriveFplDraftGameweekState(
      game,
      event,
      normalizeFplDraftFixtures([rawFixture({ started: true })], 1),
    )).toMatchObject({ phase: 'ACTIVE', hasLiveFixture: true })
    expect(deriveFplDraftGameweekState(
      game,
      event,
      normalizeFplDraftFixtures([rawFixture({ started: true, finished_provisional: true })], 1),
    ).phase).toBe('FOOTBALL_COMPLETE')
    const eventMarkedFinished = deriveFplDraftGameweekState(
      normalizeFplDraftGame({ ...rawGame, current_event_finished: true }),
      event,
      normalizeFplDraftFixtures([rawFixture({ started: true, finished: true })], 1),
    )
    expect(eventMarkedFinished).toMatchObject({
      phase: 'OFFICIAL_EVENT_MARKED_FINISHED',
      officialEventFinished: true,
      bootstrapEventFinished: false,
    })
    expect(eventMarkedFinished.phase).not.toContain('FINALIZED')

    const bootstrapMarkedFinished = normalizeFplDraftEventSchedule({
      events: {
        ...rawSchedule.events,
        data: [{ ...rawSchedule.events.data[0], finished: true }],
      },
    }).events[0]
    expect(deriveFplDraftGameweekState(
      game,
      bootstrapMarkedFinished,
      normalizeFplDraftFixtures([rawFixture({ started: true, finished: true })], 1),
    )).toMatchObject({
      phase: 'FOOTBALL_COMPLETE',
      officialEventFinished: false,
      bootstrapEventFinished: true,
    })
  })

  it('fails closed for unknown status codes and contradictory event identity', () => {
    expect(() => normalizeFplDraftEventStatus({
      status: [{ bonus_added: false, date: '2026-08-21', event: 1, leagues_updated: false, points: 'x' }],
      leagues: '',
    })).toThrowError(FplDataError)
    expect(() => deriveFplDraftGameweekState(
      normalizeFplDraftGame({ ...rawGame, current_event: 2 }),
      normalizeFplDraftEventSchedule(rawSchedule).events[0],
      normalizeFplDraftFixtures([rawFixture()], 1),
    )).toThrow(/does not match/)
  })
})
