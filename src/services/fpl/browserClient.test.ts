import { describe, expect, it, vi } from 'vitest'

import { loadFplPlayerData, type BrowserFetchImplementation } from './browserClient.ts'

describe('browser FPL client', () => {
  it('loads the project-owned /api/fpl contract', async () => {
    const fetchImplementation = vi.fn<BrowserFetchImplementation>(async () =>
      Response.json({ retrievedAt: '2026-08-17T00:00:00Z', playerCount: 0, players: [] }),
    )
    await expect(loadFplPlayerData(fetchImplementation)).resolves.toMatchObject({ playerCount: 0 })
    expect(fetchImplementation).toHaveBeenCalledWith('/api/fpl', {
      headers: { accept: 'application/json' },
    })
  })

  it('returns a controlled upstream error', async () => {
    const fetchImplementation: BrowserFetchImplementation = async () =>
      Response.json({ error: { message: 'Unavailable now' } }, { status: 502 })
    await expect(loadFplPlayerData(fetchImplementation)).rejects.toThrow('Unavailable now')
  })

  it('rejects a malformed success contract', async () => {
    const fetchImplementation: BrowserFetchImplementation = async () =>
      Response.json({ retrievedAt: 'now', playerCount: 2, players: [] })
    await expect(loadFplPlayerData(fetchImplementation)).rejects.toThrow(/project contract/)
  })
})
