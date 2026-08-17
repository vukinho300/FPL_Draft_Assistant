import type { IncomingMessage, ServerResponse } from 'node:http'

import {
  FplDataError,
  retrieveFplPlayerData,
  type FplPlayerDataResponse,
} from '../src/services/fpl/index.ts'

type LoadFplPlayerData = () => Promise<FplPlayerDataResponse>

function sendJson(response: ServerResponse, status: number, body: unknown): void {
  response.statusCode = status
  response.setHeader('Content-Type', 'application/json; charset=utf-8')
  response.setHeader('Cache-Control', 'no-store')
  response.end(JSON.stringify(body))
}

export function createFplHandler(load: LoadFplPlayerData = retrieveFplPlayerData) {
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
      sendJson(response, 200, await load())
    } catch (error) {
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
