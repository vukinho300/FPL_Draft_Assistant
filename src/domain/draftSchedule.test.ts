import { describe, expect, it } from 'vitest'

import {
  generateSnakeDraftSchedule,
  getCurrentDraftSlot,
  getCurrentPickerManagerId,
  getDraftSlot,
  getManagerPickNumbers,
  getManagerTurns,
  getTurnHorizon,
  validateCompletedPickCount,
  type DraftSlot,
} from './draftSchedule.ts'
import { createDraftConfiguration, type Manager } from './manager.ts'

const realManagers: readonly Manager[] = [
  { id: 'manager-vuk', displayName: 'Vuk' },
  { id: 'manager-diego', displayName: 'Diego' },
  { id: 'manager-kristian', displayName: 'Kristian' },
  { id: 'manager-miku', displayName: 'Miku' },
  { id: 'manager-tin', displayName: 'Tin' },
  { id: 'manager-deni', displayName: 'Deni' },
]

function configuredManagers(count: number): readonly Manager[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `manager-${index + 1}`,
    displayName: `Manager ${index + 1}`,
  }))
}

function scheduleFor(managers: readonly Manager[], userIndex = 0): readonly DraftSlot[] {
  return generateSnakeDraftSchedule(
    createDraftConfiguration(managers, managers[userIndex].id),
  )
}

function realSchedule(): readonly DraftSlot[] {
  return scheduleFor(realManagers)
}

describe('snake schedule generation', () => {
  it('uses forward, reversed, then forward manager order for the first three rounds', () => {
    const schedule = realSchedule()
    const roundManagerNames = [1, 2, 3].map((roundNumber) =>
      schedule
        .filter((slot) => slot.roundNumber === roundNumber)
        .map((slot) => realManagers.find(({ id }) => id === slot.managerId)?.displayName),
    )

    expect(roundManagerNames).toEqual([
      ['Vuk', 'Diego', 'Kristian', 'Miku', 'Tin', 'Deni'],
      ['Deni', 'Tin', 'Miku', 'Kristian', 'Diego', 'Vuk'],
      ['Vuk', 'Diego', 'Kristian', 'Miku', 'Tin', 'Deni'],
    ])
  })

  it.each([
    { managers: 2, expectedSlots: 30 },
    { managers: 6, expectedSlots: 90 },
    { managers: 16, expectedSlots: 240 },
  ])('generates all 15 rounds and $expectedSlots slots for $managers managers', (example) => {
    const configured = configuredManagers(example.managers)
    const schedule = scheduleFor(configured)

    expect(schedule).toHaveLength(example.expectedSlots)
    expect(new Set(schedule.map(({ roundNumber }) => roundNumber))).toEqual(
      new Set(Array.from({ length: 15 }, (_, index) => index + 1)),
    )
  })

  it('uses one-based values at the first pick, round boundaries, and final pick', () => {
    const schedule = realSchedule()

    expect(getDraftSlot(schedule, 1)).toEqual({
      overallPickNumber: 1,
      roundNumber: 1,
      pickInRound: 1,
      managerId: 'manager-vuk',
    })
    expect(getDraftSlot(schedule, 6)).toMatchObject({ roundNumber: 1, pickInRound: 6 })
    expect(getDraftSlot(schedule, 7)).toMatchObject({ roundNumber: 2, pickInRound: 1 })
    expect(getDraftSlot(schedule, 12)).toMatchObject({ roundNumber: 2, pickInRound: 6 })
    expect(getDraftSlot(schedule, 13)).toMatchObject({ roundNumber: 3, pickInRound: 1 })
    expect(getDraftSlot(schedule, 90)).toEqual({
      overallPickNumber: 90,
      roundNumber: 15,
      pickInRound: 6,
      managerId: 'manager-deni',
    })
  })

  it.each([0, 91, -1, 1.5])('rejects invalid overall pick number %s', (pickNumber) => {
    expect(() => getDraftSlot(realSchedule(), pickNumber)).toThrowError(
      expect.objectContaining({
        name: 'InvalidOverallPickNumberError',
        received: pickNumber,
        scheduleLength: 90,
      }),
    )
  })
})

