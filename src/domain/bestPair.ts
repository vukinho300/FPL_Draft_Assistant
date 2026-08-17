import { POSITION_DROPOFF_WEIGHT } from './bestFit.ts'
import type { RankedDraftPlayer } from './draftRanking.ts'
import { ROSTER_REQUIREMENTS } from './league.ts'
import type { ManagerId } from './manager.ts'
import type { Player, Position } from './player.ts'
import {
  getCurrentDraftSlot,
  getTurnHorizon,
  type DraftSlot,
} from './draftSchedule.ts'

export const BEST_PAIR_RECOMMENDATION_COUNT = 5
export const BEST_PAIR_MINIMUM_SHORTLIST_SIZE = 12
export const BEST_PAIR_HORIZON_BUFFER = 5

export interface BestPairScenario {
  readonly currentUserTurnPickNumbers: readonly number[]
  readonly followingUserPickNumber: number | null
  readonly opponentSelections: number
}

export interface BestPairPositionFacts {
  readonly position: Position
  readonly selectedConsensusScores: readonly number[]
  readonly replacementConsensusScores: readonly number[]
  readonly jointPositionDropoff: number
  readonly rosterCountBeforePair: number
  readonly rosterCountAfterPair: number
  readonly rosterCapacity: number
  readonly replacementOptionsRemaining: number
}

export interface BestPairRecommendation {
  readonly rankedPlayers: readonly [RankedDraftPlayer, RankedDraftPlayer]
  readonly pairQuality: number
  readonly pairScarcity: number
  readonly bestPairScore: number
  readonly scenario: BestPairScenario
  readonly positionFacts: readonly BestPairPositionFacts[]
  readonly reasons: readonly string[]
}

export interface BestPairResult {
  readonly active: boolean
  readonly scenario: BestPairScenario
  readonly shortlistSize: number
  readonly recommendations: readonly BestPairRecommendation[]
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}

function rosterCounts(players: readonly Player[]): Record<Position, number> {
  const counts: Record<Position, number> = { GK: 0, DEF: 0, MID: 0, FWD: 0 }
  players.forEach((player) => {
    counts[player.position] += 1
  })
  return counts
}

function pairRemainsRosterLegal(
  counts: Readonly<Record<Position, number>>,
  left: RankedDraftPlayer,
  right: RankedDraftPlayer,
): boolean {
  const additions: Record<Position, number> = { GK: 0, DEF: 0, MID: 0, FWD: 0 }
  additions[left.player.position] += 1
  additions[right.player.position] += 1
  return (Object.keys(additions) as Position[]).every(
    (position) => counts[position] + additions[position] <= ROSTER_REQUIREMENTS[position],
  )
}

function getScenario(
  schedule: readonly DraftSlot[],
  userManagerId: ManagerId,
  completedPickCount: number,
): BestPairScenario {
  const horizon = getTurnHorizon(schedule, userManagerId, completedPickCount)
  const lastCurrentTurnPick = horizon.upcomingUserTurnPickNumbers.at(-1) ?? null
  const followingUserSlot = lastCurrentTurnPick === null
    ? null
    : schedule.find(
        (slot) =>
          slot.overallPickNumber > lastCurrentTurnPick &&
          slot.managerId === userManagerId,
      ) ?? null
  return Object.freeze({
    currentUserTurnPickNumbers: horizon.upcomingUserTurnPickNumbers,
    followingUserPickNumber: followingUserSlot?.overallPickNumber ?? null,
    opponentSelections: horizon.opponentPicksBeforeFollowingUserTurn ?? 0,
  })
}

function compareRankedPlayer(left: RankedDraftPlayer, right: RankedDraftPlayer): number {
  return (
    left.consensusRank - right.consensusRank ||
    compareText(left.player.displayName, right.player.displayName) ||
    compareText(left.player.id, right.player.id)
  )
}

function officialEvidence(recommendation: BestPairRecommendation): readonly number[] {
  return recommendation.rankedPlayers
    .map(({ player }) => player.officialDraftRank)
    .filter((rank): rank is number => rank !== null)
    .sort((left, right) => left - right)
}

function compareRecommendations(
  left: BestPairRecommendation,
  right: BestPairRecommendation,
): number {
  const leftRanks = left.rankedPlayers.map(({ consensusRank }) => consensusRank)
  const rightRanks = right.rankedPlayers.map(({ consensusRank }) => consensusRank)
  const scoreDifference = right.bestPairScore - left.bestPairScore
  if (scoreDifference !== 0) return scoreDifference
  const rankSumDifference =
    leftRanks.reduce((sum, rank) => sum + rank, 0) -
    rightRanks.reduce((sum, rank) => sum + rank, 0)
  if (rankSumDifference !== 0) return rankSumDifference
  const bestRankDifference = Math.min(...leftRanks) - Math.min(...rightRanks)
  if (bestRankDifference !== 0) return bestRankDifference

  const leftOfficial = officialEvidence(left)
  const rightOfficial = officialEvidence(right)
  if (leftOfficial.length !== rightOfficial.length) {
    return rightOfficial.length - leftOfficial.length
  }
  const officialSumDifference =
    leftOfficial.reduce((sum, rank) => sum + rank, 0) -
    rightOfficial.reduce((sum, rank) => sum + rank, 0)
  if (officialSumDifference !== 0) return officialSumDifference

  const leftNames = left.rankedPlayers.map(({ player }) => player.displayName).sort()
  const rightNames = right.rankedPlayers.map(({ player }) => player.displayName).sort()
  const nameDifference =
    compareText(leftNames[0], rightNames[0]) ||
    compareText(leftNames[1], rightNames[1])
  if (nameDifference !== 0) return nameDifference
  const leftIds = left.rankedPlayers.map(({ player }) => player.id).sort()
  const rightIds = right.rankedPlayers.map(({ player }) => player.id).sort()
  return compareText(leftIds[0], rightIds[0]) || compareText(leftIds[1], rightIds[1])
}

