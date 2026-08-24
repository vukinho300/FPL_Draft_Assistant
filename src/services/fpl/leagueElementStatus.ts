import type { FetchImplementation } from './client.ts'
import { FplDataError } from './errors.ts'
import { retrieveOfficialJson } from './requestJson.ts'
import {
  isRecord,
  readArray,
  readBoolean,
  readNullablePositiveInteger,
  readPositiveInteger,
  readString,
} from './schema.ts'

export type FplDraftElementAvailability = 'AVAILABLE' | 'OWNED' | 'LOCKED'

export interface FplDraftLeagueElementStatus {
  readonly elementId: string
  readonly availability: FplDraftElementAvailability
  readonly upstreamStatusCode: string
  /** Owner is the official entry ID, not the league-entry ID. */
  readonly officialOwnerEntryId: number | null
  readonly inAcceptedTrade: boolean
}

export interface FplDraftLeagueElementStatuses {
  readonly leagueId: number
  readonly elements: readonly FplDraftLeagueElementStatus[]
}

export function getFplDraftLeagueElementStatusEndpoint(leagueId: number): string {
  if (!Number.isSafeInteger(leagueId) || leagueId <= 0) {
    throw new FplDataError('MISSING_REQUIRED_MAPPING', 'FPL Draft league ID must be a positive integer')
  }
  return `https://draft.premierleague.com/api/league/${leagueId}/element-status`
}

export function normalizeFplDraftLeagueElementStatuses(
  rawStatuses: unknown,
  leagueId: number,
): FplDraftLeagueElementStatuses {
  getFplDraftLeagueElementStatusEndpoint(leagueId)
  if (!isRecord(rawStatuses)) {
    throw new FplDataError('UNEXPECTED_SCHEMA', 'FPL Draft element-status response must be an object')
  }
  const elementIds = new Set<string>()
  const elements = readArray(rawStatuses, 'element_status', 'elementStatus').map((rawStatus, index) => {
    const context = `elementStatus.element_status[${index}]`
    if (!isRecord(rawStatus)) {
      throw new FplDataError('UNEXPECTED_SCHEMA', `${context} must be an object`)
    }
    const elementId = String(readPositiveInteger(rawStatus, 'element', context))
    if (elementIds.has(elementId)) {
      throw new FplDataError('MISSING_REQUIRED_MAPPING', `Duplicate element-status player ${elementId}`)
    }
    elementIds.add(elementId)
    const code = readString(rawStatus, 'status', context)
    if (code === '') {
      throw new FplDataError('UNEXPECTED_SCHEMA', `${context}.status must be non-empty`)
    }
    // The current official Draft client treats `a` as available, `o` as owned,
    // and any other non-empty status as Locked. Preserve the raw code so a
    // future live locked observation can be audited without guessing it here.
    const availability: FplDraftElementAvailability = code === 'a'
      ? 'AVAILABLE'
      : code === 'o'
        ? 'OWNED'
        : 'LOCKED'
    const officialOwnerEntryId = readNullablePositiveInteger(rawStatus, 'owner', context)
    if (availability === 'OWNED' && officialOwnerEntryId === null) {
      throw new FplDataError('MISSING_REQUIRED_MAPPING', `Owned player ${elementId} has no owner`)
    }
    if (availability === 'AVAILABLE' && officialOwnerEntryId !== null) {
      throw new FplDataError('MISSING_REQUIRED_MAPPING', `Available player ${elementId} has an owner`)
    }
    return Object.freeze({
      elementId,
      availability,
      upstreamStatusCode: code,
      officialOwnerEntryId,
      inAcceptedTrade: readBoolean(rawStatus, 'in_accepted_trade', context),
    })
  }).sort((left, right) => Number(left.elementId) - Number(right.elementId))
  return Object.freeze({ leagueId, elements: Object.freeze(elements) })
}

export async function retrieveFplDraftLeagueElementStatuses(
  leagueId: number,
  fetchImplementation: FetchImplementation = fetch,
): Promise<FplDraftLeagueElementStatuses> {
  const endpoint = getFplDraftLeagueElementStatusEndpoint(leagueId)
  const raw = await retrieveOfficialJson(endpoint, 'FPL Draft element-status', fetchImplementation)
  return normalizeFplDraftLeagueElementStatuses(raw, leagueId)
}
