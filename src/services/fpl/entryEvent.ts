import type { FetchImplementation } from './client.ts'
import { FplDataError } from './errors.ts'
import { retrieveOfficialJson } from './requestJson.ts'
import {
  isRecord,
  readArray,
  readBoolean,
  readInteger,
  readNullableInteger,
  readPositiveInteger,
  readRecord,
} from './schema.ts'

export interface FplDraftLineupSelection {
  readonly elementId: string
  /** Official ordered slot: starters 1-11, bench 12-15. */
  readonly position: number
  readonly isCaptain: boolean
  readonly isViceCaptain: boolean
  readonly multiplier: number
}

export interface FplDraftEntryEventLineup {
  readonly officialEntryId: number
  readonly eventId: number
  readonly starters: readonly FplDraftLineupSelection[]
  readonly bench: readonly FplDraftLineupSelection[]
  /** The current event returned no applied substitution records when this contract was verified. */
  readonly substitutionCount: number
  /** True only once the upstream entry_history object contains event-result fields. */
  readonly entryHistoryAvailable: boolean
}

export interface FplDraftEntryEventHistoryRecord {
  readonly eventId: number
  readonly eventPoints: number
  readonly seasonTotal: number
  readonly pointsOnBench: number
  readonly transfers: number
  readonly rank: number | null
  readonly rankSort: number | null
}

export interface FplDraftEntryHistory {
  readonly officialEntryId: number
  readonly records: readonly FplDraftEntryEventHistoryRecord[]
}

function requirePositiveId(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new FplDataError('MISSING_REQUIRED_MAPPING', `${label} must be a positive integer`)
  }
}

export function getFplDraftEntryEventEndpoint(officialEntryId: number, eventId: number): string {
  requirePositiveId(officialEntryId, 'Official entry ID')
  requirePositiveId(eventId, 'FPL Draft event ID')
  return `https://draft.premierleague.com/api/entry/${officialEntryId}/event/${eventId}`
}

export function getFplDraftEntryHistoryEndpoint(officialEntryId: number): string {
  requirePositiveId(officialEntryId, 'Official entry ID')
  return `https://draft.premierleague.com/api/entry/${officialEntryId}/history`
}

export function normalizeFplDraftEntryEventLineup(
  rawLineup: unknown,
  officialEntryId: number,
  eventId: number,
): FplDraftEntryEventLineup {
  getFplDraftEntryEventEndpoint(officialEntryId, eventId)
  if (!isRecord(rawLineup)) {
    throw new FplDataError('UNEXPECTED_SCHEMA', 'FPL Draft entry-event response must be an object')
  }
  const rawPicks = readArray(rawLineup, 'picks', 'entryEvent')
  if (rawPicks.length !== 15) {
    throw new FplDataError(
      'MISSING_REQUIRED_MAPPING',
      `Official entry ${officialEntryId} event ${eventId} must contain exactly 15 picks`,
    )
  }
  const positions = new Set<number>()
  const elementIds = new Set<string>()
  const picks = rawPicks.map((rawPick, index) => {
    const context = `entryEvent.picks[${index}]`
    if (!isRecord(rawPick)) {
      throw new FplDataError('UNEXPECTED_SCHEMA', `${context} must be an object`)
    }
    const position = readPositiveInteger(rawPick, 'position', context)
    const elementId = String(readPositiveInteger(rawPick, 'element', context))
    if (position > 15 || positions.has(position)) {
      throw new FplDataError('MISSING_REQUIRED_MAPPING', `Duplicate or invalid lineup position ${position}`)
    }
    if (elementIds.has(elementId)) {
      throw new FplDataError('MISSING_REQUIRED_MAPPING', `Duplicate lineup player ${elementId}`)
    }
    positions.add(position)
    elementIds.add(elementId)
    return Object.freeze({
      elementId,
      position,
      isCaptain: readBoolean(rawPick, 'is_captain', context),
      isViceCaptain: readBoolean(rawPick, 'is_vice_captain', context),
      multiplier: readInteger(rawPick, 'multiplier', context),
    })
  }).sort((left, right) => left.position - right.position)
  if (picks.some((pick, index) => pick.position !== index + 1)) {
    throw new FplDataError('MISSING_REQUIRED_MAPPING', 'Lineup positions must be exactly 1 through 15')
  }

  const substitutions = readArray(rawLineup, 'subs', 'entryEvent')
  const entryHistory = readRecord(rawLineup, 'entry_history', 'entryEvent')
  return Object.freeze({
    officialEntryId,
    eventId,
    starters: Object.freeze(picks.slice(0, 11)),
    bench: Object.freeze(picks.slice(11)),
    substitutionCount: substitutions.length,
    entryHistoryAvailable: Object.keys(entryHistory).length > 0,
  })
}

export function normalizeFplDraftEntryHistory(
  rawHistory: unknown,
  officialEntryId: number,
): FplDraftEntryHistory {
  getFplDraftEntryHistoryEndpoint(officialEntryId)
  if (!isRecord(rawHistory)) {
    throw new FplDataError('UNEXPECTED_SCHEMA', 'FPL Draft entry history must be an object')
  }
  const eventIds = new Set<number>()
  const records = readArray(rawHistory, 'history', 'entryHistory').map((rawRecord, index) => {
    const context = `entryHistory.history[${index}]`
    if (!isRecord(rawRecord)) {
      throw new FplDataError('UNEXPECTED_SCHEMA', `${context} must be an object`)
    }
    const entryId = readPositiveInteger(rawRecord, 'entry', context)
    if (entryId !== officialEntryId) {
      throw new FplDataError(
        'MISSING_REQUIRED_MAPPING',
        `${context} references entry ${entryId} instead of ${officialEntryId}`,
      )
    }
    const eventId = readPositiveInteger(rawRecord, 'event', context)
    if (eventIds.has(eventId)) {
      throw new FplDataError('MISSING_REQUIRED_MAPPING', `Duplicate entry history event ${eventId}`)
    }
    eventIds.add(eventId)
    return Object.freeze({
      eventId,
      eventPoints: readInteger(rawRecord, 'points', context),
      seasonTotal: readInteger(rawRecord, 'total_points', context),
      pointsOnBench: readInteger(rawRecord, 'points_on_bench', context),
      transfers: readInteger(rawRecord, 'event_transfers', context),
      rank: readNullableInteger(rawRecord, 'rank', context),
      rankSort: readNullableInteger(rawRecord, 'rank_sort', context),
    })
  })
  return Object.freeze({ officialEntryId, records: Object.freeze(records) })
}

export async function retrieveFplDraftEntryEventLineup(
  officialEntryId: number,
  eventId: number,
  fetchImplementation: FetchImplementation = fetch,
): Promise<FplDraftEntryEventLineup> {
  const endpoint = getFplDraftEntryEventEndpoint(officialEntryId, eventId)
  const raw = await retrieveOfficialJson(endpoint, 'FPL Draft entry-event', fetchImplementation)
  return normalizeFplDraftEntryEventLineup(raw, officialEntryId, eventId)
}

export async function retrieveFplDraftEntryHistory(
  officialEntryId: number,
  fetchImplementation: FetchImplementation = fetch,
): Promise<FplDraftEntryHistory> {
  const endpoint = getFplDraftEntryHistoryEndpoint(officialEntryId)
  const raw = await retrieveOfficialJson(endpoint, 'FPL Draft entry history', fetchImplementation)
  return normalizeFplDraftEntryHistory(raw, officialEntryId)
}
