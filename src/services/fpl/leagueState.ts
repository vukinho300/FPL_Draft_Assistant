import type { OfficialLeagueIdentityEvidence } from '../../data/leagues/kile-n-others/officialLeagueIdentity.ts'
import type { Player } from '../../domain/player.ts'
import type { ManagerId } from '../../domain/manager.ts'
import { FplDataError } from './errors.ts'
import type { FplDraftEntryEventLineup } from './entryEvent.ts'
import type { FplDraftLeagueElementStatuses } from './leagueElementStatus.ts'
import type { FplDraftLiveEvent } from './liveEvent.ts'

export interface VerifiedFplDraftParticipantState {
  readonly officialEntryId: number
  readonly teamName: string
  readonly rosterManagerId: ManagerId
  readonly lineupPlayerCount: number
  readonly ownedPlayerCount: number
}

export interface VerifiedFplDraftLeagueState {
  readonly leagueId: number
  readonly eventId: number
  readonly playerCount: number
  readonly availablePlayerCount: number
  readonly ownedPlayerCount: number
  readonly lockedPlayerCount: number
  readonly participants: readonly VerifiedFplDraftParticipantState[]
}

function fail(message: string): never {
  throw new FplDataError('MISSING_REQUIRED_MAPPING', message)
}

export function verifyFplDraftLeagueState(
  identity: OfficialLeagueIdentityEvidence,
  players: readonly Player[],
  lineups: readonly FplDraftEntryEventLineup[],
  liveEvent: FplDraftLiveEvent,
  elementStatuses: FplDraftLeagueElementStatuses,
): VerifiedFplDraftLeagueState {
  if (elementStatuses.leagueId !== identity.leagueId) {
    fail(`Element status league ${elementStatuses.leagueId} does not match ${identity.leagueId}`)
  }
  if (lineups.length !== identity.participants.length) {
    fail('Official lineup collection must contain exactly the six verified league entries')
  }

  const playerById = new Map(players.map((player) => [player.id, player]))
  if (playerById.size !== players.length) fail('Normalized player pool contains duplicate IDs')
  const liveIds = new Set(liveEvent.players.map(({ elementId }) => elementId))
  if (liveIds.size !== liveEvent.players.length) fail('Live event contains duplicate player IDs')
  if (liveIds.size !== playerById.size || [...playerById.keys()].some((id) => !liveIds.has(id))) {
    fail('Live event player IDs do not exactly match the normalized current player pool')
  }

  const identityByEntry = new Map(
    identity.participants.map((participant) => [participant.officialEntryId, participant]),
  )
  const lineupByEntry = new Map(lineups.map((lineup) => [lineup.officialEntryId, lineup]))
  if (identityByEntry.size !== identity.participants.length || lineupByEntry.size !== lineups.length) {
    fail('Official participant or lineup entry IDs are duplicated')
  }
  const eventIds = new Set(lineups.map(({ eventId }) => eventId))
  if (eventIds.size !== 1 || !eventIds.has(liveEvent.eventId)) {
    fail('All official lineups and live scoring must reference one identical event')
  }

  lineups.forEach((lineup) => {
    if (!identityByEntry.has(lineup.officialEntryId)) {
      fail(`Lineup references unknown official entry ${lineup.officialEntryId}`)
    }
    const selections = [...lineup.starters, ...lineup.bench]
    selections.forEach(({ elementId }) => {
      if (!playerById.has(elementId)) fail(`Lineup references unknown player ${elementId}`)
    })
    const benchGoalkeeper = playerById.get(lineup.bench[0]?.elementId ?? '')
    if (lineup.starters.length !== 11 || lineup.bench.length !== 4 || benchGoalkeeper?.position !== 'GK') {
      fail(`Official entry ${lineup.officialEntryId} does not have verified XI + ordered GK/1/2/3 bench semantics`)
    }
  })
  identity.participants.forEach(({ officialEntryId }) => {
    if (!lineupByEntry.has(officialEntryId)) fail(`Official entry ${officialEntryId} has no lineup`)
  })

  const statusByPlayer = new Map(elementStatuses.elements.map((status) => [status.elementId, status]))
  if (
    statusByPlayer.size !== elementStatuses.elements.length
    || statusByPlayer.size !== playerById.size
    || [...playerById.keys()].some((id) => !statusByPlayer.has(id))
  ) {
    fail('Element-status player IDs do not exactly match the normalized current player pool')
  }
  const ownedCountByEntry = new Map<number, number>()
  elementStatuses.elements.forEach((status) => {
    if (status.officialOwnerEntryId === null) return
    if (!identityByEntry.has(status.officialOwnerEntryId)) {
      fail(`Player ${status.elementId} references unknown owner ${status.officialOwnerEntryId}`)
    }
    ownedCountByEntry.set(
      status.officialOwnerEntryId,
      (ownedCountByEntry.get(status.officialOwnerEntryId) ?? 0) + 1,
    )
  })

  const participants = identity.participants.map((participant) => {
    const ownedPlayerCount = ownedCountByEntry.get(participant.officialEntryId) ?? 0
    if (ownedPlayerCount !== 15) {
      fail(`Official entry ${participant.officialEntryId} owns ${ownedPlayerCount} players instead of 15`)
    }
    const lineup = lineupByEntry.get(participant.officialEntryId)
    if (lineup === undefined) fail(`Official entry ${participant.officialEntryId} has no lineup`)
    return Object.freeze({
      officialEntryId: participant.officialEntryId,
      teamName: participant.teamName,
      rosterManagerId: participant.rosterManagerId,
      lineupPlayerCount: lineup.starters.length + lineup.bench.length,
      ownedPlayerCount,
    })
  })

  const count = (availability: 'AVAILABLE' | 'OWNED' | 'LOCKED') => (
    elementStatuses.elements.filter((status) => status.availability === availability).length
  )
  return Object.freeze({
    leagueId: identity.leagueId,
    eventId: liveEvent.eventId,
    playerCount: players.length,
    availablePlayerCount: count('AVAILABLE'),
    ownedPlayerCount: count('OWNED'),
    lockedPlayerCount: count('LOCKED'),
    participants: Object.freeze(participants),
  })
}
