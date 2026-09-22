import { describe, expect, it } from 'vitest'

import { applyAuctionEvent, initialAuctionState, maximumLegalBid, replayAuction, summarizeManager, type AuctionRole, type SaleEvent, type UndoEvent } from './ledger.ts'

const config = {
  initialCredits: 500,
  minimumPrice: 1,
  requiredSlots: { POR: 3, DIF: 8, CEN: 8, ATT: 6 },
} as const

const managers = ['vuk-id', 'achi-id']
const empty = () => initialAuctionState(config, managers)

function sale(sequenceNo: number, role: AuctionRole, price: number, managerId = managers[0], playerRef = `test-player-${sequenceNo}`): SaleEvent {
  return { id: `sale-${sequenceNo}`, clientRequestId: `request-${sequenceNo}`, sequenceNo, kind: 'SALE', managerId, playerRef, role, price }
}

function undo(sequenceNo: number, revertsSaleId: string): UndoEvent {
  return { id: `undo-${sequenceNo}`, clientRequestId: `request-${sequenceNo}`, sequenceNo, kind: 'UNDO', revertsSaleId }
}

describe('Fantacalcio auction ledger', () => {
  it('starts each manager at 500 credits with 25 open slots and opening max 476', () => {
    const state = empty()
    for (const managerId of managers) {
      expect(summarizeManager(state, managerId)).toEqual({
        remainingCredits: 500,
        remainingSlots: { POR: 3, DIF: 8, CEN: 8, ATT: 6 },
        totalRemainingSlots: 25,
        maxLegalBid: 476,
      })
    }
    expect(maximumLegalBid(500, 25, 1)).toBe(476)
    expect(maximumLegalBid(100, 4, 2)).toBe(94)
  })

  it('keeps manager count configurable beyond the initial eight', () => {
    const tenManagers = Array.from({ length: 10 }, (_, index) => `manager-${index + 1}`)
    const state = initialAuctionState(config, tenManagers)
    expect(state.managerIds.size).toBe(10)
    expect(summarizeManager(state, tenManagers[9]).remainingCredits).toBe(500)
  })

  it('records a sale with exact money, slot, ownership and history changes without changing another manager', () => {
    const state = applyAuctionEvent(empty(), sale(1, 'POR', 20))
    expect(summarizeManager(state, managers[0])).toEqual({
      remainingCredits: 480,
      remainingSlots: { POR: 2, DIF: 8, CEN: 8, ATT: 6 },
      totalRemainingSlots: 24,
      maxLegalBid: 457,
    })
    expect(summarizeManager(state, managers[1]).remainingCredits).toBe(500)
    expect(state.activeSalesByPlayer.get('test-player-1')?.managerId).toBe(managers[0])
    expect(state.events).toHaveLength(1)
  })

  it('rejects duplicate ownership, zero price, overbid and duplicate submission identities', () => {
    const first = applyAuctionEvent(empty(), sale(1, 'POR', 20))
    expect(() => applyAuctionEvent(first, sale(2, 'POR', 1, managers[1], 'test-player-1'))).toThrow('already owned')
    expect(() => applyAuctionEvent(empty(), sale(1, 'POR', 0))).toThrow('legal bid')
    expect(() => applyAuctionEvent(empty(), sale(1, 'POR', 477))).toThrow('legal bid')
    expect(() => applyAuctionEvent(first, { ...sale(2, 'POR', 1), clientRequestId: 'request-1' })).toThrow('Duplicate')
  })

  it.each([['POR', 3], ['DIF', 8], ['CEN', 8], ['ATT', 6]] as const)('rejects a role after all %s slots are filled', (role, capacity) => {
    let state = empty()
    for (let sequenceNo = 1; sequenceNo <= capacity; sequenceNo += 1) state = applyAuctionEvent(state, sale(sequenceNo, role, 1))
    expect(summarizeManager(state, managers[0]).remainingSlots[role]).toBe(0)
    expect(() => applyAuctionEvent(state, sale(capacity + 1, role, 1))).toThrow(`No remaining ${role} slot`)
  })

  it('preserves the reserve for every remaining mandatory slot as the auction progresses', () => {
    let state = applyAuctionEvent(empty(), sale(1, 'POR', 476))
    expect(summarizeManager(state, managers[0]).remainingCredits).toBe(24)
    expect(summarizeManager(state, managers[0]).maxLegalBid).toBe(1)
    expect(() => applyAuctionEvent(state, sale(2, 'POR', 2))).toThrow('legal bid')
    state = applyAuctionEvent(state, sale(2, 'POR', 1))
    expect(summarizeManager(state, managers[0]).remainingCredits).toBe(23)
  })

  it('undoes exactly once, restores all state, retains audit history and permits resale', () => {
    const sold = applyAuctionEvent(empty(), sale(1, 'POR', 20))
    const undone = applyAuctionEvent(sold, undo(2, 'sale-1'))
    expect(summarizeManager(undone, managers[0]).remainingCredits).toBe(500)
    expect(summarizeManager(undone, managers[0]).remainingSlots.POR).toBe(3)
    expect(undone.activeSalesByPlayer.has('test-player-1')).toBe(false)
    expect(undone.events.map((event) => event.kind)).toEqual(['SALE', 'UNDO'])
    expect(() => applyAuctionEvent(undone, undo(3, 'sale-1'))).toThrow('already undone')
    const resold = applyAuctionEvent(undone, sale(3, 'POR', 15, managers[1], 'test-player-1'))
    expect(resold.activeSalesByPlayer.get('test-player-1')?.managerId).toBe(managers[1])
  })

  it('reconstructs identical authoritative state from ordered persisted events', () => {
    const events = [sale(1, 'POR', 20), undo(2, 'sale-1'), sale(3, 'DIF', 5, managers[1], 'test-player-1')]
    const live = events.reduce(applyAuctionEvent, empty())
    const loaded = replayAuction(config, managers, events)
    expect([...loaded.activeSalesByPlayer]).toEqual([...live.activeSalesByPlayer])
    expect(loaded.events).toEqual(live.events)
    expect(summarizeManager(loaded, managers[0])).toEqual(summarizeManager(live, managers[0]))
    expect(summarizeManager(loaded, managers[1])).toEqual(summarizeManager(live, managers[1]))
  })
})
