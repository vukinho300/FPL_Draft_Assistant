import {
  FPL_DRAFT_SQUAD_SIZE,
  POSITION_ORDER,
  ROSTER_REQUIREMENTS,
  type PositionCounts,
} from './league.ts'
import { createDraftConfiguration } from './manager.ts'
import type { Club, Player, Position } from './player.ts'
import { generateSnakeDraftSchedule } from './draftSchedule.ts'
import { deriveDraftState, validatePickHistory, type DraftPick } from './draftState.ts'

export interface OfficialDraftManager {
  readonly id: string
  readonly displayName: string
  readonly draftPosition: number
}

export interface ArchivedDraftPlayer {
  readonly draftPlayerId: string
  readonly playerName: string
  readonly position: Position
  readonly club: Club
  readonly officialDraftRankAtDraft: number | null
  readonly modelRankAtDraft: number | null
  readonly modelPositionRankAtDraft: number | null
  readonly mvpConsensusRankAtDraft: number | null
}

export interface OfficialDraftPick extends ArchivedDraftPlayer {
  readonly overallPickNumber: number
  readonly roundNumber: number
  readonly pickInRound: number
  readonly managerId: string
  readonly managerName: string
}

export interface OfficialDraftRosterPlayer extends ArchivedDraftPlayer {
  readonly draftPickNumber: number
}

export interface OfficialFinalRoster {
  readonly managerId: string
  readonly managerName: string
  readonly positionCounts: PositionCounts
  readonly players: readonly OfficialDraftRosterPlayer[]
}

export interface OfficialDraftSnapshot {
  readonly schemaVersion: number
  readonly league: { readonly id: string; readonly name: string }
  readonly season: string
  readonly completedAt: string
  readonly sourceCommit: string
  readonly sourceBrowserOrigin: string
  readonly leagueSettings: {
    readonly managerCount: number
    readonly rounds: number
    readonly squadSize: number
    readonly rosterRequirements: PositionCounts
    readonly userManagerId: string
  }
  readonly managers: readonly OfficialDraftManager[]
  readonly draftOrder: readonly string[]
  readonly rankingSnapshotMetadata: {
    readonly heuristicVersion: string
    readonly officialRankWeight: number
    readonly historicalModelRankWeight: number
    readonly modelArtifact: {
      readonly path: string
      readonly sha256: string
      readonly schemaVersion: number
      readonly generatedAt: string
      readonly model: string
      readonly alpha: number
      readonly modelSignalCount: number
      readonly qualityStatus: string
      readonly leakageStatus: string
      readonly modelSanityStatus: string
    }
    readonly liveSnapshot: {
      readonly sourceUrl: string
      readonly retrievedAt: string
      readonly sha256: string
      readonly playerCount: number
      readonly officialRankCount: number
    }
    readonly reconstructionNotes: string
  }
  readonly picks: readonly OfficialDraftPick[]
  readonly finalRosters: readonly OfficialFinalRoster[]
}

export class OfficialDraftSnapshotError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'OfficialDraftSnapshotError'
  }
}

function invariant(condition: boolean, message: string): asserts condition {
  if (!condition) throw new OfficialDraftSnapshotError(message)
}

function sameCounts(left: PositionCounts, right: PositionCounts): boolean {
  return POSITION_ORDER.every((position) => left[position] === right[position])
}

function deepFreeze<T>(value: T): T {
  if (typeof value !== 'object' || value === null || Object.isFrozen(value)) return value
  Object.values(value).forEach((child) => deepFreeze(child))
  return Object.freeze(value)
}

