import { describe, expect, it } from 'vitest'

import { createDraftConfiguration, type Manager } from './manager.ts'
import type { Player, Position } from './player.ts'
import { generateSnakeDraftSchedule } from './draftSchedule.ts'
import {
  deriveDraftState,
  DraftPickError,
  recordDraftPick,
  undoLastDraftPick,
  type DraftPick,
} from './draftState.ts'

const names = ['Vuk', 'Diego', 'Kristian', 'Miku', 'Tin', 'Deni']

function managers(count = 6): Manager[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `manager-${index + 1}`,
    displayName: names[index] ?? `Manager ${index + 1}`,
  }))
}

function player(id: string, position: Position = 'MID'): Player {
  return {
    id,
    displayName: `Player ${id}`,
    position,
    club: { id: 'club', name: 'Club', shortName: 'CLU' },
    officialDraftRank: Number(id.replace(/\D/g, '')) || null,
  }
}

function schedule(count = 6) {
  const configured = managers(count)
  return generateSnakeDraftSchedule(createDraftConfiguration(configured, configured[0].id))
}

describe('authoritative sequential draft state', () => {
  it('assigns real six-manager picks 1 through 13 from the snake schedule', () => {
    const slots = schedule()
    expect(slots.slice(0, 13).map(({ managerId }) => managerId)).toEqual([
      'manager-1', 'manager-2', 'manager-3', 'manager-4', 'manager-5', 'manager-6',
      'manager-6', 'manager-5', 'manager-4', 'manager-3', 'manager-2', 'manager-1', 'manager-1',
    ])
    const players = Array.from({ length: 13 }, (_, index) => player(String(index + 1)))
    let history: readonly DraftPick[] = []
    players.forEach((item) => {
      history = recordDraftPick(slots, history, players, item.id)
    })
    expect(history[11].managerId).toBe('manager-1')
    expect(history[12].managerId).toBe('manager-1')
    expect(deriveDraftState(slots, history, players).currentSlot?.managerId).toBe('manager-2')

    const undone = undoLastDraftPick(history)
    const undoneState = deriveDraftState(slots, undone, players)
    expect(undoneState.currentSlot?.overallPickNumber).toBe(13)
    expect(undoneState.availablePlayers.map(({ id }) => id)).toContain('13')
    expect(undoneState.rosters['manager-1'].players).toHaveLength(2)
  })

  it('blocks duplicate players and invalid player IDs', () => {
    const slots = schedule()
    const players = [player('1'), player('2')]
    const history = recordDraftPick(slots, [], players, '1')
    expect(() => recordDraftPick(slots, history, players, '1')).toThrowError(DraftPickError)
    expect(() => recordDraftPick(slots, history, players, 'missing')).toThrowError(
      /Unknown player/,
    )
  })

  it('blocks roster position overflow', () => {
    const slots = schedule(2)
    const players = [
      player('1', 'GK'), player('2', 'MID'), player('3', 'MID'), player('4', 'GK'), player('5', 'GK'),
    ]
    let history: readonly DraftPick[] = []
    for (const item of players.slice(0, 4)) history = recordDraftPick(slots, history, players, item.id)
    expect(() => recordDraftPick(slots, history, players, '5')).toThrowError(/already filled GK/)
  })

  it('derives rosters and availability and undo restores player and picker', () => {
    const slots = schedule()
    const players = [player('1', 'FWD'), player('2', 'GK')]
    const first = recordDraftPick(slots, [], players, '1')
    const second = recordDraftPick(slots, first, players, '2')
    const state = deriveDraftState(slots, second, players)
    expect(state.rosters['manager-1'].players.map(({ id }) => id)).toEqual(['1'])
    expect(state.draftedPlayerIds.has('1')).toBe(true)
    expect(state.availablePlayers).toHaveLength(0)
    const undone = deriveDraftState(slots, undoLastDraftPick(second), players)
    expect(undone.currentSlot?.overallPickNumber).toBe(2)
    expect(undone.availablePlayers.map(({ id }) => id)).toContain('2')
  })

  it.each([2, 16])('completes a generic %i-manager draft', (managerCount) => {
    const slots = schedule(managerCount)
    const positionByRosterIndex: Position[] = [
      'GK', 'GK', 'DEF', 'DEF', 'DEF', 'DEF', 'DEF',
      'MID', 'MID', 'MID', 'MID', 'MID', 'FWD', 'FWD', 'FWD',
    ]
    const players = slots.map((slot, index) =>
      player(String(index + 1), positionByRosterIndex[slots.slice(0, index).filter(({ managerId }) => managerId === slot.managerId).length]),
    )
    let history: readonly DraftPick[] = []
    players.forEach((item) => {
      history = recordDraftPick(slots, history, players, item.id)
    })
    expect(deriveDraftState(slots, history, players).currentSlot).toBeNull()
    expect(() => recordDraftPick(slots, history, players, players[0].id)).toThrowError(
      /draft is complete/i,
    )
  })
})
