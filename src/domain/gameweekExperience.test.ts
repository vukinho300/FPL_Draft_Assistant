import { describe, expect, it } from 'vitest'

import { officialLeagueIdentity202627 } from '../data/leagues/kile-n-others/officialLeagueIdentity2026-27.ts'
import type { Player, Position } from './player.ts'
import type { RetrievedLiveLeagueState, LiveLeagueRefreshState } from '../services/fpl/liveLeagueState.ts'
import {
  buildLeagueGameweekExperience,
  createDefaultPlannerLineup,
  getGameweekTeam,
  resolveGameweekExperienceMode,
  swapPlannerPlayers,
} from './gameweekExperience.ts'

const rosterPositions: readonly Position[] = [
  'GK', 'GK',
  'DEF', 'DEF', 'DEF', 'DEF', 'DEF',
  'MID', 'MID', 'MID', 'MID', 'MID',
  'FWD', 'FWD', 'FWD',
]

function fixture(phase: RetrievedLiveLeagueState['snapshot']['gameweekState']['phase'] = 'ACTIVE') {
  const players: Player[] = []
  const ownership: RetrievedLiveLeagueState['ownership']['elements'][number][] = []
  const teamScores: RetrievedLiveLeagueState['snapshot']['teamScores'][number][] = []
  officialLeagueIdentity202627.participants.forEach((identity, teamIndex) => {
    const roster = rosterPositions.map((position, playerIndex) => {
      const id = String((teamIndex * 15) + playerIndex + 1)
      const player: Player = {
        id,
        displayName: `P${id}`,
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
      liveGameweekScore: teamIndex === 0 ? 999 : 40 + teamIndex,
      starters: starters.map((player, index) => ({
        elementId: player.id,
        position: index + 1,
        multiplier: 1,
        livePoints: index,
        scoreContribution: index,
      })),
      bench: bench.map((player, index) => ({
        elementId: player.id,
        position: index + 12,
        multiplier: 1,
        livePoints: 10 + index,
        scoreContribution: 10 + index,
      })),
      provenance: 'OFFICIAL_LINEUP_PLUS_OFFICIAL_LIVE_PLAYER_POINTS',
    })
  })
  const data: RetrievedLiveLeagueState = {
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
    nextEvent: phase === 'FOOTBALL_COMPLETE' || phase === 'OFFICIAL_EVENT_MARKED_FINISHED'
      ? {
          eventId: 2,
          name: 'Gameweek 2',
          deadlineTime: '2026-08-28T17:30:00Z',
          tradesTime: '2026-08-26T17:30:00Z',
          waiversTime: '2026-08-27T17:30:00Z',
          finished: false,
        }
      : null,
    ownership: { leagueId: 45938, elements: ownership },
    eventStatus: { days: [], leagueTableStatus: null },
  }
  const refresh: LiveLeagueRefreshState = {
    status: 'READY',
    data,
    lastSuccessfulAt: '2026-08-25T10:00:01Z',
    errorMessage: null,
    freshness: { retrievedAt: '2026-08-25T10:00:00Z', staleAfterMs: 90_000, ageMs: 30_000, status: 'FRESH' },
  }
  return { players, data, refresh }
}

describe('G4 enriched Gameweek experience', () => {
  it('maps all six verified accounts to isolated current official rosters', () => {
    const { players, refresh } = fixture()
    const experience = buildLeagueGameweekExperience(players, refresh, new Date('2026-08-25T10:00:30Z'))

    expect(experience.teams).toHaveLength(6)
    officialLeagueIdentity202627.participants.forEach((identity, index) => {
      const team = getGameweekTeam(experience, identity.rosterManagerId)
      expect(team.teamName).toBe(identity.teamName)
      expect(team.officialEntryId).toBe(identity.officialEntryId)
      expect(team.currentRoster).toHaveLength(15)
      expect(team.currentRoster.every((player) => player.officialOwnerEntryId === identity.officialEntryId)).toBe(true)
      expect(team.currentRoster[0].id).toBe(String((index * 15) + 1))
    })
    expect(getGameweekTeam(experience, 'demo-manager-4').currentRoster[0].ownerTeamName).toBe('Miku007')
    expect(getGameweekTeam(experience, 'demo-manager-4').currentRoster[0].ownerTeamName).not.toBe('Jakin Goff')
  })

  it('joins the global catalogue by exact player ID and fails closed when one player is missing', () => {
    const { players, refresh } = fixture()
    const experience = buildLeagueGameweekExperience(players, refresh)
    expect(experience.teams[0].currentRoster[0]).toMatchObject({
      name: 'Jakin Goff Player 1',
      clubShortName: 'C0',
      form: 0,
      totalPoints: 0,
      officialDraftRank: 1,
    })
    expect(() => buildLeagueGameweekExperience(players.slice(1), refresh)).toThrow(/exactly match/)
  })

  it('follows current official ownership changes instead of immutable draft-night rosters', () => {
    const { players, refresh } = fixture('OFFICIAL_EVENT_MARKED_FINISHED')
    const elements = refresh.data!.ownership.elements.map((status) => {
      if (status.elementId === '1') return { ...status, officialOwnerEntryId: 240676 }
      if (status.elementId === '16') return { ...status, officialOwnerEntryId: 240560 }
      return status
    })
    const changed: LiveLeagueRefreshState = {
      ...refresh,
      data: { ...refresh.data!, ownership: { leagueId: 45938, elements } },
    }
    const experience = buildLeagueGameweekExperience(players, changed, new Date('2026-08-25T12:00:00Z'))
    expect(getGameweekTeam(experience, 'demo-manager-1').currentRoster.map(({ id }) => id)).toContain('16')
    expect(getGameweekTeam(experience, 'demo-manager-1').currentRoster.map(({ id }) => id)).not.toContain('1')
    expect(getGameweekTeam(experience, 'demo-manager-3').currentRoster.map(({ id }) => id)).toContain('1')
  })

  it('uses the deadline and next-event identity rather than first kickoff to resolve modes', () => {
    const upcoming = fixture('UPCOMING').data
    expect(resolveGameweekExperienceMode(upcoming, new Date('2026-08-20T12:00:00Z'))).toMatchObject({
      mode: 'PLANNER', eventId: 1, reason: 'UPCOMING_BEFORE_DEADLINE',
    })
    const active = fixture('ACTIVE').data
    expect(resolveGameweekExperienceMode(active, new Date('2026-08-21T18:00:00Z'))).toMatchObject({
      mode: 'OFFICIAL', eventId: 1,
    })
    const footballComplete = fixture('FOOTBALL_COMPLETE').data
    expect(resolveGameweekExperienceMode(footballComplete, new Date('2026-08-25T12:00:00Z'))).toMatchObject({
      mode: 'OFFICIAL', eventId: 1, reason: 'CURRENT_EVENT_OFFICIAL_LINEUP',
    })
    const betweenRounds = fixture('OFFICIAL_EVENT_MARKED_FINISHED').data
    expect(resolveGameweekExperienceMode(betweenRounds, new Date('2026-08-25T12:00:00Z'))).toMatchObject({
      mode: 'PLANNER', eventId: 2, reason: 'NEXT_EVENT_BEFORE_DEADLINE',
    })
    expect(resolveGameweekExperienceMode(betweenRounds, new Date('2026-08-28T18:00:00Z'))).toMatchObject({
      mode: 'UNAVAILABLE', eventId: 2, reason: 'NEXT_EVENT_LINEUP_NOT_YET_AVAILABLE',
    })
  })

  it('preserves official XI, ordered bench, formation, player points, and the G3 team score', () => {
    const { players, refresh } = fixture()
    const team = buildLeagueGameweekExperience(players, refresh).teams[0]
    expect(team.officialLineup.starters).toHaveLength(11)
    expect(team.officialLineup.starters.map(({ lineupPosition }) => lineupPosition)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])
    expect(team.officialLineup.bench.map(({ lineupPosition }) => lineupPosition)).toEqual([12, 13, 14, 15])
    expect(team.officialLineup.bench.map(({ benchOrder }) => benchOrder)).toEqual([1, 2, 3, 4])
    expect(team.officialLineup.formation).toBe('4-4-2')
    expect(team.officialLineup.starters[1].liveGameweekPoints).toBe(1)
    expect(team.officialLineup.liveGameweekScore).toBe(999)
  })

  it('creates a private valid planner and refuses invalid goalkeeper/outfield swaps', () => {
    const { players, refresh } = fixture('OFFICIAL_EVENT_MARKED_FINISHED')
    const experience = buildLeagueGameweekExperience(players, refresh, new Date('2026-08-25T12:00:00Z'))
    const roster = experience.teams[0].currentRoster
    const planner = createDefaultPlannerLineup(2, roster)
    expect(planner.formation).toBe('4-4-2')
    expect(planner.starters).toHaveLength(11)
    expect(planner.bench[0].position).toBe('GK')

    const starterDefender = planner.starters.find(({ position }) => position === 'DEF')!
    const benchDefender = planner.bench.find(({ position }) => position === 'DEF')!
    expect(swapPlannerPlayers(planner, starterDefender.id, benchDefender.id).formation).toBe('4-4-2')
    expect(() => swapPlannerPlayers(planner, planner.starters[0].id, benchDefender.id)).toThrow(/valid FPL formation/)
  })

  it('keeps the next-Gameweek planner usable when season standings are not available', () => {
    const { players, refresh } = fixture('OFFICIAL_EVENT_MARKED_FINISHED')
    const withoutSeasonStandings: LiveLeagueRefreshState = {
      ...refresh,
      data: {
        ...refresh.data!,
        snapshot: {
          ...refresh.data!.snapshot,
          seasonBaseline: {
            status: 'UNAVAILABLE',
            eventId: 1,
            reason: 'PREVIOUS_FINALIZED_SEASON_BASELINE_NOT_YET_VERIFIED',
            candidatePreviousEventHistoryComplete: false,
          },
          standings: {
            status: 'UNAVAILABLE',
            reason: 'PREVIOUS_FINALIZED_SEASON_BASELINE_NOT_YET_VERIFIED',
          },
        },
      },
    }

    const experience = buildLeagueGameweekExperience(
      players,
      withoutSeasonStandings,
      new Date('2026-08-25T12:00:00Z'),
    )
    expect(experience).toMatchObject({ mode: 'PLANNER', eventId: 2 })
    expect(createDefaultPlannerLineup(2, experience.teams[0].currentRoster).starters).toHaveLength(11)
  })

  it('retains truthful stale/error freshness without changing official data provenance', () => {
    const { players, refresh } = fixture()
    const failedRefresh: LiveLeagueRefreshState = {
      ...refresh,
      status: 'ERROR',
      errorMessage: 'upstream unavailable',
      freshness: { ...refresh.freshness!, ageMs: 180_000, status: 'STALE' },
    }
    const experience = buildLeagueGameweekExperience(players, failedRefresh)
    expect(experience.refreshStatus).toBe('ERROR')
    expect(experience.freshness?.status).toBe('STALE')
    expect(experience.retrievedAt).toBe('2026-08-25T10:00:00Z')
    expect(experience.calculationStatus).toBe('PROVISIONAL')
    expect(experience.reconciliationStatus).toBe('NOT_PROVEN')
  })
})
