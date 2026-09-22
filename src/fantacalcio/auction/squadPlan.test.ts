import { describe, expect, it } from 'vitest'

import { AUCTION_ROLES, replayAuction, summarizeManager, type AuctionConfig, type AuctionEvent, type AuctionRole, type SaleEvent } from './ledger.ts'
import type { AuctionValuePlayer } from './economics.ts'
import { buildSquadBudgetPlan, rosterAdjustedMax } from './squadPlan.ts'

const config: AuctionConfig = { initialCredits: 500, minimumPrice: 1, requiredSlots: { POR: 3, DIF: 8, CEN: 8, ATT: 6 } }
const managerIds = Array.from({ length: 8 }, (_, index) => `manager-${index + 1}`)
const vukId = managerIds[3]!
const roleCounts: Record<AuctionRole, number> = { POR: 12, DIF: 24, CEN: 24, ATT: 18 }
const roleBaseProjection: Record<AuctionRole, number> = { POR: 130, DIF: 210, CEN: 230, ATT: 250 }
const roleBaseCost: Record<AuctionRole, number> = { POR: 30, DIF: 55, CEN: 65, ATT: 85 }

const players = AUCTION_ROLES.flatMap((role) => Array.from({ length: roleCounts[role] }, (_, index): AuctionValuePlayer => {
  const fvm500 = Math.max(1, roleBaseCost[role] - index * 3)
  return { playerRef: `fantacalcio:${role}:${index + 1}`, displayName: `${role} Player ${index + 1}`, club: 'Test', role,
    eligibility: 'SELECTABLE', projection: roleBaseProjection[role] - index * 1.8, positionRank: index + 1,
    overallRank: index + 1, confidence: index % 2 === 0 ? 'MEDIUM' : 'LOW', fvm: fvm500 * 2, fvm500 }
}))

function sale(sequenceNo: number, managerId: string, player: AuctionValuePlayer, price: number): SaleEvent {
  return { id: `sale-${sequenceNo}`, clientRequestId: `request-${sequenceNo}`, sequenceNo, kind: 'SALE', managerId,
    playerRef: player.playerRef, role: player.role, price }
}

function plan(events: readonly AuctionEvent[] = []) {
  const state = replayAuction(config, managerIds, events)
  const allManagers = managerIds.map((managerId) => summarizeManager(state, managerId))
  const vuk = summarizeManager(state, vukId)
  const soldRefs = new Set(state.activeSalesByPlayer.keys())
  const vukSales = [...state.activeSalesByPlayer.values()].filter((event) => event.managerId === vukId)
  const result = buildSquadBudgetPlan({ players, soldRefs, vuk, allManagers, vukSales, config })
  if (result === null) throw new Error('Expected a feasible squad plan')
  return { result, state, allManagers, vuk, soldRefs }
}

