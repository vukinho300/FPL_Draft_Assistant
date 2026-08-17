import type { DraftConfiguration, ManagerId } from './manager.ts'
import { UnknownManagerError, validateManagerConfiguration } from './manager.ts'

export interface DraftSlot {
  readonly overallPickNumber: number
  readonly roundNumber: number
  readonly pickInRound: number
  readonly managerId: ManagerId
}

export interface ManagerTurn {
  readonly managerId: ManagerId
  readonly pickNumbers: readonly number[]
}

export interface TurnHorizon {
  readonly nextUserPickNumber: number | null
  readonly picksBeforeNextUserPick: number
  readonly opponentPicksBeforeNextUserPick: number
  readonly nextUserPickIsFollowedByConsecutiveUserPick: boolean
  readonly upcomingUserTurnPickNumbers: readonly number[]
  readonly firstPickAfterUpcomingUserTurn: DraftSlot | null
  readonly opponentPicksBeforeFollowingUserTurn: number | null
}

export class InvalidOverallPickNumberError extends Error {
  public readonly received: number
  public readonly scheduleLength: number

  constructor(received: number, scheduleLength: number) {
    super(
      `Overall pick number must be an integer from 1 to ${scheduleLength}; received ${received}`,
    )
    this.name = 'InvalidOverallPickNumberError'
    this.received = received
    this.scheduleLength = scheduleLength
  }
}

export class InvalidCompletedPickCountError extends Error {
  public readonly received: number
  public readonly scheduleLength: number

  constructor(received: number, scheduleLength: number) {
    super(
      `Completed pick count must be an integer from 0 to ${scheduleLength}; received ${received}`,
    )
    this.name = 'InvalidCompletedPickCountError'
    this.received = received
    this.scheduleLength = scheduleLength
  }
}

function assertManagerInSchedule(
  schedule: readonly DraftSlot[],
  managerId: ManagerId,
): void {
  if (!schedule.some((slot) => slot.managerId === managerId)) {
    throw new UnknownManagerError(managerId)
  }
}

export function generateSnakeDraftSchedule(
  configuration: DraftConfiguration,
): readonly DraftSlot[] {
  validateManagerConfiguration(configuration.managers, configuration.userManagerId)

  const slots: DraftSlot[] = []
  const managerCount = configuration.managers.length

  for (let roundIndex = 0; roundIndex < configuration.rounds; roundIndex += 1) {
    const orderedManagers =
      roundIndex % 2 === 0
        ? configuration.managers
        : [...configuration.managers].reverse()

    orderedManagers.forEach((manager, pickIndex) => {
      slots.push(
        Object.freeze({
          overallPickNumber: roundIndex * managerCount + pickIndex + 1,
          roundNumber: roundIndex + 1,
          pickInRound: pickIndex + 1,
          managerId: manager.id,
        }),
      )
    })
  }

  return Object.freeze(slots)
}

export function getManagerPickNumbers(
  schedule: readonly DraftSlot[],
  managerId: ManagerId,
): readonly number[] {
  assertManagerInSchedule(schedule, managerId)
  return Object.freeze(
    schedule
      .filter((slot) => slot.managerId === managerId)
      .map((slot) => slot.overallPickNumber),
  )
}

export function getDraftSlot(
  schedule: readonly DraftSlot[],
  overallPickNumber: number,
): DraftSlot {
  if (
    !Number.isInteger(overallPickNumber) ||
    overallPickNumber < 1 ||
    overallPickNumber > schedule.length
  ) {
    throw new InvalidOverallPickNumberError(overallPickNumber, schedule.length)
  }

  return schedule[overallPickNumber - 1]
}

export function validateCompletedPickCount(
  schedule: readonly DraftSlot[],
  completedPickCount: number,
): void {
  if (
    !Number.isInteger(completedPickCount) ||
    completedPickCount < 0 ||
    completedPickCount > schedule.length
  ) {
    throw new InvalidCompletedPickCountError(completedPickCount, schedule.length)
  }
}

