import type { Player, Position } from './player.ts'
import {
  POSITION_ORDER,
  calculateCandidateTargets,
  calculateRosterDemand,
  type LeagueTotals,
} from './league.ts'

export interface RankedPlayer {
  player: Player
  positionRank: number
}

export interface DraftBoardEntry extends RankedPlayer {
  positionDemand: number
  positionCandidateTarget: number
  insideCoreDemand: boolean
}

export interface DraftBoard {
  managerCount: number
  rosterDemand: LeagueTotals
  candidateTargets: LeagueTotals
  entries: DraftBoardEntry[]
}

export class InsufficientCandidatePlayersError extends Error {
  public readonly position: Position
  public readonly requiredCandidateCount: number
  public readonly availablePlayerCount: number

  constructor(
    position: Position,
    requiredCandidateCount: number,
    availablePlayerCount: number,
  ) {
    super(
      `Insufficient ${position} candidates: required ${requiredCandidateCount}, available ${availablePlayerCount}`,
    )
    this.name = 'InsufficientCandidatePlayersError'
    this.position = position
    this.requiredCandidateCount = requiredCandidateCount
    this.availablePlayerCount = availablePlayerCount
  }
}

function compareText(left: string, right: string): number {
  if (left < right) return -1
  if (left > right) return 1
  return 0
}

/**
 * Deterministic order: official rank ascending, then display name, then player ID.
 * Null ranks are ordered after every valid official rank and are never replaced.
 */
export function comparePlayersByOfficialDraftRank(left: Player, right: Player): number {
  const leftRank = left.officialDraftRank
  const rightRank = right.officialDraftRank

  if (leftRank !== null && rightRank === null) return -1
  if (leftRank === null && rightRank !== null) return 1
  if (leftRank !== null && rightRank !== null && leftRank !== rightRank) {
    return leftRank - rightRank
  }

  return compareText(left.displayName, right.displayName) || compareText(left.id, right.id)
}

export function rankPlayers(players: readonly Player[]): RankedPlayer[] {
  const positionCounts: Record<Position, number> = { GK: 0, DEF: 0, MID: 0, FWD: 0 }

  return [...players].sort(comparePlayersByOfficialDraftRank).map((player) => {
    positionCounts[player.position] += 1
    return { player, positionRank: positionCounts[player.position] }
  })
}

export function buildDraftBoard(
  players: readonly Player[],
  managerCount: number,
): DraftBoard {
  const rosterDemand = calculateRosterDemand(managerCount)
  const candidateTargets = calculateCandidateTargets(managerCount)
  const rankedPlayers = rankPlayers(players)

  for (const position of POSITION_ORDER) {
    const availablePlayerCount = rankedPlayers.filter(
      ({ player }) => player.position === position,
    ).length
    const requiredCandidateCount = candidateTargets.positions[position]

    if (availablePlayerCount < requiredCandidateCount) {
      throw new InsufficientCandidatePlayersError(
        position,
        requiredCandidateCount,
        availablePlayerCount,
      )
    }
  }

  const entries = rankedPlayers
    .filter(
      ({ player, positionRank }) =>
        positionRank <= candidateTargets.positions[player.position],
    )
    .map(({ player, positionRank }): DraftBoardEntry => {
      const positionDemand = rosterDemand.positions[player.position]
      return {
        player,
        positionRank,
        positionDemand,
        positionCandidateTarget: candidateTargets.positions[player.position],
        insideCoreDemand: positionRank <= positionDemand,
      }
    })
    .sort((left, right) =>
      comparePlayersByOfficialDraftRank(left.player, right.player),
    )

  return { managerCount, rosterDemand, candidateTargets, entries }
}