describe('Fantacalcio dynamic squad budget plan', () => {
  it('optimizes a deterministic feasible 25-player roster without fixed role percentages', () => {
    const first = plan().result
    const second = plan().result
    expect(AUCTION_ROLES.reduce((sum, role) => sum + first.roles[role].initialTargetBudget, 0)).toBeLessThanOrEqual(500)
    expect(first.initialRoster.players).toHaveLength(25)
    for (const role of AUCTION_ROLES) expect(first.initialRoster.players.filter((player) => player.role === role)).toHaveLength(config.requiredSlots[role])
    expect(first.initialRoster.totalCost).toBeGreaterThanOrEqual(25)
    expect(first.initialRoster.players.map((player) => player.playerRef)).toEqual(second.initialRoster.players.map((player) => player.playerRef))
    expect(first.roles).toEqual(second.roles)
  })

  it('tracks a premium defender purchase and preserves buying power for every remaining role', () => {
    const initial = plan().result
    const premiumDefender = players.find((player) => player.role === 'DIF' && initial.tierByPlayerRef.get(player.playerRef) === 'PREMIUM')!
    expect(premiumDefender).toBeDefined()
    const after = plan([sale(1, vukId, premiumDefender, Math.ceil(premiumDefender.fvm500))]).result
    expect(after.roles.DIF.tierAcquired.PREMIUM).toBe(1)
    expect(after.roles.DIF.spent).toBe(Math.ceil(premiumDefender.fvm500))
    expect(after.remainingRoster.players).toHaveLength(24)
    expect(after.remainingRoster.totalCost).toBeLessThanOrEqual(after.total.remaining)
    expect(after.remainingRoster.totalCost).toBeGreaterThanOrEqual(after.total.minimumObligations)
    for (const role of AUCTION_ROLES) expect(after.remainingRoster.players.filter((player) => player.role === role)).toHaveLength(after.roles[role].remainingSlots)
  })

  it('reduces a second premium defender ceiling after a premium purchase but still accepts an exceptional cheap price', () => {
    const before = plan()
    const premiumDefenders = players.filter((player) => player.role === 'DIF' && before.result.tierByPlayerRef.get(player.playerRef) === 'PREMIUM')
    const firstPremium = premiumDefenders[0]!
    const secondPremium = premiumDefenders[1]!
    const beforeGuidance = rosterAdjustedMax({ player: secondPremium, playerMax: 100, players, soldRefs: before.soldRefs,
      vuk: before.vuk, allManagers: before.allManagers, minimumPrice: 1, plan: before.result })
    const after = plan([sale(1, vukId, firstPremium, Math.ceil(firstPremium.fvm500))])
    const afterGuidance = rosterAdjustedMax({ player: secondPremium, playerMax: 100, players, soldRefs: after.soldRefs,
      vuk: after.vuk, allManagers: after.allManagers, minimumPrice: 1, plan: after.result })
    expect(afterGuidance.max).toBeLessThan(beforeGuidance.max)
    expect(afterGuidance.max).toBeGreaterThanOrEqual(config.minimumPrice)
    expect(afterGuidance.max).toBeLessThanOrEqual(after.vuk.maxLegalBid)
  })

  it('undo restores budget and tiers while another manager sale changes league scarcity', () => {
    const initial = plan()
    const premiumDefender = players.find((player) => player.role === 'DIF' && initial.result.tierByPlayerRef.get(player.playerRef) === 'PREMIUM')!
    const sold = sale(1, vukId, premiumDefender, Math.ceil(premiumDefender.fvm500))
    const afterSale = plan([sold]).result
    const afterUndo = plan([sold, { id: 'undo-2', clientRequestId: 'request-2', sequenceNo: 2, kind: 'UNDO', revertsSaleId: sold.id }]).result
    expect(afterSale.roles.DIF.tierAcquired.PREMIUM).toBe(1)
    expect(afterUndo.roles).toEqual(initial.result.roles)
    expect(afterUndo.total).toEqual(initial.result.total)

    const defenders = players.filter((player) => player.role === 'DIF').sort((left, right) => left.positionRank - right.positionRank)
    const replacementIndex = Math.min(defenders.length - 1, config.requiredSlots.DIF * managerIds.length - 1)
    const replacementDefender = defenders[replacementIndex]!
    const afterOpponentSale = plan([sale(1, managerIds[0]!, replacementDefender, 1)]).result
    expect(afterOpponentSale.roles.DIF.replacementProjection).not.toBe(initial.result.roles.DIF.replacementProjection)
  })

  it('keeps roster-adjusted max distinct from player max and below the hard legal max', () => {
    const current = plan()
    const candidate = current.result.initialRoster.players.find((player) => player.role === 'ATT')!
    const guidance = rosterAdjustedMax({ player: candidate, playerMax: 37, players, soldRefs: current.soldRefs,
      vuk: current.vuk, allManagers: current.allManagers, minimumPrice: 1, plan: current.result })
    expect(guidance.max).toBeLessThanOrEqual(current.vuk.maxLegalBid)
    expect(guidance.tier).toBe(current.result.tierByPlayerRef.get(candidate.playerRef))
    expect(guidance.explanation).toBeTruthy()
  })
})
