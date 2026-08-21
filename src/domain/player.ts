/** Opaque internal identifier. External adapters decide how upstream IDs map to it. */
export type PlayerId = string
export type ClubId = string

export type Position = 'GK' | 'DEF' | 'MID' | 'FWD'

export interface Club {
  id: ClubId
  name: string
  shortName: string
}

/** Normalized player data that application code may safely depend on. */
export interface Player {
  id: PlayerId
  displayName: string
  /** Full verified upstream identity when the FPL adapter provides it. */
  fullName?: string
  position: Position
  club: Club
  /** Upstream Draft ordinal; null when the upstream value is absent. */
  officialDraftRank: number | null
}

const positionLabels: Readonly<Record<Position, string>> = {
  GK: 'Goalkeeper',
  DEF: 'Defender',
  MID: 'Midfielder',
  FWD: 'Forward',
}

export function getPositionLabel(position: Position): string {
  return positionLabels[position]
}
