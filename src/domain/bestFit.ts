import { POSITION_ORDER, ROSTER_REQUIREMENTS } from './league.ts'
import type { ManagerId } from './manager.ts'
import type { Player, Position } from './player.ts'
import type { RankedDraftPlayer } from './draftRanking.ts'
import type { DraftSlot } from './draftSchedule.ts'
import { getTurnHorizon } from './draftSchedule.ts'

/** Project MVP heuristic; not a validated probability or official FPL score. */
export const POSITION_DROPOFF_WEIGHT = 0.35
export const STRONG_ALTERNATIVE_SCORE_GAP = 0.1

export interface BestFitScenario {
  readonly opponentSelections: number
  readonly followingUserPickNumber: number | null
  readonly upcomingUserTurnPickNumbers: readonly number[]
}

export interface BestFitFacts {
  readonly position: Position
  readonly currentConsensusScore: number
  readonly bestPostScenarioPositionScore: number
  readonly positionDropoff: number
  readonly strongAlternativesRemaining: number
  readonly positionDepthNow: number
  readonly positionDepthAfterScenario: number
  readonly rosterCountBeforePick: number
  readonly rosterCapacity: number
}

export interface PositionDepthScenario {
  readonly position: Position
  readonly bestConsensusScoreNow: number
  readonly depthNow: number
  readonly bestConsensusScoreAfterScenario: number
  readonly depthAfterScenario: number
  readonly strongAlternativesRemaining: number
}

export interface BestFitRecommendation {
  readonly rankedPlayer: RankedDraftPlayer
  readonly bestFitScore: number
  readonly scenario: BestFitScenario
  readonly facts: BestFitFacts
  readonly reasons: readonly string[]
}

export interface BestFitResult {
  readonly bestAvailable: RankedDraftPlayer | null
  readonly recommendations: readonly BestFitRecommendation[]
  readonly scenario: BestFitScenario
  readonly positionScenarios: readonly PositionDepthScenario[]
}

function rosterCounts(players: readonly Player[]): Record<Position, number> {
  const counts: Record<Position, number> = { GK: 0, DEF: 0, MID: 0, FWD: 0 }
  players.forEach((player) => {
    counts[player.position] += 1
  })
  return counts
}

export function getBestFitScenario(
  schedule: readonly DraftSlot[],
  userManagerId: ManagerId,
  completedPickCount: number,
): BestFitScenario {
  const horizon = getTurnHorizon(schedule, userManagerId, completedPickCount)
  const lastUpcomingPick = horizon.upcomingUserTurnPickNumbers.at(-1) ?? null
  const followingUserPick =
    lastUpcomingPick === null
      ? null
      : schedule.find(
          (slot) =>
            slot.overallPickNumber > lastUpcomingPick && slot.managerId === userManagerId,
        ) ?? null
  return Object.freeze({
    opponentSelections: horizon.opponentPicksBeforeFollowingUserTurn ?? 0,
    followingUserPickNumber: followingUserPick?.overallPickNumber ?? null,
    upcomingUserTurnPickNumbers: horizon.upcomingUserTurnPickNumbers,
  })
}

