import type { IncomingMessage, ServerResponse } from 'node:http'

import {
  FplDataError,
  retrieveKileNOthersLiveLeagueState,
  type RetrievedLiveLeagueState,
} from '../src/services/fpl/index.ts'

type LoadLiveLeagueState = () => Promise<RetrievedLiveLeagueState>

function sendJson(response: ServerResponse, status: number, body: unknown, cacheControl: string): void {
  response.statusCode = status
  response.setHeader('Content-Type', 'application/json; charset=utf-8')
  response.setHeader('Cache-Control', cacheControl)
  response.end(JSON.stringify(body))
}

function cacheControlFor(state: RetrievedLiveLeagueState): string {
  if (state.snapshot.gameweekState.hasLiveFixture) {
    return 'public, s-maxage=15, stale-while-revalidate=15'
  }
  if (state.snapshot.gameweekState.phase === 'ACTIVE') {
    return 'public, s-maxage=60, stale-while-revalidate=30'
  }
  return 'public, s-maxage=300, stale-while-revalidate=60'
}

export function createFplLeagueLiveHandler(
  load: LoadLiveLeagueState = retrieveKileNOthersLiveLeagueState,
) {
  return async function handler(
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> {
    if (request.method !== 'GET') {
      response.setHeader('Allow', 'GET')
      sendJson(response, 405, {
        error: { code: 'METHOD_NOT_ALLOWED', message: 'Only GET is supported' },
      }, 'no-store')
      return
    }

    try {
      const state = await load()
      sendJson(response, 200, state, cacheControlFor(state))
    } catch (error) {
      if (error instanceof FplDataError) {
        sendJson(response, 502, {
          error: { code: error.code, message: 'Current live league data is unavailable' },
        }, 'no-store')
        return
      }
      sendJson(response, 500, {
        error: { code: 'INTERNAL_ERROR', message: 'Unable to retrieve live league data' },
      }, 'no-store')
    }
  }
}

export default createFplLeagueLiveHandler()
