import type { IncomingMessage, ServerResponse } from 'node:http'
import { describe, expect, it, vi } from 'vitest'

import { FplDataError } from '../src/services/fpl/errors.ts'
import type { FplPlayerDataResponse } from '../src/services/fpl/contract.ts'
import { createFplHandler } from './fpl.ts'

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

describe('GET /api/fpl', () => {
  it('returns only the project-owned contract with a shared bootstrap cache', async () => {
    const contract: FplPlayerDataResponse = {
      retrievedAt: '2026-08-17T12:00:00.000Z',
      playerCount: 0,
      players: [],
    }
    const response = createResponse()

    await createFplHandler(async () => contract)(
      { method: 'GET' } as IncomingMessage,
      response,
    )

    expect(response.statusCode).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('public, s-maxage=300, stale-while-revalidate=60')
    expect(JSON.parse(response.body)).toEqual(contract)
  })

  it('rejects methods other than GET', async () => {
    const response = createResponse()

    await createFplHandler()({ method: 'POST' } as IncomingMessage, response)

    expect(response.statusCode).toBe(405)
    expect(response.headers.get('Allow')).toBe('GET')
  })

  it('returns a controlled upstream error without exposing internal details', async () => {
    const response = createResponse()
    const logFailure = vi.fn()

    await createFplHandler(async () => {
      throw new FplDataError('INVALID_JSON', 'FPL Draft bootstrap endpoint returned invalid JSON')
    }, logFailure)(
      { method: 'GET' } as IncomingMessage,
      response,
    )

    expect(response.statusCode).toBe(502)
    expect(JSON.parse(response.body)).toEqual({
      error: {
        code: 'INVALID_JSON',
        message: 'Current FPL Draft player data is unavailable',
      },
    })
    expect(logFailure).toHaveBeenCalledWith({
      route: '/api/fpl',
      code: 'INVALID_JSON',
      detail: 'FPL Draft bootstrap endpoint returned invalid JSON',
    })
  })
})