describe('real six-manager schedule', () => {
  it('matches the exact first four rounds', () => {
    const expected = [
      [1, 1, 1, 'manager-vuk'],
      [2, 1, 2, 'manager-diego'],
      [3, 1, 3, 'manager-kristian'],
      [4, 1, 4, 'manager-miku'],
      [5, 1, 5, 'manager-tin'],
      [6, 1, 6, 'manager-deni'],
      [7, 2, 1, 'manager-deni'],
      [8, 2, 2, 'manager-tin'],
      [9, 2, 3, 'manager-miku'],
      [10, 2, 4, 'manager-kristian'],
      [11, 2, 5, 'manager-diego'],
      [12, 2, 6, 'manager-vuk'],
      [13, 3, 1, 'manager-vuk'],
      [14, 3, 2, 'manager-diego'],
      [15, 3, 3, 'manager-kristian'],
      [16, 3, 4, 'manager-miku'],
      [17, 3, 5, 'manager-tin'],
      [18, 3, 6, 'manager-deni'],
      [19, 4, 1, 'manager-deni'],
      [20, 4, 2, 'manager-tin'],
      [21, 4, 3, 'manager-miku'],
      [22, 4, 4, 'manager-kristian'],
      [23, 4, 5, 'manager-diego'],
      [24, 4, 6, 'manager-vuk'],
    ]

    expect(
      realSchedule()
        .slice(0, 24)
        .map(({ overallPickNumber, roundNumber, pickInRound, managerId }) => [
          overallPickNumber,
          roundNumber,
          pickInRound,
          managerId,
        ]),
    ).toEqual(expected)
  })

  it.each([
    {
      managerId: 'manager-vuk',
      picks: [1, 12, 13, 24, 25, 36, 37, 48, 49, 60, 61, 72, 73, 84, 85],
    },
    {
      managerId: 'manager-diego',
      picks: [2, 11, 14, 23, 26, 35, 38, 47, 50, 59, 62, 71, 74, 83, 86],
    },
    {
      managerId: 'manager-kristian',
      picks: [3, 10, 15, 22, 27, 34, 39, 46, 51, 58, 63, 70, 75, 82, 87],
    },
    {
      managerId: 'manager-deni',
      picks: [6, 7, 18, 19, 30, 31, 42, 43, 54, 55, 66, 67, 78, 79, 90],
    },
  ])('derives the exact picks for $managerId', ({ managerId, picks }) => {
    expect(getManagerPickNumbers(realSchedule(), managerId)).toEqual(picks)
  })

  it('derives picks for another league size and a user who does not draft first', () => {
    const managers = configuredManagers(4)
    expect(getManagerPickNumbers(scheduleFor(managers, 2), 'manager-3')).toEqual([
      3, 6, 11, 14, 19, 22, 27, 30, 35, 38, 43, 46, 51, 54, 59,
    ])
  })

  it('derives Vuk turns from adjacent schedule entries', () => {
    expect(getManagerTurns(realSchedule(), 'manager-vuk').map(({ pickNumbers }) => pickNumbers))
      .toEqual([
        [1],
        [12, 13],
        [24, 25],
        [36, 37],
        [48, 49],
        [60, 61],
        [72, 73],
        [84, 85],
      ])
  })
})

describe('completed pick count and current picker', () => {
  it.each([
    { completed: 0, pick: 1, managerId: 'manager-vuk' },
    { completed: 1, pick: 2, managerId: 'manager-diego' },
    { completed: 11, pick: 12, managerId: 'manager-vuk' },
    { completed: 12, pick: 13, managerId: 'manager-vuk' },
  ])('returns the scheduled slot after $completed completed picks', (example) => {
    const schedule = realSchedule()
    expect(getCurrentDraftSlot(schedule, example.completed)).toMatchObject({
      overallPickNumber: example.pick,
      managerId: example.managerId,
    })
    expect(getCurrentPickerManagerId(schedule, example.completed)).toBe(example.managerId)
  })

  it('represents a completed draft with no current picker', () => {
    const schedule = realSchedule()
    expect(getCurrentDraftSlot(schedule, schedule.length)).toBeNull()
    expect(getCurrentPickerManagerId(schedule, schedule.length)).toBeNull()
  })

  it.each([-1, 91, 1.5])('rejects invalid completed pick count %s', (completedPickCount) => {
    expect(() => validateCompletedPickCount(realSchedule(), completedPickCount)).toThrowError(
      expect.objectContaining({
        name: 'InvalidCompletedPickCountError',
        received: completedPickCount,
        scheduleLength: 90,
      }),
    )
  })
})