export function getCurrentDraftSlot(
  schedule: readonly DraftSlot[],
  completedPickCount: number,
): DraftSlot | null {
  validateCompletedPickCount(schedule, completedPickCount)
  return schedule[completedPickCount] ?? null
}

export function getCurrentPickerManagerId(
  schedule: readonly DraftSlot[],
  completedPickCount: number,
): ManagerId | null {
  return getCurrentDraftSlot(schedule, completedPickCount)?.managerId ?? null
}

export function getManagerTurns(
  schedule: readonly DraftSlot[],
  managerId: ManagerId,
): readonly ManagerTurn[] {
  assertManagerInSchedule(schedule, managerId)

  const turns: ManagerTurn[] = []
  let currentPicks: number[] = []

  for (const slot of schedule) {
    if (slot.managerId === managerId) {
      currentPicks.push(slot.overallPickNumber)
      continue
    }

    if (currentPicks.length > 0) {
      turns.push(
        Object.freeze({ managerId, pickNumbers: Object.freeze(currentPicks) }),
      )
      currentPicks = []
    }
  }

  if (currentPicks.length > 0) {
    turns.push(Object.freeze({ managerId, pickNumbers: Object.freeze(currentPicks) }))
  }

  return Object.freeze(turns)
}

export function getTurnHorizon(
  schedule: readonly DraftSlot[],
  userManagerId: ManagerId,
  completedPickCount: number,
): TurnHorizon {
  validateCompletedPickCount(schedule, completedPickCount)
  assertManagerInSchedule(schedule, userManagerId)

  const nextUserPickIndex = schedule.findIndex(
    (slot, index) => index >= completedPickCount && slot.managerId === userManagerId,
  )

  if (nextUserPickIndex === -1) {
    return Object.freeze({
      nextUserPickNumber: null,
      picksBeforeNextUserPick: 0,
      opponentPicksBeforeNextUserPick: 0,
      nextUserPickIsFollowedByConsecutiveUserPick: false,
      upcomingUserTurnPickNumbers: Object.freeze([]),
      firstPickAfterUpcomingUserTurn: null,
      opponentPicksBeforeFollowingUserTurn: null,
    })
  }

  const picksBeforeNextUserPick = schedule.slice(completedPickCount, nextUserPickIndex)
  const upcomingUserTurnPickNumbers: number[] = []
  let turnEndIndex = nextUserPickIndex

  while (
    turnEndIndex < schedule.length &&
    schedule[turnEndIndex].managerId === userManagerId
  ) {
    upcomingUserTurnPickNumbers.push(schedule[turnEndIndex].overallPickNumber)
    turnEndIndex += 1
  }

  const followingUserPickIndex = schedule.findIndex(
    (slot, index) => index >= turnEndIndex && slot.managerId === userManagerId,
  )
  const firstPickAfterUpcomingUserTurn = schedule[turnEndIndex] ?? null

  return Object.freeze({
    nextUserPickNumber: schedule[nextUserPickIndex].overallPickNumber,
    picksBeforeNextUserPick: picksBeforeNextUserPick.length,
    opponentPicksBeforeNextUserPick: picksBeforeNextUserPick.filter(
      (slot) => slot.managerId !== userManagerId,
    ).length,
    nextUserPickIsFollowedByConsecutiveUserPick:
      upcomingUserTurnPickNumbers.length > 1,
    upcomingUserTurnPickNumbers: Object.freeze(upcomingUserTurnPickNumbers),
    firstPickAfterUpcomingUserTurn,
    opponentPicksBeforeFollowingUserTurn:
      followingUserPickIndex === -1
        ? null
        : schedule
            .slice(turnEndIndex, followingUserPickIndex)
            .filter((slot) => slot.managerId !== userManagerId).length,
  })
}
