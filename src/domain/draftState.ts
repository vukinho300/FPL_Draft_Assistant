import { ROSTER_REQUIREMENTS, type PositionCounts } from './league.ts'
import type { ManagerId } from './manager.ts'
import type { Player, PlayerId, Position } from './player.ts'
import type { DraftSlot } from './draftSchedule.ts'
import { getCurrentDraftSlot } from './draftSchedule.ts'

export interface DraftPick {
  readonly overallPickNumber: number
  readonly roundNumber: number
  readonly managerId: ManagerId
  readonly playerId: PlayerId
}

export interface ManagerRoster {
  readonly managerId: ManagerId
  readonly players: readonly Player[]
  readonly positionCounts: PositionCounts
}

export interface DerivedDraftState {
  readonly completedPickCount: number
  readonly currentSlot: DraftSlot | null
  readonly draftedPlayerIds: ReadonlySet<PlayerId>
  readonly availablePlayers: readonly Player[]
  readonly rosters: Readonly<Record<ManagerId, ManagerRoster>>
}

export type DraftPickErrorCode =
  | 'DUPLICATE_PLAYER'
  | 'DRAFT_COMPLETE'
  | 'ROSTER_POSITION_FULL'
  | 'SCHEDULE_HISTORY_MISMATCH'
  | 'INVALID_PLAYER'

export class DraftPickError extends Error {
  public readonly code: DraftPickErrorCode

  constructor(
    code: DraftPickErrorCode,
    message: string,
  ) {
    super(message)
    this.name = 'DraftPickError'
    this.code = code
  }
}

function emptyCounts(): Record<Position, number> {
  return { GK: 0, DEF: 0, MID: 0, FWD: 0 }
}

export function validatePickHistory(
  schedule: readonly DraftSlot[],
  history: readonly DraftPick[],
  players: readonly Player[],
): void {
  if (history.length > schedule.length) {
    throw new DraftPickError('SCHEDULE_HISTORY_MISMATCH', 'Pick history exceeds the schedule')
  }
  const playerById = new Map(players.map((player) => [player.id, player]))
  const drafted = new Set<PlayerId>()
  const countsByManager = new Map<ManagerId, Record<Position, number>>()

  history.forEach((pick, index) => {
    const slot = schedule[index]
    if (
      pick.overallPickNumber !== slot.overallPickNumber ||
      pick.roundNumber !== slot.roundNumber ||
      pick.managerId !== slot.managerId
    ) {
      throw new DraftPickError(
        'SCHEDULE_HISTORY_MISMATCH',
        `Pick history does not match scheduled overall pick ${slot.overallPickNumber}`,
      )
    }
    const player = playerById.get(pick.playerId)
    if (player === undefined) {
      throw new DraftPickError('INVALID_PLAYER', `Unknown player ${pick.playerId}`)
    }
    if (drafted.has(player.id)) {
      throw new DraftPickError('DUPLICATE_PLAYER', `${player.displayName} was already drafted`)
    }
    drafted.add(player.id)
    const counts = countsByManager.get(pick.managerId) ?? emptyCounts()
    counts[player.position] += 1
    if (counts[player.position] > ROSTER_REQUIREMENTS[player.position]) {
      throw new DraftPickError(
        'ROSTER_POSITION_FULL',
        `${pick.managerId} already filled ${player.position}`,
      )
    }
    countsByManager.set(pick.managerId, counts)
  })
}

export function recordDraftPick(
  schedule: readonly DraftSlot[],
  history: readonly DraftPick[],
  players: readonly Player[],
  playerId: PlayerId,
): readonly DraftPick[] {
  validatePickHistory(schedule, history, players)
  const slot = getCurrentDraftSlot(schedule, history.length)
  if (slot === null) {
    throw new DraftPickError('DRAFT_COMPLETE', 'The draft is complete')
  }
  if (!players.some((player) => player.id === playerId)) {
    throw new DraftPickError('INVALID_PLAYER', `Unknown player ${playerId}`)
  }
  const next = Object.freeze([
    ...history,
    Object.freeze({
      overallPickNumber: slot.overallPickNumber,
      roundNumber: slot.roundNumber,
      managerId: slot.managerId,
      playerId,
    }),
  ])
  validatePickHistory(schedule, next, players)
  return next
}

export function undoLastDraftPick(history: readonly DraftPick[]): readonly DraftPick[] {
  return Object.freeze(history.slice(0, -1))
}

export function deriveDraftState(
  schedule: readonly DraftSlot[],
  history: readonly DraftPick[],
  players: readonly Player[],
): DerivedDraftState {
  validatePickHistory(schedule, history, players)
  const playerById = new Map(players.map((player) => [player.id, player]))
  const draftedPlayerIds = new Set(history.map((pick) => pick.playerId))
  const managerIds = [...new Set(schedule.map((slot) => slot.managerId))]
  const rosters: Record<ManagerId, ManagerRoster> = {}

  for (const managerId of managerIds) {
    const rosterPlayers = history
      .filter((pick) => pick.managerId === managerId)
      .map((pick) => playerById.get(pick.playerId) as Player)
    const counts = emptyCounts()
    rosterPlayers.forEach((player) => {
      counts[player.position] += 1
    })
    rosters[managerId] = Object.freeze({
      managerId,
      players: Object.freeze(rosterPlayers),
      positionCounts: Object.freeze(counts),
    })
  }

  return Object.freeze({
    completedPickCount: history.length,
    currentSlot: getCurrentDraftSlot(schedule, history.length),
    draftedPlayerIds,
    availablePlayers: Object.freeze(
      players.filter((player) => !draftedPlayerIds.has(player.id)),
    ),
    rosters: Object.freeze(rosters),
  })
}