function evaluatePair(
  pair: readonly [RankedDraftPlayer, RankedDraftPlayer],
  availableRankedPlayers: readonly RankedDraftPlayer[],
  counts: Readonly<Record<Position, number>>,
  scenario: BestPairScenario,
): BestPairRecommendation {
  const pairIds = new Set(pair.map(({ player }) => player.id))
  const afterPair = availableRankedPlayers.filter(({ player }) => !pairIds.has(player.id))
  const opponentDraftedIds = new Set(
    afterPair
      .slice(0, scenario.opponentSelections)
      .map(({ player }) => player.id),
  )
  const postScenario = afterPair.filter(
    ({ player }) => !opponentDraftedIds.has(player.id),
  )
  const positions = [...new Set(pair.map(({ player }) => player.position))]
  const positionFacts = positions.map((position) => {
    const selected = pair
      .filter(({ player }) => player.position === position)
      .sort(compareRankedPlayer)
    const replacements = postScenario.filter(({ player }) => player.position === position)
    const selectedScores = selected.map(({ consensusScore }) => consensusScore)
    const replacementScores = selected.map(
      (_, index) => replacements[index]?.consensusScore ?? 0,
    )
    const jointPositionDropoff = selectedScores.reduce(
      (total, score, index) =>
        total + Math.max(0, score - replacementScores[index]),
      0,
    )
    return Object.freeze({
      position,
      selectedConsensusScores: Object.freeze(selectedScores),
      replacementConsensusScores: Object.freeze(replacementScores),
      jointPositionDropoff,
      rosterCountBeforePair: counts[position],
      rosterCountAfterPair: counts[position] + selected.length,
      rosterCapacity: ROSTER_REQUIREMENTS[position],
      replacementOptionsRemaining: replacements.length,
    })
  })
  const pairQuality = pair[0].consensusScore + pair[1].consensusScore
  const pairScarcity = positionFacts.reduce(
    (total, facts) => total + facts.jointPositionDropoff,
    0,
  )
  const reasons = [
    `Combines MVP consensus ranks #${pair[0].consensusRank} and #${pair[1].consensusRank}.`,
    `${scenario.opponentSelections} opponent selections are removed before the following user turn${scenario.followingUserPickNumber === null ? '' : ` at Pick ${scenario.followingUserPickNumber}`}.`,
    pairScarcity > 0
      ? `Joint positional replacement drop-off is ${pairScarcity.toFixed(3)} after scenario depletion.`
      : 'No positive positional replacement drop-off remains after scenario depletion.',
    positions
      .map((position) => {
        const facts = positionFacts.find((item) => item.position === position) as BestPairPositionFacts
        return `${position} roster count becomes ${facts.rosterCountAfterPair}/${facts.rosterCapacity}`
      })
      .join('; ') + '.',
  ]
  return Object.freeze({
    rankedPlayers: Object.freeze([...pair].sort(compareRankedPlayer)) as readonly [
      RankedDraftPlayer,
      RankedDraftPlayer,
    ],
    pairQuality,
    pairScarcity,
    bestPairScore: pairQuality + POSITION_DROPOFF_WEIGHT * pairScarcity,
    scenario,
    positionFacts: Object.freeze(positionFacts),
    reasons: Object.freeze(reasons),
  })
}

export function calculateBestPair(
  availableRankedPlayers: readonly RankedDraftPlayer[],
  userRoster: readonly Player[],
  schedule: readonly DraftSlot[],
  userManagerId: ManagerId,
  completedPickCount: number,
  recommendationCount = BEST_PAIR_RECOMMENDATION_COUNT,
): BestPairResult {
  const scenario = getScenario(schedule, userManagerId, completedPickCount)
  const currentSlot = getCurrentDraftSlot(schedule, completedPickCount)
  const active =
    currentSlot?.managerId === userManagerId &&
    scenario.currentUserTurnPickNumbers.length >= 2
  if (!active) {
    return Object.freeze({
      active: false,
      scenario,
      shortlistSize: 0,
      recommendations: Object.freeze([]),
    })
  }

  const counts = rosterCounts(userRoster)
  const individuallyLegal = availableRankedPlayers.filter(
    ({ player }) => counts[player.position] < ROSTER_REQUIREMENTS[player.position],
  )
  const shortlistSize = Math.min(
    individuallyLegal.length,
    Math.max(
      BEST_PAIR_MINIMUM_SHORTLIST_SIZE,
      scenario.opponentSelections + BEST_PAIR_HORIZON_BUFFER,
    ),
  )
  const shortlist = individuallyLegal.slice(0, shortlistSize)
  const evaluated: BestPairRecommendation[] = []
  for (let leftIndex = 0; leftIndex < shortlist.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < shortlist.length; rightIndex += 1) {
      const left = shortlist[leftIndex]
      const right = shortlist[rightIndex]
      if (
        left.player.id === right.player.id ||
        !pairRemainsRosterLegal(counts, left, right)
      ) {
        continue
      }
      evaluated.push(
        evaluatePair([left, right], availableRankedPlayers, counts, scenario),
      )
    }
  }

  return Object.freeze({
    active: true,
    scenario,
    shortlistSize,
    recommendations: Object.freeze(
      evaluated.sort(compareRecommendations).slice(0, recommendationCount),
    ),
  })
}
