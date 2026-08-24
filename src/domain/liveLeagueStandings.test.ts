import { describe, expect, it } from 'vitest'

import { officialLeagueIdentity202627 } from '../data/leagues/kile-n-others/officialLeagueIdentity2026-27.ts'
import { normalizeFplDraftEntryEventLineup } from '../services/fpl/entryEvent.ts'
import { normalizeFplDraftLeagueDetails } from '../services/fpl/leagueDetails.ts'
import { normalizeFplDraftLiveEvent } from '../services/fpl/liveEvent.ts'
import { buildLiveLeagueStandings, deriveLiveLeagueFreshness } from './liveLeagueStandings.ts'

function rawStats(totalPoints: number) {
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
    total_points: totalPoints,
    in_dreamteam: false,
  }
}

function fixtureInput(options: {
  points?: ReadonlyMap<string, number>
  eventId?: number
  currentEventFinished?: boolean
  multiplier?: { elementId: string, value: number }
  officialEventTotals?: readonly number[]
} = {}) {
  const eventId = options.eventId ?? 1
  const knownPlayerIds = Array.from({ length: 90 }, (_, index) => String(index + 1))
  const lineups = officialLeagueIdentity202627.participants.map((identity, participantIndex) => (
    normalizeFplDraftEntryEventLineup({
      picks: Array.from({ length: 15 }, (_, index) => {
        const elementId = String(participantIndex * 15 + index + 1)
        return {
          element: Number(elementId),
          position: index + 1,
          is_captain: false,
          is_vice_captain: false,
          multiplier: options.multiplier?.elementId === elementId ? options.multiplier.value : 1,
        }
      }),
      entry_history: {},
      subs: [],
    }, identity.officialEntryId, eventId)
  ))
  const liveEvent = normalizeFplDraftLiveEvent({
    elements: Object.fromEntries(knownPlayerIds.map((elementId) => [
      elementId,
      { stats: rawStats(options.points?.get(elementId) ?? 0) },
    ])),
    fixtures: [{
      id: 1,
      event: eventId,
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
    }],
  }, eventId)
  const leagueDetails = normalizeFplDraftLeagueDetails({
    league: {
      id: 45938,
      name: 'Kile n Others',
      scoring: 'c',
      start_event: 1,
      stop_event: 38,
      draft_status: 'post',
    },
    league_entries: officialLeagueIdentity202627.participants.map((identity) => ({
      entry_id: identity.officialEntryId,
      id: identity.officialLeagueEntryId,
      entry_name: identity.officialEntryName,
      player_first_name: identity.officialPlayerFirstName,
    })),
    standings: officialLeagueIdentity202627.participants.map((identity, index) => ({
      league_entry: identity.officialLeagueEntryId,
      rank: index + 1,
      last_rank: null,
      rank_sort: index + 1,
      event_total: options.officialEventTotals?.[index] ?? 0,
      total: options.officialEventTotals?.[index] ?? 0,
    })),
  })
  const histories = officialLeagueIdentity202627.participants.map(({ officialEntryId }) => ({
    officialEntryId,
    records: eventId === 1 ? [] : [{
      eventId: eventId - 1,
      eventPoints: 10,
      seasonTotal: 10,
      pointsOnBench: 0,
      transfers: 0,
      rank: 1,
      rankSort: 1,
    }],
  }))
  return {
    identity: officialLeagueIdentity202627,
    gameweekState: {
      eventId,
      phase: options.currentEventFinished ? 'OFFICIAL_EVENT_MARKED_FINISHED' as const : 'ACTIVE' as const,
      deadlineTime: '2026-08-21T17:30:00Z',
      hasLiveFixture: true,
      allFixturesStarted: false,
      allFixturesFootballComplete: false,
      officialEventFinished: options.currentEventFinished ?? false,
      bootstrapEventFinished: false,
    },
    knownPlayerIds,
    lineups,
    liveEvent,
    histories,
    leagueDetails,
    retrievedAt: '2026-08-24T12:00:00Z',
  }
}

