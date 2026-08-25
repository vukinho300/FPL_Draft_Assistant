import { describe, expect, it, vi } from 'vitest'

import { loadFplPlayerData, type BrowserFetchImplementation } from './browserClient.ts'

describe('browser FPL client', () => {
  it('loads the project-owned /api/fpl contract', async () => {
    const fetchImplementation = vi.fn<BrowserFetchImplementation>(async () =>
      Response.json({ retrievedAt: '2026-08-17T00:00:00Z', playerCount: 0, players: [] }),
    )
    await expect(loadFplPlayerData(fetchImplementation)).resolves.toMatchObject({ playerCount: 0 })
    expect(fetchImplementation).toHaveBeenCalledWith('/api/fpl', expect.objectContaining({
      headers: { accept: 'application/json' },
      signal: expect.any(AbortSignal),
    }))
  })

  it('returns a controlled upstream error', async () => {
    const fetchImplementation: BrowserFetchImplementation = async () =>
      Response.json({ error: { message: 'Unavailable now' } }, { status: 502 })
    await expect(loadFplPlayerData(fetchImplementation)).rejects.toThrow('Unavailable now')
  })

  it('controls a browser network failure', async () => {
    const fetchImplementation: BrowserFetchImplementation = async () => {
      throw new TypeError('sensitive browser network detail')
    }
    await expect(loadFplPlayerData(fetchImplementation)).rejects.toThrow(
      'Player directory is unavailable. Try again.',
    )
  })

  it('rejects a malformed success contract', async () => {
    const fetchImplementation: BrowserFetchImplementation = async () =>
      Response.json({ retrievedAt: 'now', playerCount: 2, players: [] })
    await expect(loadFplPlayerData(fetchImplementation)).rejects.toThrow(/project contract/)
  })

  it('fails a hung browser request within the configured timeout', async () => {
    const fetchImplementation: BrowserFetchImplementation = () => new Promise(() => undefined)
    await expect(loadFplPlayerData(fetchImplementation, 5)).rejects.toThrow(
      'Player directory took too long to load. Try again.',
    )
  })
})
