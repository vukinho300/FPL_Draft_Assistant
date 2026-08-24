import type { FetchImplementation } from './client.ts'
import { FplDataError } from './errors.ts'

type UnknownRecord = Record<string, unknown>

export interface FplDraftChoice {
  readonly leagueId: number
  readonly officialEntryId: number
  readonly elementId: string
  readonly overallIndex: number
  readonly round: number
  readonly pickInRound: number
  readonly entryName: string
  readonly playerFirstName: string
}

export interface FplDraftChoices {
  readonly leagueId: number
  readonly choices: readonly FplDraftChoice[]
}

export function getFplDraftChoicesEndpoint(leagueId: number): string {
  if (!Number.isSafeInteger(leagueId) || leagueId <= 0) {
    throw new FplDataError('MISSING_REQUIRED_MAPPING', 'FPL Draft league ID must be a positive integer')
  }
  return `https://draft.premierleague.com/api/draft/${leagueId}/choices`
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readPositiveInteger(record: UnknownRecord, field: string, context: string): number {
  const value = record[field]
  if (!Number.isSafeInteger(value) || (value as number) <= 0) {
    throw new FplDataError('UNEXPECTED_SCHEMA', `${context}.${field} must be a positive integer`)
  }
  return value as number
}

function readString(record: UnknownRecord, field: string, context: string): string {
  const value = record[field]
  if (typeof value !== 'string' || value.trim() === '') {
    throw new FplDataError('UNEXPECTED_SCHEMA', `${context}.${field} must be a non-empty string`)
  }
  return value.trim()
}

export function normalizeFplDraftChoices(rawChoices: unknown, expectedLeagueId: number): FplDraftChoices {
  getFplDraftChoicesEndpoint(expectedLeagueId)
  if (!isRecord(rawChoices) || !Array.isArray(rawChoices.choices)) {
    throw new FplDataError('UNEXPECTED_SCHEMA', 'FPL Draft choices response.choices must be an array')
  }

  const indexes = new Set<number>()
  const choices = rawChoices.choices.map((rawChoice, index) => {
    const context = `choices[${index}]`
    if (!isRecord(rawChoice)) {
      throw new FplDataError('UNEXPECTED_SCHEMA', `${context} must be an object`)
    }
    const leagueId = readPositiveInteger(rawChoice, 'league', context)
    if (leagueId !== expectedLeagueId) {
      throw new FplDataError(
        'MISSING_REQUIRED_MAPPING',
        `${context} references league ${leagueId} instead of ${expectedLeagueId}`,
      )
    }
    const overallIndex = readPositiveInteger(rawChoice, 'index', context)
    if (indexes.has(overallIndex)) {
      throw new FplDataError('MISSING_REQUIRED_MAPPING', `Duplicate official draft index ${overallIndex}`)
    }
    indexes.add(overallIndex)

    return Object.freeze({
      leagueId,
      officialEntryId: readPositiveInteger(rawChoice, 'entry', context),
      elementId: String(readPositiveInteger(rawChoice, 'element', context)),
      overallIndex,
      round: readPositiveInteger(rawChoice, 'round', context),
      pickInRound: readPositiveInteger(rawChoice, 'pick', context),
      entryName: readString(rawChoice, 'entry_name', context),
      playerFirstName: readString(rawChoice, 'player_first_name', context),
    })
  })

  return Object.freeze({ leagueId: expectedLeagueId, choices: Object.freeze(choices) })
}

export async function retrieveFplDraftChoices(
  leagueId: number,
  fetchImplementation: FetchImplementation = fetch,
): Promise<FplDraftChoices> {
  const endpoint = getFplDraftChoicesEndpoint(leagueId)
  let response: Response
  try {
    response = await fetchImplementation(endpoint, { headers: { accept: 'application/json' } })
  } catch (error) {
    throw new FplDataError('NETWORK_ERROR', 'Unable to reach the FPL Draft choices endpoint', {
      cause: error,
    })
  }
  if (!response.ok) {
    throw new FplDataError(
      'UPSTREAM_HTTP_ERROR',
      `FPL Draft choices endpoint returned HTTP ${response.status}`,
    )
  }
  const contentType = response.headers.get('content-type')?.toLowerCase()
  if (contentType === undefined || !contentType.includes('application/json')) {
    throw new FplDataError(
      'UNEXPECTED_CONTENT_TYPE',
      `FPL Draft choices endpoint returned ${contentType ?? 'no content type'}`,
    )
  }
  let rawChoices: unknown
  try {
    rawChoices = await response.json()
  } catch (error) {
    throw new FplDataError('INVALID_JSON', 'FPL Draft choices endpoint returned invalid JSON', {
      cause: error,
    })
  }
  return normalizeFplDraftChoices(rawChoices, leagueId)
}
