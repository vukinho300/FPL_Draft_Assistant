import { describe, expect, it, vi } from 'vitest'

import { createBootstrapFixture } from './__fixtures__/bootstrap.ts'
import {
  FPL_DRAFT_BOOTSTRAP_ENDPOINT,
  retrieveFplPlayerData,
  type FetchImplementation,
} from './client.ts'

function response(body: string, status = 200, contentType = 'application/json'): Response {
  return new Response(body, { status, headers: { 'content-type': contentType } })
}

describe('retrieveFplPlayerData', () => {
  it('retrieves and returns the project-owned response contract', async () => {
    const fetchImplementation = vi.fn<FetchImplementation>(async () =>
      response(JSON.stringify(createBootstrapFixture())),
    )

    const result = await retrieveFplPlayerData({
      fetchImplementation,
      now: () => new Date('2026-08-17T12:00:00.000Z'),
    })

    expect(fetchImplementation).toHaveBeenCalledWith(FPL_DRAFT_BOOTSTRAP_ENDPOINT, expect.objectContaining({
      headers: { accept: 'application/json' },
      signal: expect.any(AbortSignal),
    }))
    expect(result.retrievedAt).toBe('2026-08-17T12:00:00.000Z')
    expect(result.playerCount).toBe(4)
    expect(result.players).toHaveLength(4)
  })

  it('classifies a network failure', async () => {
    const fetchImplementation = vi.fn<FetchImplementation>(async () => {
      throw new Error('offline')
    })

    await expect(retrieveFplPlayerData({ fetchImplementation })).rejects.toMatchObject({
      code: 'NETWORK_ERROR',
    })
  })

  it('bounds a hung official bootstrap request', async () => {
    const fetchImplementation = vi.fn<FetchImplementation>(() => new Promise(() => undefined))

    await expect(retrieveFplPlayerData({ fetchImplementation, requestTimeoutMs: 5 })).rejects.toMatchObject({
      code: 'NETWORK_ERROR',
      message: 'Unable to reach the FPL Draft endpoint',
    })
  })

  it('classifies a non-success HTTP response', async () => {
    const fetchImplementation = vi.fn<FetchImplementation>(async () => response('{}', 503))

    await expect(retrieveFplPlayerData({ fetchImplementation })).rejects.toMatchObject({
      code: 'UPSTREAM_HTTP_ERROR',
    })
  })

  it('rejects a non-JSON content type', async () => {
    const fetchImplementation = vi.fn<FetchImplementation>(async () =>
      response('{}', 200, 'text/html'),
    )

    await expect(retrieveFplPlayerData({ fetchImplementation })).rejects.toMatchObject({
      code: 'UNEXPECTED_CONTENT_TYPE',
    })
  })

  it('classifies malformed JSON', async () => {
    const fetchImplementation = vi.fn<FetchImplementation>(async () =>
      response('{not-json'),
    )

    await expect(retrieveFplPlayerData({ fetchImplementation })).rejects.toMatchObject({
      code: 'INVALID_JSON',
    })
  })
})
