import type { IncomingMessage, ServerResponse } from 'node:http'

import { retrieveFplPlayerData } from '../src/services/fpl/client.ts'
import type { FplPlayerDataResponse } from '../src/services/fpl/contract.ts'
import { FplDataError } from '../src/services/fpl/errors.ts'

type LoadFplPlayerData = () => Promise<FplPlayerDataResponse>
type LogFplFailure = (failure: Readonly<{
  route: '/api/fpl'
  code: string
  detail: string
}>) => void

function sendJson(
  response: ServerResponse,
  status: number,
  body: unknown,
  cacheControl: string = 'no-store',
): void {
  response.statusCode = status
  response.setHeader('Content-Type', 'application/json; charset=utf-8')
  response.setHeader('Cache-Control', cacheControl)
  response.end(JSON.stringify(body))
}

const logFplFailure: LogFplFailure = (failure) => {
  console.error('[api/fpl] official retrieval failed', failure)
}

export function createFplHandler(
  load: LoadFplPlayerData = retrieveFplPlayerData,
  logFailure: LogFplFailure = logFplFailure,
) {
  return async function handler(
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> {
    if (request.method !== 'GET') {
      response.setHeader('Allow', 'GET')
      sendJson(response, 405, {
        error: { code: 'METHOD_NOT_ALLOWED', message: 'Only GET is supported' },
      })
      return
    }

    try {
      sendJson(
        response,
        200,
        await load(),
        'public, s-maxage=300, stale-while-revalidate=60',
      )
    } catch (error) {
      logFailure(Object.freeze({
        route: '/api/fpl',
        code: error instanceof FplDataError ? error.code : 'INTERNAL_ERROR',
        detail: error instanceof Error ? error.message : 'Unknown retrieval failure',
      }))
      if (error instanceof FplDataError) {
        sendJson(response, 502, {
          error: {
            code: error.code,
            message: 'Current FPL Draft player data is unavailable',
          },
        })
        return
      }

      sendJson(response, 500, {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Unable to retrieve FPL Draft player data',
        },
      })
    }
  }
}

export default createFplHandler()
