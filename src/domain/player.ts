/** Opaque internal identifier. External adapters decide how upstream IDs map to it. */
export type PlayerId = string

export type Position = 'GK' | 'DEF' | 'MID' | 'FWD'

/** Normalized player data that application code may safely depend on. */
export interface Player {
  id: PlayerId
  displayName: string
  position: Position
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