export function calculateBestFit(
  availableRankedPlayers: readonly RankedDraftPlayer[],
  userRoster: readonly Player[],
  schedule: readonly DraftSlot[],
  userManagerId: ManagerId,
  completedPickCount: number,
  recommendationCount = 5,
): BestFitResult {
  const counts = rosterCounts(userRoster)
  const scenario = getBestFitScenario(schedule, userManagerId, completedPickCount)
  const scenarioDepletedIds = new Set(
    availableRankedPlayers
      .slice(0, scenario.opponentSelections)
      .map(({ player }) => player.id),
  )
  const positionScenarios = POSITION_ORDER.map((position) => {
    const now = availableRankedPlayers.filter(({ player }) => player.position === position)
    const after = now.filter(({ player }) => !scenarioDepletedIds.has(player.id))
    const bestNow = now[0]?.consensusScore ?? 0
    return Object.freeze({
      position,
      bestConsensusScoreNow: bestNow,
      depthNow: now.length,
      bestConsensusScoreAfterScenario: after[0]?.consensusScore ?? 0,
      depthAfterScenario: after.length,
      strongAlternativesRemaining: after.filter(
        ({ consensusScore }) =>
          consensusScore >= bestNow - STRONG_ALTERNATIVE_SCORE_GAP,
      ).length,
    })
  })
  const legal = availableRankedPlayers.filter(
    ({ player }) => counts[player.position] < ROSTER_REQUIREMENTS[player.position],
  )
  const bestAvailable = legal[0] ?? null
  const shortlistSize = Math.min(
    legal.length,
    Math.max(recommendationCount, scenario.opponentSelections + recommendationCount),
  )

  const evaluated = legal.slice(0, shortlistSize).map((candidate) => {
    const afterCandidate = availableRankedPlayers.filter(
      ({ player }) => player.id !== candidate.player.id,
    )
    const depletedIds = new Set(
      afterCandidate
        .slice(0, scenario.opponentSelections)
        .map(({ player }) => player.id),
    )
    const remainingAtPosition = afterCandidate.filter(
      ({ player }) =>
        player.position === candidate.player.position && !depletedIds.has(player.id),
    )
    const bestPostScenarioPositionScore = remainingAtPosition[0]?.consensusScore ?? 0
    const positionDropoff = Math.max(
      0,
      candidate.consensusScore - bestPostScenarioPositionScore,
    )
    const strongAlternativesRemaining = remainingAtPosition.filter(
      (player) =>
        player.consensusScore >=
        candidate.consensusScore - STRONG_ALTERNATIVE_SCORE_GAP,
    ).length
    const bestFitScore =
      candidate.consensusScore + POSITION_DROPOFF_WEIGHT * positionDropoff
    const reasons = [
      candidate === legal.find(
        ({ player }) => player.position === candidate.player.position,
      )
        ? `Strongest remaining ${candidate.player.position} option by MVP consensus.`
        : `Strong current ${candidate.player.position} option by MVP consensus.`,
      `${scenario.opponentSelections} opponent selections occur before the following user turn.`,
      positionDropoff >= STRONG_ALTERNATIVE_SCORE_GAP
        ? `${candidate.player.position} depth drops materially in the top-of-board depletion scenario.`
        : `${strongAlternativesRemaining} strong ${candidate.player.position} alternative${strongAlternativesRemaining === 1 ? '' : 's'} remain in the top-of-board depletion scenario.`,
      `Roster remains legal at ${counts[candidate.player.position] + 1}/${ROSTER_REQUIREMENTS[candidate.player.position]} ${candidate.player.position}.`,
    ]
    return Object.freeze({
      rankedPlayer: candidate,
      bestFitScore,
      scenario,
      facts: Object.freeze({
        position: candidate.player.position,
        currentConsensusScore: candidate.consensusScore,
        bestPostScenarioPositionScore,
        positionDropoff,
        strongAlternativesRemaining,
        positionDepthNow: availableRankedPlayers.filter(
          ({ player }) => player.position === candidate.player.position,
        ).length,
        positionDepthAfterScenario: remainingAtPosition.length,
        rosterCountBeforePick: counts[candidate.player.position],
        rosterCapacity: ROSTER_REQUIREMENTS[candidate.player.position],
      }),
      reasons: Object.freeze(reasons),
    })
  })

  const recommendations = evaluated
    .sort(
      (left, right) =>
        right.bestFitScore - left.bestFitScore ||
        left.rankedPlayer.consensusRank - right.rankedPlayer.consensusRank ||
        (left.rankedPlayer.player.displayName < right.rankedPlayer.player.displayName
          ? -1
          : left.rankedPlayer.player.displayName > right.rankedPlayer.player.displayName
            ? 1
            : left.rankedPlayer.player.id < right.rankedPlayer.player.id
              ? -1
              : left.rankedPlayer.player.id > right.rankedPlayer.player.id
                ? 1
                : 0),
    )
    .slice(0, recommendationCount)

  return Object.freeze({
    bestAvailable,
    recommendations: Object.freeze(recommendations),
    scenario,
    positionScenarios: Object.freeze(positionScenarios),
  })
}