describe('Turn Horizon', () => {
  it.each([
    {
      completed: 1,
      next: 12,
      before: 10,
      turn: [12, 13],
      consecutive: true,
      afterTurn: 14,
      beforeFollowingTurn: 10,
    },
    {
      completed: 11,
      next: 12,
      before: 0,
      turn: [12, 13],
      consecutive: true,
      afterTurn: 14,
      beforeFollowingTurn: 10,
    },
    {
      completed: 12,
      next: 13,
      before: 0,
      turn: [13],
      consecutive: false,
      afterTurn: 14,
      beforeFollowingTurn: 10,
    },
    {
      completed: 13,
      next: 24,
      before: 10,
      turn: [24, 25],
      consecutive: true,
      afterTurn: 26,
      beforeFollowingTurn: 10,
    },
    {
      completed: 73,
      next: 84,
      before: 10,
      turn: [84, 85],
      consecutive: true,
      afterTurn: 86,
      beforeFollowingTurn: null,
    },
  ])('derives Vuk horizon after $completed completed picks', (example) => {
    const horizon = getTurnHorizon(realSchedule(), 'manager-vuk', example.completed)

    expect(horizon).toMatchObject({
      nextUserPickNumber: example.next,
      picksBeforeNextUserPick: example.before,
      opponentPicksBeforeNextUserPick: example.before,
      nextUserPickIsFollowedByConsecutiveUserPick: example.consecutive,
      upcomingUserTurnPickNumbers: example.turn,
      opponentPicksBeforeFollowingUserTurn: example.beforeFollowingTurn,
    })
    expect(horizon.firstPickAfterUpcomingUserTurn?.overallPickNumber ?? null).toBe(
      example.afterTurn,
    )
  })

  it('reports no future Vuk picks after Pick 85', () => {
    expect(getTurnHorizon(realSchedule(), 'manager-vuk', 85)).toEqual({
      nextUserPickNumber: null,
      picksBeforeNextUserPick: 0,
      opponentPicksBeforeNextUserPick: 0,
      nextUserPickIsFollowedByConsecutiveUserPick: false,
      upcomingUserTurnPickNumbers: [],
      firstPickAfterUpcomingUserTurn: null,
      opponentPicksBeforeFollowingUserTurn: null,
    })
  })

  it('reports no future user picks when the full draft is complete', () => {
    const schedule = realSchedule()
    expect(getTurnHorizon(schedule, 'manager-vuk', 90).nextUserPickNumber).toBeNull()
    expect(getCurrentDraftSlot(schedule, 90)).toBeNull()
  })

  it('derives ten opponent picks between each completed Vuk edge turn', () => {
    for (const completedPickCount of [1, 13, 25, 37, 49, 61, 73]) {
      expect(
        getTurnHorizon(realSchedule(), 'manager-vuk', completedPickCount)
          .opponentPicksBeforeNextUserPick,
      ).toBe(10)
    }
  })

  it.each([
    { slot: 2, userIndex: 1, completed: 2, next: 11, opponents: 8, turn: [11] },
    { slot: 3, userIndex: 2, completed: 3, next: 10, opponents: 6, turn: [10] },
    { slot: 6, userIndex: 5, completed: 0, next: 6, opponents: 5, turn: [6, 7] },
  ])('remains generic for first-round slot $slot', (example) => {
    const schedule = scheduleFor(realManagers, example.userIndex)
    const managerId = realManagers[example.userIndex].id
    expect(getTurnHorizon(schedule, managerId, example.completed)).toMatchObject({
      nextUserPickNumber: example.next,
      opponentPicksBeforeNextUserPick: example.opponents,
      upcomingUserTurnPickNumbers: example.turn,
    })
  })
})

describe('immutability', () => {
  it('does not mutate supplied manager arrays or schedules', () => {
    const supplied = realManagers.map((manager) => ({ ...manager }))
    const originalManagers = structuredClone(supplied)
    const schedule = scheduleFor(supplied)
    const originalSchedule = structuredClone(schedule)

    getManagerPickNumbers(schedule, 'manager-vuk')
    getManagerTurns(schedule, 'manager-vuk')
    getTurnHorizon(schedule, 'manager-vuk', 13)

    expect(supplied).toEqual(originalManagers)
    expect(schedule).toEqual(originalSchedule)
    expect(Object.isFrozen(schedule)).toBe(true)
    expect(schedule.every(Object.isFrozen)).toBe(true)
  })
})
