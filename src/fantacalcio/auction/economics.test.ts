import { describe, expect, it } from 'vitest'

import type { ManagerSummary } from './ledger.ts'
import { bestAlternatives, decisionState, loadAuctionValueRelease, marketComparison, parseAuctionValueRelease, rankAvailable, recommendedMax, replacementLevel, type AuctionValuePlayer } from './economics.ts'

function player(index: number, role: AuctionValuePlayer['role'] = 'ATT', projection = 200 - index * 10, fvm = 100 - index * 5): AuctionValuePlayer {
  return { playerRef: `fantacalcio:fc:${index}`, displayName: `Player ${index}`, club: 'Roma', role, eligibility: 'SELECTABLE',
    projection, positionRank: index, overallRank: index, confidence: index % 2 ? 'LOW' : 'MEDIUM', fvm, fvm500: fvm / 2 }
}

const manager = (credits = 500, att = 6): ManagerSummary => ({ remainingCredits: credits,
  remainingSlots: { POR: 3, DIF: 8, CEN: 8, ATT: att }, totalRemainingSlots: 19 + att, maxLegalBid: credits - (18 + att) })

describe('Fantacalcio auction economics', () => {
  const values = [player(1), player(2), player(3), player(4), player(5), player(6), player(7), player(8)]

  it('ranks available players by model rank and excludes sold players and alternatives', () => {
    const sold = new Set([values[0]!.playerRef])
    expect(rankAvailable(values, 'ATT', sold).map((candidate) => candidate.playerRef)).toEqual(values.slice(1).map((candidate) => candidate.playerRef))
    expect(bestAlternatives(values, values[1]!, sold, 3).map((candidate) => candidate.playerRef)).toEqual(values.slice(2, 5).map((candidate) => candidate.playerRef))
  })

  it('uses FVM divided by two and exposes model versus market disagreement', () => {
    expect(values[0]!.fvm500).toBe(values[0]!.fvm / 2)
    const reversedMarket = values.map((candidate, index) => ({ ...candidate, fvm: index * 10, fvm500: index * 5 }))
    expect(marketComparison(reversedMarket[0]!, reversedMarket).signal).toBe('MODEL > MARKET')
  })

  it('derives replacement projection from remaining league demand', () => {
    expect(replacementLevel(values, 'ATT', new Set(), 4)).toBe(values[3]!.projection)
    expect(replacementLevel(values, 'ATT', new Set([values[0]!.playerRef]), 4)).toBe(values[4]!.projection)
  })

  it('caps recommended max by the legal max and preserves minimum future credits', () => {
    const vuk = manager(40, 4)
    const result = recommendedMax({ player: values[0]!, players: values, soldRefs: new Set(), vuk, allManagers: Array.from({ length: 8 }, () => manager()), minimumPrice: 1 })
    expect(result.recommendedMax).toBeLessThanOrEqual(vuk.maxLegalBid)
    expect(vuk.remainingCredits - result.recommendedMax).toBeGreaterThanOrEqual(vuk.totalRemainingSlots - 1)
  })

  it('raises the buy ceiling when comparable alternatives disappear and lowers it with less budget', () => {
    const baseline = recommendedMax({ player: values[0]!, players: values, soldRefs: new Set(), vuk: manager(), allManagers: Array.from({ length: 8 }, () => manager()), minimumPrice: 1 })
    const scarce = recommendedMax({ player: values[0]!, players: values, soldRefs: new Set(values.slice(1, 4).map((candidate) => candidate.playerRef)), vuk: manager(), allManagers: Array.from({ length: 8 }, () => manager()), minimumPrice: 1 })
    const constrained = recommendedMax({ player: values[0]!, players: values, soldRefs: new Set(), vuk: manager(100), allManagers: Array.from({ length: 8 }, () => manager()), minimumPrice: 1 })
    const oneSlot = recommendedMax({ player: values[0]!, players: values, soldRefs: new Set(), vuk: manager(500, 1), allManagers: Array.from({ length: 8 }, () => manager()), minimumPrice: 1 })
    expect(scarce.recommendedMax).toBeGreaterThan(baseline.recommendedMax)
    expect(constrained.recommendedMax).toBeLessThan(baseline.recommendedMax)
    expect(oneSlot.recommendedMax).toBeLessThan(baseline.recommendedMax)
  })

  it('uses explicit decision thresholds', () => {
    expect(decisionState(20, 100)).toBe('GOOD VALUE')
    expect(decisionState(80, 100)).toBe('REASONABLE')
    expect(decisionState(95, 100)).toBe('NEAR LIMIT')
    expect(decisionState(101, 100)).toBe('STOP / SAVE')
  })

  it('parses a complete release and enforces the frozen checksum before use', async () => {
    const rows = Array.from({ length: 534 }, (_, index) => `fantacalcio:fc:${index + 1},Player ${index + 1},Roma,ATT,${200 - index / 10},remaining_source_fantavoto_sum_proxy,${index + 1},${index + 1},LOW,0,0,band,1,1,1,1,1,1,1,1,1,1,1,33,${100 - index / 10},1,[]`)
    const csv = `playerRef,name,club,role,projection,projection_unit,position_rank,overall_rank,confidence,uncertainty_lower,uncertainty_upper,uncertainty_kind,expected_remaining_PV,rated_appearance_probability,expected_FM,availability_current_weight,production_current_weight,prior_full_season_PV_prediction,prior_FM_prediction,prior_source_PV,current_PV,current_MV,current_FM,remaining_opportunities_proxy,FVM_benchmark,quotation_benchmark,warnings\n${rows.join('\n')}\n`
    const parsed = parseAuctionValueRelease(csv)
    expect(parsed).toHaveLength(534)
    expect(parsed[0]!.fvm500).toBe(50)
    await expect(loadAuctionValueRelease(new Blob([csv]))).rejects.toThrow('not the accepted frozen')
  })
})
