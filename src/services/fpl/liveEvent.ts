import type { FetchImplementation } from './client.ts'
import { FplDataError } from './errors.ts'
import { normalizeFplDraftFixtures, type FplDraftFixture } from './fixtures.ts'
import { retrieveOfficialJson } from './requestJson.ts'
import { isRecord, readBoolean, readInteger, readRecord } from './schema.ts'

export interface FplDraftLivePlayerStats {
  readonly minutes: number
  readonly starts: number
  readonly goalsScored: number
  readonly assists: number
  readonly cleanSheets: number
  readonly goalsConceded: number
  readonly ownGoals: number
  readonly penaltiesSaved: number
  readonly penaltiesMissed: number
  readonly yellowCards: number
  readonly redCards: number
  readonly saves: number
  readonly bonus: number
  readonly bonusPointsSystem: number
  readonly defensiveContribution: number
  readonly totalPoints: number
  readonly inDreamTeam: boolean
}

export interface FplDraftLivePlayer {
  readonly elementId: string
  readonly stats: FplDraftLivePlayerStats
}

export interface FplDraftLiveEvent {
  readonly eventId: number
  readonly players: readonly FplDraftLivePlayer[]
  readonly fixtures: readonly FplDraftFixture[]
}

export function getFplDraftLiveEventEndpoint(eventId: number): string {
  if (!Number.isSafeInteger(eventId) || eventId <= 0) {
    throw new FplDataError('MISSING_REQUIRED_MAPPING', 'FPL Draft event ID must be a positive integer')
  }
  return `https://draft.premierleague.com/api/event/${eventId}/live`
}

function normalizeStats(rawStats: Record<string, unknown>, context: string): FplDraftLivePlayerStats {
  return Object.freeze({
    minutes: readInteger(rawStats, 'minutes', context),
    starts: readInteger(rawStats, 'starts', context),
    goalsScored: readInteger(rawStats, 'goals_scored', context),
    assists: readInteger(rawStats, 'assists', context),
    cleanSheets: readInteger(rawStats, 'clean_sheets', context),
    goalsConceded: readInteger(rawStats, 'goals_conceded', context),
    ownGoals: readInteger(rawStats, 'own_goals', context),
    penaltiesSaved: readInteger(rawStats, 'penalties_saved', context),
    penaltiesMissed: readInteger(rawStats, 'penalties_missed', context),
    yellowCards: readInteger(rawStats, 'yellow_cards', context),
    redCards: readInteger(rawStats, 'red_cards', context),
    saves: readInteger(rawStats, 'saves', context),
    bonus: readInteger(rawStats, 'bonus', context),
    bonusPointsSystem: readInteger(rawStats, 'bps', context),
    defensiveContribution: readInteger(rawStats, 'defensive_contribution', context),
    totalPoints: readInteger(rawStats, 'total_points', context),
    inDreamTeam: readBoolean(rawStats, 'in_dreamteam', context),
  })
}

export function normalizeFplDraftLiveEvent(rawLive: unknown, eventId: number): FplDraftLiveEvent {
  getFplDraftLiveEventEndpoint(eventId)
  if (!isRecord(rawLive)) {
    throw new FplDataError('UNEXPECTED_SCHEMA', 'FPL Draft live-event response must be an object')
  }
  const rawElements = readRecord(rawLive, 'elements', 'liveEvent')
  const players = Object.entries(rawElements).map(([rawElementId, rawElement]) => {
    if (!/^[1-9]\d*$/.test(rawElementId) || !isRecord(rawElement)) {
      throw new FplDataError('UNEXPECTED_SCHEMA', `liveEvent.elements.${rawElementId} is invalid`)
    }
    return Object.freeze({
      elementId: rawElementId,
      stats: normalizeStats(
        readRecord(rawElement, 'stats', `liveEvent.elements.${rawElementId}`),
        `liveEvent.elements.${rawElementId}.stats`,
      ),
    })
  }).sort((left, right) => Number(left.elementId) - Number(right.elementId))

  return Object.freeze({
    eventId,
    players: Object.freeze(players),
    fixtures: normalizeFplDraftFixtures(rawLive.fixtures, eventId),
  })
}

export async function retrieveFplDraftLiveEvent(
  eventId: number,
  fetchImplementation: FetchImplementation = fetch,
): Promise<FplDraftLiveEvent> {
  const endpoint = getFplDraftLiveEventEndpoint(eventId)
  const raw = await retrieveOfficialJson(endpoint, 'FPL Draft live-event', fetchImplementation)
  return normalizeFplDraftLiveEvent(raw, eventId)
}
