import type { FetchImplementation } from './client.ts'
import { FplDataError } from './errors.ts'
import { retrieveOfficialJson } from './requestJson.ts'
import {
  isRecord,
  readArray,
  readBoolean,
  readInteger,
  readNullableInteger,
  readNullableIsoTimestamp,
  readPositiveInteger,
  readString,
  type UnknownRecord,
} from './schema.ts'

export interface FplDraftFixtureStatValue {
  readonly elementId: string
  readonly value: number
}

export interface FplDraftFixtureStat {
  readonly identifier: string
  readonly home: readonly FplDraftFixtureStatValue[]
  readonly away: readonly FplDraftFixtureStatValue[]
}

export interface FplDraftFixture {
  readonly fixtureId: number
  readonly eventId: number
  readonly kickoffTime: string | null
  readonly started: boolean
  readonly finished: boolean
  readonly finishedProvisional: boolean
  readonly provisionalStartTime: boolean
  readonly minutes: number
  readonly homeTeamId: number
  readonly awayTeamId: number
  readonly homeScore: number | null
  readonly awayScore: number | null
  readonly stats: readonly FplDraftFixtureStat[]
}

export function getFplDraftFixturesEndpoint(eventId: number): string {
  if (!Number.isSafeInteger(eventId) || eventId <= 0) {
    throw new FplDataError('MISSING_REQUIRED_MAPPING', 'FPL Draft event ID must be a positive integer')
  }
  return `https://draft.premierleague.com/api/event/${eventId}/fixtures`
}

function normalizeStatValues(rawValues: unknown[], context: string): FplDraftFixtureStatValue[] {
  return rawValues.map((rawValue, index) => {
    const itemContext = `${context}[${index}]`
    if (!isRecord(rawValue)) {
      throw new FplDataError('UNEXPECTED_SCHEMA', `${itemContext} must be an object`)
    }
    return Object.freeze({
      elementId: String(readPositiveInteger(rawValue, 'element', itemContext)),
      value: readInteger(rawValue, 'value', itemContext),
    })
  })
}

function normalizeFixtureStats(rawStats: unknown[], context: string): FplDraftFixtureStat[] {
  const identifiers = new Set<string>()
  return rawStats.map((rawStat, index) => {
    const statContext = `${context}.stats[${index}]`
    if (!isRecord(rawStat)) {
      throw new FplDataError('UNEXPECTED_SCHEMA', `${statContext} must be an object`)
    }
    const identifier = readString(rawStat, 's', statContext)
    if (identifier === '' || identifiers.has(identifier)) {
      throw new FplDataError(
        'UNEXPECTED_SCHEMA',
        `${statContext}.s must be a unique non-empty identifier`,
      )
    }
    identifiers.add(identifier)
    return Object.freeze({
      identifier,
      home: Object.freeze(normalizeStatValues(readArray(rawStat, 'h', statContext), `${statContext}.h`)),
      away: Object.freeze(normalizeStatValues(readArray(rawStat, 'a', statContext), `${statContext}.a`)),
    })
  })
}

function normalizeFixture(rawFixture: UnknownRecord, eventId: number, context: string): FplDraftFixture {
  const observedEventId = readPositiveInteger(rawFixture, 'event', context)
  if (observedEventId !== eventId) {
    throw new FplDataError(
      'MISSING_REQUIRED_MAPPING',
      `${context} references event ${observedEventId} instead of ${eventId}`,
    )
  }
  const minutes = readInteger(rawFixture, 'minutes', context)
  if (minutes < 0) {
    throw new FplDataError('UNEXPECTED_SCHEMA', `${context}.minutes cannot be negative`)
  }
  return Object.freeze({
    fixtureId: readPositiveInteger(rawFixture, 'id', context),
    eventId,
    kickoffTime: readNullableIsoTimestamp(rawFixture, 'kickoff_time', context),
    started: readBoolean(rawFixture, 'started', context),
    finished: readBoolean(rawFixture, 'finished', context),
    finishedProvisional: readBoolean(rawFixture, 'finished_provisional', context),
    provisionalStartTime: readBoolean(rawFixture, 'provisional_start_time', context),
    minutes,
    homeTeamId: readPositiveInteger(rawFixture, 'team_h', context),
    awayTeamId: readPositiveInteger(rawFixture, 'team_a', context),
    homeScore: readNullableInteger(rawFixture, 'team_h_score', context),
    awayScore: readNullableInteger(rawFixture, 'team_a_score', context),
    stats: Object.freeze(normalizeFixtureStats(readArray(rawFixture, 'stats', context), context)),
  })
}

export function normalizeFplDraftFixtures(
  rawFixtures: unknown,
  eventId: number,
): readonly FplDraftFixture[] {
  getFplDraftFixturesEndpoint(eventId)
  if (!Array.isArray(rawFixtures)) {
    throw new FplDataError('UNEXPECTED_SCHEMA', 'FPL Draft fixtures response must be an array')
  }
  const fixtureIds = new Set<number>()
  const fixtures = rawFixtures.map((rawFixture, index) => {
    const context = `fixtures[${index}]`
    if (!isRecord(rawFixture)) {
      throw new FplDataError('UNEXPECTED_SCHEMA', `${context} must be an object`)
    }
    const fixture = normalizeFixture(rawFixture, eventId, context)
    if (fixtureIds.has(fixture.fixtureId)) {
      throw new FplDataError('MISSING_REQUIRED_MAPPING', `Duplicate fixture ID ${fixture.fixtureId}`)
    }
    fixtureIds.add(fixture.fixtureId)
    return fixture
  })
  return Object.freeze(fixtures)
}

export async function retrieveFplDraftFixtures(
  eventId: number,
  fetchImplementation: FetchImplementation = fetch,
): Promise<readonly FplDraftFixture[]> {
  const endpoint = getFplDraftFixturesEndpoint(eventId)
  const raw = await retrieveOfficialJson(endpoint, 'FPL Draft fixtures', fetchImplementation)
  return normalizeFplDraftFixtures(raw, eventId)
}