export function validateOfficialDraftSnapshot(
  value: OfficialDraftSnapshot,
): void {
  invariant(value.schemaVersion === 1, 'Official draft schemaVersion must be 1')
  invariant(value.league.name === 'Kile N Others', 'Unexpected official league name')
  invariant(value.season === '2026/27', 'Unexpected official league season')
  invariant(value.managers.length === 6, 'Official draft must contain six managers')
  invariant(value.draftOrder.length === value.managers.length, 'Draft order is incomplete')
  invariant(value.picks.length === 90, 'Official draft must contain exactly 90 picks')
  invariant(value.finalRosters.length === 6, 'Official draft must contain six final rosters')
  invariant(value.leagueSettings.managerCount === 6, 'League settings manager count must be six')
  invariant(value.leagueSettings.rounds === FPL_DRAFT_SQUAD_SIZE, 'Official draft must contain 15 rounds')
  invariant(value.leagueSettings.squadSize === FPL_DRAFT_SQUAD_SIZE, 'Official squad size must be 15')
  invariant(
    sameCounts(value.leagueSettings.rosterRequirements, ROSTER_REQUIREMENTS),
    'Official roster requirements do not match the FPL Draft contract',
  )

  const configuration = createDraftConfiguration(
    value.managers.map(({ id, displayName }) => ({ id, displayName })),
    value.leagueSettings.userManagerId,
  )
  const expectedOrder = configuration.managers.map(({ id }) => id)
  invariant(
    value.draftOrder.every((managerId, index) => managerId === expectedOrder[index]),
    'Official draft order does not match manager order',
  )
  value.managers.forEach((manager, index) => {
    invariant(manager.draftPosition === index + 1, `Invalid draft position for ${manager.displayName}`)
  })

  const schedule = generateSnakeDraftSchedule(configuration)
  const managerNameById = new Map(value.managers.map((manager) => [manager.id, manager.displayName]))
  const players: Player[] = value.picks.map((pick) => ({
    id: pick.draftPlayerId,
    displayName: pick.playerName,
    position: pick.position,
    club: pick.club,
    officialDraftRank: pick.officialDraftRankAtDraft,
  }))
  const history: DraftPick[] = value.picks.map((pick, index) => {
    const slot = schedule[index]
    invariant(pick.overallPickNumber === index + 1, `Pick ${index + 1} is not sequential`)
    invariant(pick.roundNumber === slot.roundNumber, `Pick ${index + 1} has the wrong round`)
    invariant(pick.pickInRound === slot.pickInRound, `Pick ${index + 1} has the wrong round position`)
    invariant(pick.managerId === slot.managerId, `Pick ${index + 1} has the wrong manager`)
    invariant(
      pick.managerName === managerNameById.get(pick.managerId),
      `Pick ${index + 1} has the wrong manager name`,
    )
    return {
      overallPickNumber: pick.overallPickNumber,
      roundNumber: pick.roundNumber,
      managerId: pick.managerId,
      playerId: pick.draftPlayerId,
    }
  })
  validatePickHistory(schedule, history, players)
  invariant(new Set(history.map(({ playerId }) => playerId)).size === 90, 'Drafted players must be unique')

  const derived = deriveDraftState(schedule, history, players)
  invariant(derived.currentSlot === null, 'Official draft must be complete')
  const pickByPlayerId = new Map(value.picks.map((pick) => [pick.draftPlayerId, pick]))

  value.managers.forEach((manager) => {
    const archivedRoster = value.finalRosters.find(({ managerId }) => managerId === manager.id)
    invariant(archivedRoster !== undefined, `Missing final roster for ${manager.displayName}`)
    invariant(archivedRoster.managerName === manager.displayName, `Wrong roster name for ${manager.displayName}`)
    invariant(archivedRoster.players.length === FPL_DRAFT_SQUAD_SIZE, `${manager.displayName} must have 15 players`)
    invariant(sameCounts(archivedRoster.positionCounts, ROSTER_REQUIREMENTS), `${manager.displayName} has invalid position counts`)
    invariant(
      sameCounts(derived.rosters[manager.id].positionCounts, archivedRoster.positionCounts),
      `${manager.displayName} roster counts do not match the draft history`,
    )
    const derivedIds = derived.rosters[manager.id].players.map(({ id }) => id)
    invariant(
      archivedRoster.players.every((player, index) => player.draftPlayerId === derivedIds[index]),
      `${manager.displayName} roster players do not match the draft history`,
    )
    archivedRoster.players.forEach((player) => {
      const pick = pickByPlayerId.get(player.draftPlayerId)
      invariant(pick !== undefined, `Missing pick for ${player.playerName}`)
      invariant(pick.managerId === manager.id, `${player.playerName} belongs to the wrong manager`)
      invariant(pick.overallPickNumber === player.draftPickNumber, `${player.playerName} has the wrong pick number`)
    })
  })
}

export function createImmutableOfficialDraftSnapshot(
  value: OfficialDraftSnapshot,
): OfficialDraftSnapshot {
  const clone = JSON.parse(JSON.stringify(value)) as OfficialDraftSnapshot
  validateOfficialDraftSnapshot(clone)
  return deepFreeze(clone)
}

export function restoreValidatedDraftPicks(
  snapshot: OfficialDraftSnapshot,
): readonly DraftPick[] {
  validateOfficialDraftSnapshot(snapshot)
  return Object.freeze(snapshot.picks.map((pick) => Object.freeze({
    overallPickNumber: pick.overallPickNumber,
    roundNumber: pick.roundNumber,
    managerId: pick.managerId,
    playerId: pick.draftPlayerId,
  })))
}
