import type { FetchImplementation } from './client.ts'
import { FplDataError } from './errors.ts'
import type { FplDraftFixture } from './fixtures.ts'
import { retrieveOfficialJson } from './requestJson.ts'
import {
  isRecord,
  readArray,
  readBoolean,
  readIsoTimestamp,
  readNonEmptyString,
  readNullablePositiveInteger,
  readPositiveInteger,
  readRecord,
  readString,
} from './schema.ts'

export const FPL_DRAFT_GAME_ENDPOINT = 'https://draft.premierleague.com/api/game'
export const FPL_DRAFT_BOOTSTRAP_STATIC_ENDPOINT =
  'https://draft.premierleague.com/api/bootstrap-static'
export const FPL_DRAFT_EVENT_STATUS_ENDPOINT =
  'https://draft.premierleague.com/api/pl/event-status'

export interface FplDraftGame {
  readonly currentEventId: number | null
  readonly currentEventFinished: boolean
  readonly nextEventId: number | null
  /** Observed upstream code. Its value is intentionally not interpreted without evidence. */
  readonly processingStatus: string
  readonly tradesTimeForApproval: boolean
  readonly waiversProcessed: boolean
}

export interface FplDraftEvent {
  readonly eventId: number
  readonly name: string
  readonly deadlineTime: string
  readonly tradesTime: string
  readonly waiversTime: string
  readonly finished: boolean
}

export interface FplDraftEventSchedule {
  readonly currentEventId: number | null
  readonly nextEventId: number | null
  readonly events: readonly FplDraftEvent[]
}

export type FplDraftPointsStatus =
  | 'NOT_STARTED'
  | 'LIVE'
  | 'PROVISIONAL'
  | 'CONFIRMED'

export interface FplDraftEventStatusDay {
  readonly date: string
  readonly eventId: number
  readonly pointsStatus: FplDraftPointsStatus
  readonly bonusAdded: boolean
  readonly leaguesUpdated: boolean
}

export interface FplDraftEventStatus {
  readonly days: readonly FplDraftEventStatusDay[]
  readonly leagueTableStatus: string | null
}

export type FplDraftGameweekPhase =
  | 'UPCOMING'
  | 'ACTIVE'
  | 'FOOTBALL_COMPLETE'
  | 'OFFICIAL_EVENT_MARKED_FINISHED'

export interface FplDraftGameweekState {
  readonly eventId: number
  readonly phase: FplDraftGameweekPhase
  readonly deadlineTime: string
  readonly hasLiveFixture: boolean
  readonly allFixturesStarted: boolean
  readonly allFixturesFootballComplete: boolean
  readonly officialEventFinished: boolean
  readonly bootstrapEventFinished: boolean
}

const pointsStatusByCode: Readonly<Record<string, FplDraftPointsStatus>> = {
  '': 'NOT_STARTED',
  l: 'LIVE',
  p: 'PROVISIONAL',
  r: 'CONFIRMED',
}

export function normalizeFplDraftGame(rawGame: unknown): FplDraftGame {
  if (!isRecord(rawGame)) {
    throw new FplDataError('UNEXPECTED_SCHEMA', 'FPL Draft game response must be an object')
  }
  return Object.freeze({
    currentEventId: readNullablePositiveInteger(rawGame, 'current_event', 'game'),
    currentEventFinished: readBoolean(rawGame, 'current_event_finished', 'game'),
    nextEventId: readNullablePositiveInteger(rawGame, 'next_event', 'game'),
    processingStatus: readString(rawGame, 'processing_status', 'game'),
    tradesTimeForApproval: readBoolean(rawGame, 'trades_time_for_approval', 'game'),
    waiversProcessed: readBoolean(rawGame, 'waivers_processed', 'game'),
  })
}

export function normalizeFplDraftEventSchedule(rawBootstrap: unknown): FplDraftEventSchedule {
  if (!isRecord(rawBootstrap)) {
    throw new FplDataError('UNEXPECTED_SCHEMA', 'FPL Draft bootstrap response must be an object')
  }
  const rawEvents = readRecord(rawBootstrap, 'events', 'bootstrap')
  const eventIds = new Set<number>()
  const events = readArray(rawEvents, 'data', 'bootstrap.events').map((rawEvent, index) => {
    const context = `bootstrap.events.data[${index}]`
    if (!isRecord(rawEvent)) {
      throw new FplDataError('UNEXPECTED_SCHEMA', `${context} must be an object`)
    }
    const eventId = readPositiveInteger(rawEvent, 'id', context)
    if (eventIds.has(eventId)) {
      throw new FplDataError('MISSING_REQUIRED_MAPPING', `Duplicate event ID ${eventId}`)
    }
    eventIds.add(eventId)
    return Object.freeze({
      eventId,
      name: readNonEmptyString(rawEvent, 'name', context),
      deadlineTime: readIsoTimestamp(rawEvent, 'deadline_time', context),
      tradesTime: readIsoTimestamp(rawEvent, 'trades_time', context),
      waiversTime: readIsoTimestamp(rawEvent, 'waivers_time', context),
      finished: readBoolean(rawEvent, 'finished', context),
    })
  })
  return Object.freeze({
    currentEventId: readNullablePositiveInteger(rawEvents, 'current', 'bootstrap.events'),
    nextEventId: readNullablePositiveInteger(rawEvents, 'next', 'bootstrap.events'),
    events: Object.freeze(events),
  })
}

