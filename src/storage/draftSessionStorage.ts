import type { DraftPick } from '../domain/draftState.ts'
import { createDraftConfiguration, type Manager } from '../domain/manager.ts'

export const DRAFT_SESSION_STORAGE_KEY = 'fpl-draft-assistant:v1'
export const DRAFT_SESSION_SCHEMA_VERSION = 1

export interface DraftSessionSnapshot {
  readonly schemaVersion: typeof DRAFT_SESSION_SCHEMA_VERSION
  readonly managers: readonly Manager[]
  readonly userManagerId: string
  readonly pickHistory: readonly DraftPick[]
}

export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export type LoadDraftSessionResult =
  | { readonly snapshot: DraftSessionSnapshot; readonly error: null }
  | { readonly snapshot: null; readonly error: string }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function loadDraftSession(storage: StorageLike): LoadDraftSessionResult | null {
  const encoded = storage.getItem(DRAFT_SESSION_STORAGE_KEY)
  if (encoded === null) return null
  try {
    const raw: unknown = JSON.parse(encoded)
    if (!isRecord(raw) || raw.schemaVersion !== DRAFT_SESSION_SCHEMA_VERSION) {
      throw new Error('Unsupported saved-session schema')
    }
    if (!Array.isArray(raw.managers) || typeof raw.userManagerId !== 'string') {
      throw new Error('Saved manager configuration is invalid')
    }
    const managers = raw.managers.map((manager) => {
      if (
        !isRecord(manager) ||
        typeof manager.id !== 'string' ||
        typeof manager.displayName !== 'string'
      ) {
        throw new Error('Saved manager configuration is invalid')
      }
      return { id: manager.id, displayName: manager.displayName }
    })
    const configuration = createDraftConfiguration(managers, raw.userManagerId)
    if (!Array.isArray(raw.pickHistory)) {
      throw new Error('Saved pick history is invalid')
    }
    const pickHistory = raw.pickHistory.map((pick) => {
      if (
        !isRecord(pick) ||
        !Number.isInteger(pick.overallPickNumber) ||
        !Number.isInteger(pick.roundNumber) ||
        typeof pick.managerId !== 'string' ||
        typeof pick.playerId !== 'string'
      ) {
        throw new Error('Saved pick history is invalid')
      }
      return {
        overallPickNumber: pick.overallPickNumber as number,
        roundNumber: pick.roundNumber as number,
        managerId: pick.managerId,
        playerId: pick.playerId,
      }
    })
    return {
      snapshot: Object.freeze({
        schemaVersion: DRAFT_SESSION_SCHEMA_VERSION,
        managers: configuration.managers,
        userManagerId: configuration.userManagerId,
        pickHistory: Object.freeze(pickHistory),
      }),
      error: null,
    }
  } catch (error) {
    return {
      snapshot: null,
      error: error instanceof Error ? error.message : 'Saved session is invalid',
    }
  }
}

export function saveDraftSession(
  storage: StorageLike,
  snapshot: Omit<DraftSessionSnapshot, 'schemaVersion'>,
): void {
  storage.setItem(
    DRAFT_SESSION_STORAGE_KEY,
    JSON.stringify({ schemaVersion: DRAFT_SESSION_SCHEMA_VERSION, ...snapshot }),
  )
}

export function clearDraftSession(storage: StorageLike): void {
  storage.removeItem(DRAFT_SESSION_STORAGE_KEY)
}
