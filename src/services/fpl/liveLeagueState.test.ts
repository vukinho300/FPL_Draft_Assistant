import { describe, expect, it, vi } from 'vitest'

import type { LiveLeagueStandingsSnapshot } from '../../domain/liveLeagueStandings.ts'
import {
  getLiveLeagueRefreshIntervalMs,
  loadKileNOthersLiveLeagueState,
  LiveLeagueStateController,
  type RetrievedLiveLeagueState,
} from './liveLeagueState.ts'

function snapshot(
  eventId: number,
  phase: LiveLeagueStandingsSnapshot['gameweekState']['phase'] = 'ACTIVE',
  hasLiveFixture = true,
): LiveLeagueStandingsSnapshot {
  return {
    leagueId: 45938,
    eventId,
    gameweekState: {
      eventId,
      phase,
      deadlineTime: '2026-08-21T17:30:00Z',
      hasLiveFixture,
      allFixturesStarted: false,
      allFixturesFootballComplete: false,
      officialEventFinished: false,
      bootstrapEventFinished: false,
    },
    teamScores: Array.from({ length: 6 }, (_, index) => ({
      teamName: `Team ${index + 1}`,
      accountManagerName: `Manager ${index + 1}`,
      rosterManagerId: `manager-${index + 1}`,
      officialEntryId: index + 1,
      officialLeagueEntryId: index + 11,
      eventId,
      liveGameweekScore: 0,
      starters: [],
      bench: [],
      provenance: 'OFFICIAL_LINEUP_PLUS_OFFICIAL_LIVE_PLAYER_POINTS',
    })),
    seasonBaseline: {
      status: 'AVAILABLE',
      eventId,
      provenance: 'SEASON_START_ZERO',
      entries: [],
    },
    standings: { status: 'AVAILABLE', rows: [] },
    calculationStatus: 'PROVISIONAL',
    reconciliationStatus: 'NOT_PROVEN',
    freshness: {
      retrievedAt: '2026-08-24T12:00:00Z',
      staleAfterMs: 90_000,
    },
  }
}

function retrieved(eventId: number): RetrievedLiveLeagueState {
  return {
    snapshot: snapshot(eventId),
    nextEvent: null,
    ownership: { leagueId: 45938, elements: [] },
    eventStatus: { days: [], leagueTableStatus: null },
  }
}

describe('shared live league refresh foundation', () => {
  it('loads the project-owned browser contract instead of exposing official endpoints', async () => {
    const fetchImplementation = vi.fn(async () => Response.json(retrieved(1)))
    await expect(loadKileNOthersLiveLeagueState(fetchImplementation)).resolves.toMatchObject({
      snapshot: { leagueId: 45938, eventId: 1 },
    })
    expect(fetchImplementation).toHaveBeenCalledWith('/api/fpl-league-live', {
      headers: { accept: 'application/json' },
    })
  })

  it('rejects malformed ownership before it can reach the Gameweek view model', async () => {
    const valid = retrieved(1)
    const malformed = {
      ...valid,
      ownership: {
        ...valid.ownership,
        elements: [{
          elementId: '1',
          availability: 'OWNED',
          upstreamStatusCode: 'o',
          officialOwnerEntryId: null,
          inAcceptedTrade: false,
        }],
      },
    }
    await expect(loadKileNOthersLiveLeagueState(async () => Response.json(malformed))).rejects.toThrow(
      /project contract/,
    )
  })

  it('re-derives cached-response freshness from source time without replacing it with receipt time', async () => {
    const cachedBody = structuredClone(retrieved(1)) as RetrievedLiveLeagueState & {
      snapshot: { freshness: Record<string, unknown> }
    }
    cachedBody.snapshot.freshness.ageMs = 0
    cachedBody.snapshot.freshness.status = 'FRESH'
    let currentTime = new Date('2026-08-24T12:00:20Z')
    const controller = new LiveLeagueStateController({
      load: () => loadKileNOthersLiveLeagueState(async () => Response.json(cachedBody)),
      now: () => currentTime,
    })

    await controller.refresh()
    const received = controller.getState()
    expect(received.lastSuccessfulAt).toBe('2026-08-24T12:00:20.000Z')
    expect(received.data?.snapshot.freshness).toEqual({
      retrievedAt: '2026-08-24T12:00:00Z',
      staleAfterMs: 90_000,
    })
    expect(received.freshness).toMatchObject({
      retrievedAt: '2026-08-24T12:00:00Z',
      ageMs: 20_000,
      status: 'FRESH',
    })

    currentTime = new Date('2026-08-24T12:02:00Z')
    expect(controller.getState().freshness).toMatchObject({ ageMs: 120_000, status: 'STALE' })
  })

  it('uses an active-football cadence and backs off outside live play', () => {
    expect(getLiveLeagueRefreshIntervalMs(snapshot(1, 'ACTIVE', true))).toBe(30_000)
    expect(getLiveLeagueRefreshIntervalMs(snapshot(1, 'ACTIVE', false))).toBe(120_000)
    expect(getLiveLeagueRefreshIntervalMs(snapshot(1, 'FOOTBALL_COMPLETE', false))).toBe(300_000)
    expect(getLiveLeagueRefreshIntervalMs(snapshot(1, 'OFFICIAL_EVENT_MARKED_FINISHED', false))).toBe(300_000)
    expect(getLiveLeagueRefreshIntervalMs(snapshot(1, 'UPCOMING', false))).toBe(900_000)
  })

  it('does not let an older out-of-order response overwrite newer league state', async () => {
    const resolvers: Array<(value: RetrievedLiveLeagueState) => void> = []
    const controller = new LiveLeagueStateController({
      load: () => new Promise((resolve) => resolvers.push(resolve)),
      now: () => new Date('2026-08-24T12:00:00Z'),
    })

    const older = controller.refresh()
    const newer = controller.refresh()
    resolvers[1](retrieved(2))
    await newer
    expect(controller.getState()).toMatchObject({ status: 'READY', data: { snapshot: { eventId: 2 } } })

    resolvers[0](retrieved(1))
    await older
    expect(controller.getState()).toMatchObject({ status: 'READY', data: { snapshot: { eventId: 2 } } })
  })

  it('retains the last successful data and reports refresh errors truthfully', async () => {
    let shouldFail = false
    let currentTime = new Date('2026-08-24T12:00:30Z')
    const controller = new LiveLeagueStateController({
      load: async () => {
        if (shouldFail) throw new Error('upstream unavailable')
        return retrieved(1)
      },
      now: () => currentTime,
    })
    await controller.refresh()
    expect(controller.getState().freshness?.status).toBe('FRESH')
    shouldFail = true
    currentTime = new Date('2026-08-24T12:02:00Z')
    await controller.refresh()
    expect(controller.getState()).toMatchObject({
      status: 'ERROR',
      data: { snapshot: { eventId: 1 } },
      lastSuccessfulAt: '2026-08-24T12:00:30.000Z',
      errorMessage: 'upstream unavailable',
      freshness: { ageMs: 120_000, status: 'STALE' },
    })
  })
})
