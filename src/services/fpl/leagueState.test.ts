import { describe, expect, it } from 'vitest'

import { officialLeagueIdentity202627 } from '../../data/leagues/kile-n-others/officialLeagueIdentity2026-27.ts'
import type { Player, Position } from '../../domain/player.ts'
import { normalizeFplDraftEntryEventLineup } from './entryEvent.ts'
import { normalizeFplDraftLeagueElementStatuses } from './leagueElementStatus.ts'
import { verifyFplDraftLeagueState } from './leagueState.ts'
import { normalizeFplDraftLiveEvent } from './liveEvent.ts'

const positionForSlot = (slot: number): Position => {
  if (slot === 1 || slot === 12) return 'GK'
  if ([2, 3, 4, 5, 14, 15].includes(slot)) return 'DEF'
  if ([6, 7, 8, 9].includes(slot)) return 'MID'
  return 'FWD'
}

function liveStats() {
  return {
    minutes: 0,
    starts: 0,
    goals_scored: 0,
    assists: 0,
    clean_sheets: 0,
    goals_conceded: 0,
    own_goals: 0,
    penalties_saved: 0,
    penalties_missed: 0,
    yellow_cards: 0,
    red_cards: 0,
    saves: 0,
    bonus: 0,
    bps: 0,
    defensive_contribution: 0,
    total_points: 0,
    in_dreamteam: false,
  }
}

function fixture() {
  return {
    id: 1,
    event: 1,
    kickoff_time: '2026-08-21T19:00:00Z',
    started: true,
    finished: false,
    finished_provisional: false,
    provisional_start_time: false,
    minutes: 1,
    team_h: 1,
    team_a: 2,
    team_h_score: 0,
    team_a_score: 0,
    stats: [],
  }
}

function contractFixture() {
  const players: Player[] = []
  const lineups = officialLeagueIdentity202627.participants.map((identity, participantIndex) => {
    const picks = Array.from({ length: 15 }, (_, index) => {
      const id = String(participantIndex * 15 + index + 1)
      players.push({
        id,
        displayName: `Player ${id}`,
        position: positionForSlot(index + 1),
        club: { id: '1', name: 'Fixture FC', shortName: 'FIX' },
        officialDraftRank: Number(id),
      })
      return {
        element: Number(id),
        position: index + 1,
        is_captain: false,
        is_vice_captain: false,
        multiplier: 1,
      }
    })
    return normalizeFplDraftEntryEventLineup(
      { picks, entry_history: {}, subs: [] },
      identity.officialEntryId,
      1,
    )
  })
  const liveEvent = normalizeFplDraftLiveEvent({
    elements: Object.fromEntries(players.map(({ id }) => [id, { explain: [], stats: liveStats() }])),
    fixtures: [fixture()],
  }, 1)
  const elementStatuses = normalizeFplDraftLeagueElementStatuses({
    element_status: players.map((player, index) => ({
      element: Number(player.id),
      owner: officialLeagueIdentity202627.participants[Math.floor(index / 15)].officialEntryId,
      status: 'o',
      in_accepted_trade: false,
    })),
  }, 45938)
  return { players, lineups, liveEvent, elementStatuses }
}

describe('verified Kile N Others official league state', () => {
  it('joins all six lineups and all current owners through exact G1 entry IDs', () => {
    const fixtureState = contractFixture()
    const verified = verifyFplDraftLeagueState(
      officialLeagueIdentity202627,
      fixtureState.players,
      fixtureState.lineups,
      fixtureState.liveEvent,
      fixtureState.elementStatuses,
    )

    expect(verified).toMatchObject({
      leagueId: 45938,
      eventId: 1,
      playerCount: 90,
      ownedPlayerCount: 90,
      availablePlayerCount: 0,
      lockedPlayerCount: 0,
    })
    expect(verified.participants.map((participant) => ({
      teamName: participant.teamName,
      rosterManagerId: participant.rosterManagerId,
      ownedPlayerCount: participant.ownedPlayerCount,
    }))).toEqual([
      { teamName: 'Jakin Goff', rosterManagerId: 'demo-manager-1', ownedPlayerCount: 15 },
      { teamName: 'Dindi', rosterManagerId: 'demo-manager-3', ownedPlayerCount: 15 },
      { teamName: '22nd oBlock', rosterManagerId: 'demo-manager-2', ownedPlayerCount: 15 },
      { teamName: 'Miku007', rosterManagerId: 'demo-manager-4', ownedPlayerCount: 15 },
      { teamName: 'Rod Wave Disciples', rosterManagerId: 'demo-manager-6', ownedPlayerCount: 15 },
      { teamName: 'Tintilinic', rosterManagerId: 'demo-manager-5', ownedPlayerCount: 15 },
    ])
  })

  it('normalizes explicit available, owned, and locked states without blank ownership', () => {
    const statuses = normalizeFplDraftLeagueElementStatuses({
      element_status: [
        { element: 1, owner: null, status: 'a', in_accepted_trade: false },
        { element: 2, owner: 240560, status: 'o', in_accepted_trade: false },
        { element: 3, owner: null, status: 'locked-code-observation', in_accepted_trade: true },
      ],
    }, 45938)
    expect(statuses.elements.map(({ availability }) => availability)).toEqual([
      'AVAILABLE',
      'OWNED',
      'LOCKED',
    ])
  })

  it('fails closed for unknown owners, incomplete ownership, and invalid bench identity', () => {
    const unknownOwner = contractFixture()
    const rawStatuses = unknownOwner.elementStatuses.elements.map((status) => ({
      element: Number(status.elementId),
      owner: status.elementId === '1' ? 999999 : status.officialOwnerEntryId,
      status: 'o',
      in_accepted_trade: false,
    }))
    unknownOwner.elementStatuses = normalizeFplDraftLeagueElementStatuses(
      { element_status: rawStatuses },
      45938,
    )
    expect(() => verifyFplDraftLeagueState(
      officialLeagueIdentity202627,
      unknownOwner.players,
      unknownOwner.lineups,
      unknownOwner.liveEvent,
      unknownOwner.elementStatuses,
    )).toThrow(/unknown owner 999999/)

    const wrongBench = contractFixture()
    wrongBench.players[11] = { ...wrongBench.players[11], position: 'MID' }
    expect(() => verifyFplDraftLeagueState(
      officialLeagueIdentity202627,
      wrongBench.players,
      wrongBench.lineups,
      wrongBench.liveEvent,
      wrongBench.elementStatuses,
    )).toThrow(/ordered GK\/1\/2\/3 bench semantics/)
  })
})
