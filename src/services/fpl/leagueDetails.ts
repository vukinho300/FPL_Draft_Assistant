import { FplDataError } from './errors.ts'
import type { FetchImplementation } from './client.ts'

type UnknownRecord = Record<string, unknown>

export interface FplDraftLeagueParticipant {
  readonly officialEntryId: number
  readonly officialLeagueEntryId: number
  readonly entryName: string
  readonly playerFirstName: string
}

export interface FplDraftLeagueStanding {
  readonly officialLeagueEntryId: number
  readonly rank: number
  readonly lastRank: number | null
  readonly rankSort: number
  readonly eventTotal: number
  readonly total: number
}

export interface FplDraftLeagueDetails {
  readonly leagueId: number
  readonly leagueName: string
  readonly scoring: string
  readonly startEvent: number
  readonly stopEvent: number
  readonly draftStatus: string
  readonly participants: readonly FplDraftLeagueParticipant[]
  readonly standings: readonly FplDraftLeagueStanding[]
}

export interface RetrieveFplDraftLeagueDetailsOptions {
  readonly fetchImplementation?: FetchImplementation
}

export function getFplDraftLeagueDetailsEndpoint(leagueId: number): string {
  if (!Number.isSafeInteger(leagueId) || leagueId <= 0) {
    throw new FplDataError('MISSING_REQUIRED_MAPPING', 'FPL Draft league ID must be a positive integer')
  }

  return `https://draft.premierleague.com/api/league/${leagueId}/details`
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readRecord(record: UnknownRecord, field: string, context: string): UnknownRecord {
  const value = record[field]
  if (!isRecord(value)) {
    throw new FplDataError('UNEXPECTED_SCHEMA', `${context}.${field} must be an object`)
  }
  return value
}

function readArray(record: UnknownRecord, field: string, context: string): unknown[] {
  const value = record[field]
  if (!Array.isArray(value)) {
    throw new FplDataError('UNEXPECTED_SCHEMA', `${context}.${field} must be an array`)
  }
  return value
}

function readPositiveInteger(record: UnknownRecord, field: string, context: string): number {
  const value = record[field]
  if (!Number.isSafeInteger(value) || (value as number) <= 0) {
    throw new FplDataError('UNEXPECTED_SCHEMA', `${context}.${field} must be a positive integer`)
  }
  return value as number
}

function readInteger(record: UnknownRecord, field: string, context: string): number {
  const value = record[field]
  if (!Number.isSafeInteger(value)) {
    throw new FplDataError('UNEXPECTED_SCHEMA', `${context}.${field} must be an integer`)
  }
  return value as number
}

function readNullableInteger(record: UnknownRecord, field: string, context: string): number | null {
  return record[field] === null ? null : readInteger(record, field, context)
}

function readString(record: UnknownRecord, field: string, context: string): string {
  const value = record[field]
  if (typeof value !== 'string' || value.trim() === '') {
    throw new FplDataError('UNEXPECTED_SCHEMA', `${context}.${field} must be a non-empty string`)
  }
  return value.trim()
}

function normalizeParticipants(rawParticipants: unknown[]): FplDraftLeagueParticipant[] {
  const entryIds = new Set<number>()
  const leagueEntryIds = new Set<number>()

  return rawParticipants.map((rawParticipant, index) => {
    const context = `league_entries[${index}]`
    if (!isRecord(rawParticipant)) {
      throw new FplDataError('UNEXPECTED_SCHEMA', `${context} must be an object`)
    }

    const officialEntryId = readPositiveInteger(rawParticipant, 'entry_id', context)
    const officialLeagueEntryId = readPositiveInteger(rawParticipant, 'id', context)
    if (entryIds.has(officialEntryId)) {
      throw new FplDataError('MISSING_REQUIRED_MAPPING', `Duplicate official entry ID ${officialEntryId}`)
    }
    if (leagueEntryIds.has(officialLeagueEntryId)) {
      throw new FplDataError('MISSING_REQUIRED_MAPPING', `Duplicate official league-entry ID ${officialLeagueEntryId}`)
    }
    entryIds.add(officialEntryId)
    leagueEntryIds.add(officialLeagueEntryId)

    return Object.freeze({
      officialEntryId,
      officialLeagueEntryId,
      entryName: readString(rawParticipant, 'entry_name', context),
      playerFirstName: readString(rawParticipant, 'player_first_name', context),
    })
  })
}

function normalizeStandings(rawStandings: unknown[]): FplDraftLeagueStanding[] {
  const leagueEntryIds = new Set<number>()

  return rawStandings.map((rawStanding, index) => {
    const context = `standings[${index}]`
    if (!isRecord(rawStanding)) {
      throw new FplDataError('UNEXPECTED_SCHEMA', `${context} must be an object`)
    }

    const officialLeagueEntryId = readPositiveInteger(rawStanding, 'league_entry', context)
    if (leagueEntryIds.has(officialLeagueEntryId)) {
      throw new FplDataError(
        'MISSING_REQUIRED_MAPPING',
        `Duplicate standings league-entry ID ${officialLeagueEntryId}`,
      )
    }
    leagueEntryIds.add(officialLeagueEntryId)

    return Object.freeze({
      officialLeagueEntryId,
      rank: readPositiveInteger(rawStanding, 'rank', context),
      lastRank: readNullableInteger(rawStanding, 'last_rank', context),
      rankSort: readPositiveInteger(rawStanding, 'rank_sort', context),
      eventTotal: readInteger(rawStanding, 'event_total', context),
      total: readInteger(rawStanding, 'total', context),
    })
  })
}

export function normalizeFplDraftLeagueDetails(rawDetails: unknown): FplDraftLeagueDetails {
  if (!isRecord(rawDetails)) {
    throw new FplDataError('UNEXPECTED_SCHEMA', 'FPL Draft league details must be an object')
  }

  const league = readRecord(rawDetails, 'league', 'response')

  return Object.freeze({
    leagueId: readPositiveInteger(league, 'id', 'league'),
    leagueName: readString(league, 'name', 'league'),
    scoring: readString(league, 'scoring', 'league'),
    startEvent: readPositiveInteger(league, 'start_event', 'league'),
    stopEvent: readPositiveInteger(league, 'stop_event', 'league'),
    draftStatus: readString(league, 'draft_status', 'league'),
    participants: Object.freeze(normalizeParticipants(readArray(rawDetails, 'league_entries', 'response'))),
    standings: Object.freeze(normalizeStandings(readArray(rawDetails, 'standings', 'response'))),
  })
}

export async function retrieveFplDraftLeagueDetails(
  leagueId: number,
  options: RetrieveFplDraftLeagueDetailsOptions = {},
): Promise<FplDraftLeagueDetails> {
  const endpoint = getFplDraftLeagueDetailsEndpoint(leagueId)
  const fetchImplementation = options.fetchImplementation ?? fetch
  let response: Response

  try {
    response = await fetchImplementation(endpoint, { headers: { accept: 'application/json' } })
  } catch (error) {
    throw new FplDataError('NETWORK_ERROR', 'Unable to reach the FPL Draft league endpoint', {
      cause: error,
    })
  }

  if (!response.ok) {
    throw new FplDataError(
      'UPSTREAM_HTTP_ERROR',
      `FPL Draft league endpoint returned HTTP ${response.status}`,
    )
  }

  const contentType = response.headers.get('content-type')?.toLowerCase()
  if (contentType === undefined || !contentType.includes('application/json')) {
    throw new FplDataError(
      'UNEXPECTED_CONTENT_TYPE',
      `FPL Draft league endpoint returned ${contentType ?? 'no content type'}`,
    )
  }

  let rawDetails: unknown
  try {
    rawDetails = await response.json()
  } catch (error) {
    throw new FplDataError('INVALID_JSON', 'FPL Draft league endpoint returned invalid JSON', {
      cause: error,
    })
  }

  return normalizeFplDraftLeagueDetails(rawDetails)
}