describe('G3 live league standings engine', () => {
  it('distinguishes fresh and stale snapshots from source retrieval time', () => {
    expect(deriveLiveLeagueFreshness(
      '2026-08-24T12:00:00Z',
      new Date('2026-08-24T12:00:30Z'),
      60_000,
    ).status).toBe('FRESH')
    expect(deriveLiveLeagueFreshness(
      '2026-08-24T12:00:00Z',
      new Date('2026-08-24T12:02:00Z'),
      60_000,
    )).toMatchObject({ status: 'STALE', ageMs: 120_000 })
  })

  it('uses a verified zero baseline for GW1 and scores exactly 11 starters', () => {
    const points = new Map<string, number>()
    for (let element = 1; element <= 90; element += 1) points.set(String(element), 1)
    points.set('12', 25)
    const result = buildLiveLeagueStandings(fixtureInput({
      points,
      multiplier: { elementId: '1', value: 2 },
    }))

    expect(result.seasonBaseline).toMatchObject({ status: 'AVAILABLE', provenance: 'SEASON_START_ZERO' })
    expect(result.teamScores).toHaveLength(6)
    expect(result.teamScores.every(({ starters }) => starters.length === 11)).toBe(true)
    expect(result.teamScores.map(({ liveGameweekScore }) => liveGameweekScore)).toEqual([12, 11, 11, 11, 11, 11])
    expect(result.teamScores[0]).toMatchObject({
      teamName: 'Jakin Goff',
      liveGameweekScore: 12,
    })
    expect(result.teamScores[0].bench[0]).toMatchObject({ livePoints: 25, scoreContribution: 25 })
    expect(result.standings.status).toBe('AVAILABLE')
    if (result.standings.status !== 'AVAILABLE') throw new Error('Expected standings')
    expect(result.standings.rows.find(({ teamName }) => teamName === 'Jakin Goff')).toMatchObject({
      baselineSeasonTotal: 0,
      liveSeasonTotal: 12,
    })
  })

  it('updates ranks from changed official live points and calculates distinct-score gaps', () => {
    const initialPoints = new Map<string, number>([['1', 6], ['16', 5], ['31', 4], ['46', 3], ['61', 2], ['76', 1]])
    const initial = buildLiveLeagueStandings(fixtureInput({ points: initialPoints }))
    if (initial.standings.status !== 'AVAILABLE') throw new Error('Expected standings')
    expect(initial.standings.rows.map(({ teamName, liveRank }) => [teamName, liveRank])).toEqual([
      ['Jakin Goff', 1], ['Dindi', 2], ['22nd oBlock', 3], ['Miku007', 4],
      ['Rod Wave Disciples', 5], ['Tintilinic', 6],
    ])
    expect(initial.standings.rows[2]).toMatchObject({ gapToAbove: 1, gapToBelow: 1 })

    const changedPoints = new Map(initialPoints)
    changedPoints.set('46', 7)
    const changed = buildLiveLeagueStandings(fixtureInput({ points: changedPoints }))
    if (changed.standings.status !== 'AVAILABLE') throw new Error('Expected standings')
    expect(changed.standings.rows[0]).toMatchObject({ teamName: 'Miku007', liveRank: 1 })
    expect(changed.standings.rows.find(({ teamName }) => teamName === 'Jakin Goff')?.liveRank).toBe(2)
  })

  it('preserves ties as shared competition ranks without inventing a tie winner', () => {
    const points = new Map<string, number>([['1', 5], ['16', 5], ['31', 3], ['46', 2], ['61', 1], ['76', 0]])
    const result = buildLiveLeagueStandings(fixtureInput({ points }))
    if (result.standings.status !== 'AVAILABLE') throw new Error('Expected standings')
    expect(result.standings.rows.slice(0, 3).map(({ liveRank }) => liveRank)).toEqual([1, 1, 3])
    expect(result.standings.rows[0]).toMatchObject({ isTied: true, tiedTeamCount: 2, gapToAbove: null, gapToBelow: 2 })
    expect(result.standings.rows[1]).toMatchObject({ isTied: true, tiedTeamCount: 2, gapToAbove: null, gapToBelow: 2 })
  })

  it('derives rank movement from an explicitly verified prior baseline', () => {
    const input = fixtureInput({ eventId: 2, points: new Map([['46', 40]]) })
    const baselineEntries = officialLeagueIdentity202627.participants.map((identity, index) => ({
      officialEntryId: identity.officialEntryId,
      seasonTotal: 100 - index * 10,
      priorRank: index + 1,
    }))
    const result = buildLiveLeagueStandings({
      ...input,
      seasonBaseline: {
        status: 'AVAILABLE',
        eventId: 2,
        provenance: 'VERIFIED_PREVIOUS_EVENT_HISTORY',
        entries: baselineEntries,
      },
    })
    if (result.standings.status !== 'AVAILABLE') throw new Error('Expected standings')
    const miku = result.standings.rows.find(({ teamName }) => teamName === 'Miku007')
    expect(miku).toMatchObject({ priorRank: 4, liveRank: 1, rankMovement: 3 })
  })

  it('compares lagging official values without replacing or finalizing live values', () => {
    const points = new Map<string, number>([['1', 44]])
    const result = buildLiveLeagueStandings(fixtureInput({
      points,
      officialEventTotals: [42, 0, 0, 0, 0, 0],
      currentEventFinished: true,
    }))
    if (result.standings.status !== 'AVAILABLE') throw new Error('Expected standings')
    const jakin = result.standings.rows.find(({ teamName }) => teamName === 'Jakin Goff')
    expect(jakin).toMatchObject({
      liveGameweekScore: 44,
      officialComparison: {
        eventTotal: 42,
        gameweekScoreDifference: 2,
        valuesCurrentlyMatch: false,
      },
    })
    expect(result).toMatchObject({
      calculationStatus: 'PROVISIONAL',
      reconciliationStatus: 'NOT_PROVEN',
      gameweekState: { phase: 'OFFICIAL_EVENT_MARKED_FINISHED' },
    })
  })

  it('fails closed for missing players, duplicate/missing entries, and Gameweek mismatches', () => {
    const missingPlayer = fixtureInput()
    expect(() => buildLiveLeagueStandings({
      ...missingPlayer,
      knownPlayerIds: missingPlayer.knownPlayerIds.slice(1),
    })).toThrow(/do not exactly match/)

    const unknownLineupPlayer = fixtureInput()
    const firstLineup = unknownLineupPlayer.lineups[0]
    const changedFirstLineup = {
      ...firstLineup,
      starters: [
        { ...firstLineup.starters[0], elementId: '999' },
        ...firstLineup.starters.slice(1),
      ],
    }
    expect(() => buildLiveLeagueStandings({
      ...unknownLineupPlayer,
      lineups: [changedFirstLineup, ...unknownLineupPlayer.lineups.slice(1)],
    })).toThrow(/missing live player 999/)

    const duplicateEntry = fixtureInput()
    expect(() => buildLiveLeagueStandings({
      ...duplicateEntry,
      lineups: [...duplicateEntry.lineups.slice(0, 5), duplicateEntry.lineups[0]],
    })).toThrow(/Duplicate lineup entry/)

    const missingEntry = fixtureInput()
    expect(() => buildLiveLeagueStandings({
      ...missingEntry,
      lineups: missingEntry.lineups.slice(0, 5),
    })).toThrow(/exactly six verified entries/)

    const mismatch = fixtureInput()
    const contradictory = { ...mismatch.liveEvent, eventId: 2 }
    expect(() => buildLiveLeagueStandings({ ...mismatch, liveEvent: contradictory })).toThrow(/IDs do not match/)
  })

  it('keeps future season standings unavailable until a baseline contract is observed', () => {
    const result = buildLiveLeagueStandings(fixtureInput({ eventId: 2 }))
    expect(result.teamScores).toHaveLength(6)
    expect(result.seasonBaseline).toMatchObject({
      status: 'UNAVAILABLE',
      reason: 'PREVIOUS_FINALIZED_SEASON_BASELINE_NOT_YET_VERIFIED',
      candidatePreviousEventHistoryComplete: true,
    })
    expect(result.standings).toEqual({
      status: 'UNAVAILABLE',
      reason: 'PREVIOUS_FINALIZED_SEASON_BASELINE_NOT_YET_VERIFIED',
    })
  })
})
