import type { Position } from './player.ts'

export const POSITION_ORDER = ['GK', 'DEF', 'MID', 'FWD'] as const satisfies readonly Position[]

/** Official FPL Draft roster requirements for one manager. */
export const ROSTER_REQUIREMENTS: Readonly<Record<Position, number>> = {
  GK: 2,
  DEF: 5,
  MID: 5,
  FWD: 3,
}

export const FPL_DRAFT_SQUAD_SIZE = 15
export const MIN_LEAGUE_SIZE = 2
export const MAX_LEAGUE_SIZE = 16

/** Project heuristic: reserve candidates added independently to each position. */
export const DEFAULT_RESERVE_BUFFER = 0.35

export type PositionCounts = Readonly<Record<Position, number>>

export interface LeagueTotals {
  positions: PositionCounts
  total: number
}

export class InvalidLeagueSizeError extends Error {
  public readonly received: number
  public readonly minimum = MIN_LEAGUE_SIZE
  public readonly maximum = MAX_LEAGUE_SIZE

  constructor(received: number) {
    super(
      `League size must be an integer from ${MIN_LEAGUE_SIZE} to ${MAX_LEAGUE_SIZE}; received ${received}`,
    )
    this.name = 'InvalidLeagueSizeError'
    this.received = received
  }
}

export function validateLeagueSize(managerCount: number): void {
  if (
    !Number.isInteger(managerCount) ||
    managerCount < MIN_LEAGUE_SIZE ||
    managerCount > MAX_LEAGUE_SIZE
  ) {
    throw new InvalidLeagueSizeError(managerCount)
  }
}

function totalPositionCounts(positions: PositionCounts): number {
  return POSITION_ORDER.reduce((total, position) => total + positions[position], 0)
}

export function calculateRosterDemand(managerCount: number): LeagueTotals {
  validateLeagueSize(managerCount)

  const positions: PositionCounts = {
    GK: managerCount * ROSTER_REQUIREMENTS.GK,
    DEF: managerCount * ROSTER_REQUIREMENTS.DEF,
    MID: managerCount * ROSTER_REQUIREMENTS.MID,
    FWD: managerCount * ROSTER_REQUIREMENTS.FWD,
  }

  return { positions, total: totalPositionCounts(positions) }
}

export function calculateCandidateTargets(managerCount: number): LeagueTotals {
  const demand = calculateRosterDemand(managerCount)
  const multiplier = 1 + DEFAULT_RESERVE_BUFFER
  const positions: PositionCounts = {
    GK: Math.ceil(demand.positions.GK * multiplier),
    DEF: Math.ceil(demand.positions.DEF * multiplier),
    MID: Math.ceil(demand.positions.MID * multiplier),
    FWD: Math.ceil(demand.positions.FWD * multiplier),
  }

  return { positions, total: totalPositionCounts(positions) }
}
