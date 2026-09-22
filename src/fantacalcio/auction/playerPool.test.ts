import { describe, expect, it } from 'vitest'

import { CANONICAL_RELEASE, loadCanonicalPool, parseCanonicalPool, searchCanonicalPool, type CanonicalPlayer } from './playerPool.ts'

const synthetic = Array.from({ length: CANONICAL_RELEASE.count }, (_, index) => ({
  playerRef: `fantacalcio:fc:${index + 1}`,
  displayName: index === 0 ? 'Élite Player' : `Player ${index + 1}`,
  club: index === 0 ? 'Roma' : 'Test Club',
  role: (['POR', 'DIF', 'CEN', 'ATT'] as const)[index % 4],
  eligibility: 'SELECTABLE' as const,
}))

function csv(players: readonly CanonicalPlayer[]) {
  return `playerRef,displayName,club,role,eligibility\n${players.map((player) => `${player.playerRef},${player.displayName},${player.club},${player.role},${player.eligibility}`).join('\n')}\n`
}

describe('FD2 canonical player pool', () => {
  it('parses exactly 534 selectable contract rows and rejects a duplicate identity', () => {
    expect(parseCanonicalPool(csv(synthetic))).toHaveLength(534)
    const repeated = [...synthetic]
    repeated[1] = synthetic[0]
    expect(() => parseCanonicalPool(csv(repeated))).toThrow('invalid or duplicate')
  })

  it('filters roles, matches normalized names and clubs, and ranks unsold above sold', () => {
    const sold = new Set([synthetic[0].playerRef])
    expect(searchCanonicalPool(synthetic, 'elite', 'ALL', sold)[0]?.playerRef).toBe(synthetic[0].playerRef)
    expect(searchCanonicalPool(synthetic, '', 'POR', sold).every((player) => player.role === 'POR')).toBe(true)
    expect(searchCanonicalPool(synthetic, '', 'ALL', sold).some((player) => player.playerRef === synthetic[0].playerRef)).toBe(false)
    expect(searchCanonicalPool(synthetic, 'roma', 'ALL', sold)[0]?.club).toBe('Roma')
  })

  it('rejects a different file before its rows reach the recorder', async () => {
    await expect(loadCanonicalPool(new Blob([csv(synthetic)]))).rejects.toThrow('not the accepted frozen')
  })

})