export function normalizeFplDraftEventStatus(rawStatus: unknown): FplDraftEventStatus {
  if (!isRecord(rawStatus)) {
    throw new FplDataError('UNEXPECTED_SCHEMA', 'FPL Draft event-status response must be an object')
  }
  const days = readArray(rawStatus, 'status', 'eventStatus').map((rawDay, index) => {
    const context = `eventStatus.status[${index}]`
    if (!isRecord(rawDay)) {
      throw new FplDataError('UNEXPECTED_SCHEMA', `${context} must be an object`)
    }
    const code = readString(rawDay, 'points', context)
    const pointsStatus = pointsStatusByCode[code]
    if (pointsStatus === undefined) {
      throw new FplDataError('UNEXPECTED_SCHEMA', `${context}.points contains unknown code ${code}`)
    }
    const date = readNonEmptyString(rawDay, 'date', context)
    if (Number.isNaN(Date.parse(`${date}T00:00:00Z`))) {
      throw new FplDataError('UNEXPECTED_SCHEMA', `${context}.date must be an ISO date`)
    }
    return Object.freeze({
      date,
      eventId: readPositiveInteger(rawDay, 'event', context),
      pointsStatus,
      bonusAdded: readBoolean(rawDay, 'bonus_added', context),
      leaguesUpdated: readBoolean(rawDay, 'leagues_updated', context),
    })
  })
  const leagueTableStatus = readString(rawStatus, 'leagues', 'eventStatus').trim() || null
  return Object.freeze({ days: Object.freeze(days), leagueTableStatus })
}

export function deriveFplDraftGameweekState(
  game: FplDraftGame,
  event: FplDraftEvent,
  fixtures: readonly FplDraftFixture[],
): FplDraftGameweekState {
  if (game.currentEventId !== event.eventId) {
    throw new FplDataError(
      'MISSING_REQUIRED_MAPPING',
      `Current game event ${game.currentEventId ?? 'none'} does not match event ${event.eventId}`,
    )
  }
  if (fixtures.length === 0 || fixtures.some((fixture) => fixture.eventId !== event.eventId)) {
    throw new FplDataError(
      'MISSING_REQUIRED_MAPPING',
      `Event ${event.eventId} must have a non-empty, consistently mapped fixture set`,
    )
  }

  const allFixturesStarted = fixtures.every(({ started }) => started)
  const allFixturesFootballComplete = fixtures.every(
    ({ finished, finishedProvisional }) => finished || finishedProvisional,
  )
  const hasLiveFixture = fixtures.some(
    ({ started, finished, finishedProvisional }) => started && !finished && !finishedProvisional,
  )
  let phase: FplDraftGameweekPhase
  if (game.currentEventFinished) phase = 'OFFICIAL_EVENT_MARKED_FINISHED'
  else if (allFixturesFootballComplete) phase = 'FOOTBALL_COMPLETE'
  else if (fixtures.some(({ started }) => started)) phase = 'ACTIVE'
  else phase = 'UPCOMING'

  return Object.freeze({
    eventId: event.eventId,
    phase,
    deadlineTime: event.deadlineTime,
    hasLiveFixture,
    allFixturesStarted,
    allFixturesFootballComplete,
    officialEventFinished: game.currentEventFinished,
    bootstrapEventFinished: event.finished,
  })
}

export async function retrieveFplDraftGame(
  fetchImplementation: FetchImplementation = fetch,
): Promise<FplDraftGame> {
  return normalizeFplDraftGame(
    await retrieveOfficialJson(FPL_DRAFT_GAME_ENDPOINT, 'FPL Draft game', fetchImplementation),
  )
}

export async function retrieveFplDraftEventSchedule(
  fetchImplementation: FetchImplementation = fetch,
): Promise<FplDraftEventSchedule> {
  return normalizeFplDraftEventSchedule(
    await retrieveOfficialJson(
      FPL_DRAFT_BOOTSTRAP_STATIC_ENDPOINT,
      'FPL Draft bootstrap',
      fetchImplementation,
    ),
  )
}

export async function retrieveFplDraftEventStatus(
  fetchImplementation: FetchImplementation = fetch,
): Promise<FplDraftEventStatus> {
  return normalizeFplDraftEventStatus(
    await retrieveOfficialJson(
      FPL_DRAFT_EVENT_STATUS_ENDPOINT,
      'FPL Draft event-status',
      fetchImplementation,
    ),
  )
}
