import type { Player } from '../../domain/player.ts'

/** Project-owned response returned by GET /api/fpl. */
export interface FplPlayerDataResponse {
  retrievedAt: string
  playerCount: number
  players: Player[]
}
