import { describe, expect, it } from 'vitest'

import {
  clearDraftSession,
  DRAFT_SESSION_STORAGE_KEY,
  loadDraftSession,
  saveDraftSession,
  type StorageLike,
} from './draftSessionStorage.ts'

function memoryStorage(): StorageLike {
  const values = new Map<string, string>()
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  }
}

describe('draft session storage adapter', () => {
  it('round-trips only manager configuration and authoritative pick history', () => {
    const storage = memoryStorage()
    saveDraftSession(storage, {
      managers: [
        { id: 'a', displayName: 'Vuk' },
        { id: 'b', displayName: 'Diego' },
      ],
      userManagerId: 'a',
      pickHistory: [{ overallPickNumber: 1, roundNumber: 1, managerId: 'a', playerId: '10' }],
    })
    expect(loadDraftSession(storage)).toMatchObject({
      snapshot: { schemaVersion: 1, userManagerId: 'a', pickHistory: [{ playerId: '10' }] },
      error: null,
    })
  })

  it('fails safely on corrupt state and can clear it', () => {
    const storage = memoryStorage()
    storage.setItem(DRAFT_SESSION_STORAGE_KEY, '{bad json')
    expect(loadDraftSession(storage)).toMatchObject({ snapshot: null })
    clearDraftSession(storage)
    expect(loadDraftSession(storage)).toBeNull()
  })
})
