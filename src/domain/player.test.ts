import { describe, expect, it } from 'vitest'

import { getPositionLabel, type Player } from './player'

describe('normalized player model', () => {
  it('uses a domain position without depending on an external API shape', () => {
    const player: Player = {
      id: 'fixture-player',
      displayName: 'Test Player',
      position: 'MID',
      club: {
        id: 'fixture-club',
        name: 'Fixture Club',
        shortName: 'FIX',
      },
      officialDraftRank: null,
    }

    expect(getPositionLabel(player.position)).toBe('Midfielder')
  })
})
