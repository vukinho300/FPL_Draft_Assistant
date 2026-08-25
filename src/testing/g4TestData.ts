import { officialLeagueIdentity202627 } from '../data/leagues/kile-n-others/officialLeagueIdentity2026-27.ts'
import type { Player, Position } from '../domain/player.ts'
import type { RetrievedLiveLeagueState } from '../services/fpl/liveLeagueState.ts'

const rosterPositions: readonly Position[] = [
  'GK', 'GK', 'DEF', 'DEF', 'DEF', 'DEF', 'DEF',
  'MID', 'MID', 'MID', 'MID', 'MID', 'FWD', 'FWD', 'FWD',
]

export function createG4TestData(
  phase: RetrievedLiveLeagueState['snapshot']['gameweekState']['phase'] = 'OFFICIAL_EVENT_MARKED_FINISHED',
): { readonly players: readonly Player[]; readonly live: RetrievedLiveLeagueState } {
  const players: Player[] = []
  const ownership: RetrievedLiveLeagueState['ownership']['elements'][number][] = []
  const teamScores: RetrievedLiveLeagueState['snapshot']['teamScores'][number][] = []
  officialLeagueIdentity202627.participants.forEach((identity, teamIndex) => {
    const roster = rosterPositions.map((position, playerIndex) => {
      const id = String((teamIndex * 15) + playerIndex + 1)
      const player: Player = {
        id,
        displayName: `${identity.teamName} P${playerIndex + 1}`,
        fullName: `${identity.teamName} Player ${playerIndex + 1}`,
        position,
        club: { id: `club-${teamIndex}`, name: `Club ${teamIndex}`, shortName: `C${teamIndex}` },
        officialDraftRank: playerIndex + 1,
        form: playerIndex / 10,
        totalPoints: playerIndex,
      }
      players.push(player)
      ownership.push({
        elementId: id,
        availability: 'OWNED',
        upstreamStatusCode: 'o',
        officialOwnerEntryId: identity.officialEntryId,
        inAcceptedTrade: false,
      })
      return player
    })
    const starters = [roster[0], ...roster.slice(2, 6), ...roster.slice(7, 11), ...roster.slice(12, 14)]
    const bench = [roster[1], roster[6], roster[11], roster[14]]
    teamScores.push({
      teamName: identity.teamName,
      accountManagerName: identity.accountManagerName,
      rosterManagerId: identity.rosterManagerId,
      officialEntryId: identity.officialEntryId,
      officialLeagueEntryId: identity.officialLeagueEntryId,
      eventId: 1,
      liveGameweekScore: 40 + teamIndex,
      starters: starters.map((player, index) => ({
        elementId: player.id, position: index + 1, multiplier: 1, livePoints: index, scoreContribution: index,
      })),
      bench: bench.map((player, index) => ({
        elementId: player.id, position: index + 12, multiplier: 1, livePoints: index + 1, scoreContribution: index + 1,
      })),
      provenance: 'OFFICIAL_LINEUP_PLUS_OFFICIAL_LIVE_PLAYER_POINTS',
    })
  })
  return {
    players,
    live: {
      snapshot: {
        leagueId: 45938,
        eventId: 1,
        gameweekState: {
          eventId: 1,
          phase,
          deadlineTime: '2026-08-21T17:30:00Z',
          hasLiveFixture: phase === 'ACTIVE',
          allFixturesStarted: phase !== 'UPCOMING',
          allFixturesFootballComplete: phase === 'FOOTBALL_COMPLETE' || phase === 'OFFICIAL_EVENT_MARKED_FINISHED',
          officialEventFinished: phase === 'OFFICIAL_EVENT_MARKED_FINISHED',
          bootstrapEventFinished: phase === 'OFFICIAL_EVENT_MARKED_FINISHED',
        },
        teamScores,
        seasonBaseline: { status: 'AVAILABLE', eventId: 1, provenance: 'SEASON_START_ZERO', entries: [] },
        standings: { status: 'AVAILABLE', rows: [] },
        calculationStatus: 'PROVISIONAL',
        reconciliationStatus: 'NOT_PROVEN',
        freshness: { retrievedAt: '2026-08-25T10:00:00Z', staleAfterMs: 90_000 },
      },
      nextEvent: phase === 'OFFICIAL_EVENT_MARKED_FINISHED'
        ? {
            eventId: 2,
            name: 'Gameweek 2',
            deadlineTime: '2099-08-28T17:30:00Z',
            tradesTime: '2099-08-26T17:30:00Z',
            waiversTime: '2099-08-27T17:30:00Z',
            finished: false,
          }
        : null,
      ownership: { leagueId: 45938, elements: ownership },
      eventStatus: { days: [], leagueTableStatus: null },
    },
  }
}
