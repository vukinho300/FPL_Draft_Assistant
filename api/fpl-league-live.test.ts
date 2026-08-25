import type { IncomingMessage, ServerResponse } from 'node:http'
import { describe, expect, it, vi } from 'vitest'

import type { RetrievedLiveLeagueState } from '../src/services/fpl/liveLeagueState.ts'
import { FplDataError } from '../src/services/fpl/errors.ts'
import { createFplLeagueLiveHandler } from './fpl-league-live.ts'

interface CapturedResponse {
  body: string
  headers: Map<string, string>
  statusCode: number
}

function createResponse(): CapturedResponse & ServerResponse {
  const captured = {
    body: '',
    headers: new Map<string, string>(),
    statusCode: 200,
    setHeader(name: string, value: string | number | readonly string[]) {
      captured.headers.set(name, String(value))
      return captured as CapturedResponse & ServerResponse
    },
    end(chunk?: unknown) {
      captured.body = chunk === undefined ? '' : String(chunk)
      return captured as CapturedResponse & ServerResponse
    },
  }
  return captured as CapturedResponse & ServerResponse
}

function contract(hasLiveFixture: boolean): RetrievedLiveLeagueState {
  return {
    snapshot: {
      leagueId: 45938,
      eventId: 1,
      gameweekState: {
        eventId: 1,
        phase: 'ACTIVE',
        deadlineTime: '2026-08-21T17:30:00Z',
        hasLiveFixture,
        allFixturesStarted: false,
        allFixturesFootballComplete: false,
        officialEventFinished: false,
        bootstrapEventFinished: false,
      },
      teamScores: [],
      seasonBaseline: {
        status: 'AVAILABLE', eventId: 1, provenance: 'SEASON_START_ZERO', entries: [],
      },
      standings: { status: 'AVAILABLE', rows: [] },
      calculationStatus: 'PROVISIONAL',
      reconciliationStatus: 'NOT_PROVEN',
      freshness: {
        retrievedAt: '2026-08-24T12:00:00Z', staleAfterMs: 90_000,
      },
    },
    nextEvent: null,
    ownership: { leagueId: 45938, elements: [] },
    eventStatus: { days: [], leagueTableStatus: null },
  }
}

describe('GET /api/fpl-league-live', () => {
  it('returns the normalized snapshot with a short shared live cache', async () => {
    const response = createResponse()
    await createFplLeagueLiveHandler(async () => contract(true))(
      { method: 'GET' } as IncomingMessage,
      response,
    )
    expect(response.statusCode).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('public, s-maxage=15, stale-while-revalidate=15')
    expect(JSON.parse(response.body)).toMatchObject({ snapshot: { leagueId: 45938 } })
  })

  it('rejects non-GET methods and controls upstream errors', async () => {
    const methodResponse = createResponse()
    await createFplLeagueLiveHandler()({ method: 'POST' } as IncomingMessage, methodResponse)
    expect(methodResponse.statusCode).toBe(405)

    const errorResponse = createResponse()
    const logFailure = vi.fn()
    await createFplLeagueLiveHandler(async () => {
      throw new FplDataError('UNEXPECTED_SCHEMA', 'Entry 240560 lineup response changed shape')
    }, logFailure)({ method: 'GET' } as IncomingMessage, errorResponse)
    expect(errorResponse.statusCode).toBe(502)
    expect(JSON.parse(errorResponse.body)).toEqual({
      error: { code: 'UNEXPECTED_SCHEMA', message: 'Current live league data is unavailable' },
    })
    expect(logFailure).toHaveBeenCalledWith({
      route: '/api/fpl-league-live',
      code: 'UNEXPECTED_SCHEMA',
      detail: 'Entry 240560 lineup response changed shape',
    })
  })
})
