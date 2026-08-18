import { describe, expect, it } from 'vitest'

import { officialDraft202627 } from '../data/leagues/kile-n-others/officialDraft2026-27.ts'
import type { Player } from './player.ts'
import {
  buildPlayerOwnershipDirectory,
  deriveCurrentLeagueRosters,
  LeagueTransactionError,
  validateTradePositionComposition,
  validateUniqueRosterOwnership,
  validateWaiverPosition,
  type FreeAgentTransaction,
  type TradeRecord,
  type WaiverTransaction,
} from './transactions.ts'

function trade(status: TradeRecord['status']): TradeRecord {
  const vukMid = officialDraft202627.finalRosters[0].players.find(({ position }) => position === 'MID')!
  const diegoMid = officialDraft202627.finalRosters[1].players.find(({ position }) => position === 'MID')!
  return {
    kind: 'TRADE',
    id: `trade-${status}`,
    gameweek: 3,
    createdAt: '2026-09-01T12:00:00Z',
    fromManagerId: 'demo-manager-1',
    toManagerId: 'demo-manager-2',
    playersFrom: [{ playerId: vukMid.draftPlayerId, position: 'MID' }],
    playersTo: [{ playerId: diegoMid.draftPlayerId, position: 'MID' }],
    status,
    notes: '',
  }
}

describe('league roster evolution', () => {
  it('does not apply a proposed trade or mutate the historical draft', () => {
    const historicalVukIds = officialDraft202627.finalRosters[0].players.map(({ draftPlayerId }) => draftPlayerId)
    const rosters = deriveCurrentLeagueRosters(officialDraft202627, [trade('PROPOSED')])
    expect(rosters[0].players.map(({ playerId }) => playerId)).toEqual(historicalVukIds)
    expect(officialDraft202627.finalRosters[0].players.map(({ draftPlayerId }) => draftPlayerId)).toEqual(historicalVukIds)
  })

  it('applies only a processed position-matched trade', () => {
    const processed = trade('PROCESSED')
    const rosters = deriveCurrentLeagueRosters(officialDraft202627, [processed])
    expect(rosters[0].players.map(({ playerId }) => playerId)).toContain(processed.playersTo[0].playerId)
    expect(rosters[0].players.map(({ playerId }) => playerId)).not.toContain(processed.playersFrom[0].playerId)
    expect(rosters[1].players.map(({ playerId }) => playerId)).toContain(processed.playersFrom[0].playerId)
    rosters.forEach((roster) => expect(roster.positionCounts).toEqual({ GK: 2, DEF: 5, MID: 5, FWD: 3 }))
  })

  it('rejects trade position mismatches including multi-player trades', () => {
    const invalid: TradeRecord = {
      ...trade('PROPOSED'),
      playersFrom: [
        { playerId: 'mid-1', position: 'MID' },
        { playerId: 'mid-2', position: 'MID' },
      ],
      playersTo: [
        { playerId: 'mid-3', position: 'MID' },
        { playerId: 'fwd-1', position: 'FWD' },
      ],
    }
    expect(() => validateTradePositionComposition(invalid)).toThrow(/positions must match/i)
  })

  it('requires a same-position waiver exchange', () => {
    const invalid: WaiverTransaction = {
      kind: 'WAIVER',
      id: 'waiver-invalid',
      gameweek: 2,
      createdAt: '2026-08-28T12:00:00Z',
      managerId: 'demo-manager-1',
      waivedPlayer: { playerId: 'old', position: 'MID' },
      claimedPlayer: {
        playerId: 'new', displayName: 'New player', position: 'FWD',
        club: { id: 'club', name: 'Club', shortName: 'CLU' },
      },
      status: 'PROPOSED',
      notes: '',
    }
    expect(() => validateWaiverPosition(invalid)).toThrow(/same position/i)
  })

  it('updates free-agent ownership after a processed transaction', () => {
    const released = officialDraft202627.finalRosters[0].players.find(({ position }) => position === 'GK')!
    const added: Player = {
      id: 'free-agent-gk',
      displayName: 'Free Agent Keeper',
      position: 'GK',
      club: { id: 'club', name: 'Club', shortName: 'CLU' },
      officialDraftRank: null,
    }
    const transaction: FreeAgentTransaction = {
      kind: 'FREE_AGENT',
      id: 'free-agent-processed',
      gameweek: 2,
      createdAt: '2026-08-28T14:00:00Z',
      managerId: 'demo-manager-1',
      releasedPlayer: { playerId: released.draftPlayerId, position: 'GK' },
      addedPlayer: {
        playerId: added.id,
        displayName: added.displayName,
        position: added.position,
        club: added.club,
      },
      status: 'PROCESSED',
      notes: '',
    }
    const rosters = deriveCurrentLeagueRosters(officialDraft202627, [transaction])
    const releasedLive: Player = {
      id: released.draftPlayerId,
      displayName: released.playerName,
      position: released.position,
      club: released.club,
      officialDraftRank: released.officialDraftRankAtDraft,
    }
    const directory = buildPlayerOwnershipDirectory(
      [added, releasedLive],
      rosters,
      officialDraft202627,
    )
    expect(directory.find(({ player }) => player.id === added.id)?.ownerName).toBe('Vuk')
    expect(directory.find(({ player }) => player.id === released.draftPlayerId)?.ownerName).toBe('FREE AGENT')
  })

  it('rejects a player belonging to two managers', () => {
    const base = deriveCurrentLeagueRosters(officialDraft202627, [])
    const duplicate = base[0].players[0]
    expect(() => validateUniqueRosterOwnership([
      base[0],
      { managerId: base[1].managerId, players: [...base[1].players, duplicate] },
    ])).toThrowError(LeagueTransactionError)
  })
})
