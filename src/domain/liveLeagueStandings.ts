import type { OfficialLeagueIdentityEvidence } from '../data/leagues/kile-n-others/officialLeagueIdentity.ts'
import type { FplDraftEntryEventLineup, FplDraftEntryHistory } from '../services/fpl/entryEvent.ts'
import { FplDataError } from '../services/fpl/errors.ts'
import type { FplDraftGameweekState } from '../services/fpl/gameState.ts'
import type { FplDraftLeagueDetails, FplDraftLeagueStanding } from '../services/fpl/leagueDetails.ts'
import type { FplDraftLiveEvent } from '../services/fpl/liveEvent.ts'

export type LiveLeagueFreshnessStatus = 'FRESH' | 'STALE'

export interface LiveLeagueFreshness {
  readonly retrievedAt: string
  readonly ageMs: number
  readonly staleAfterMs: number
  readonly status: LiveLeagueFreshnessStatus
}

export interface LiveLineupPlayerScore {
  readonly elementId: string
  readonly position: number
  readonly multiplier: number
  readonly livePoints: number
  readonly scoreContribution: number
}

export interface LiveLeagueTeamScore {
  readonly teamName: string
  readonly accountManagerName: string
  readonly rosterManagerId: string
  readonly officialEntryId: number
  readonly officialLeagueEntryId: number
  readonly eventId: number
  readonly liveGameweekScore: number
  readonly starters: readonly LiveLineupPlayerScore[]
  readonly bench: readonly LiveLineupPlayerScore[]
  readonly provenance: 'OFFICIAL_LINEUP_PLUS_OFFICIAL_LIVE_PLAYER_POINTS'
}

export interface AvailableSeasonBaseline {
  readonly status: 'AVAILABLE'
  readonly eventId: number
  readonly provenance: 'SEASON_START_ZERO' | 'VERIFIED_PREVIOUS_EVENT_HISTORY'
  readonly entries: readonly {
    readonly officialEntryId: number
    readonly seasonTotal: number
    readonly priorRank: number | null
  }[]
}

export interface UnavailableSeasonBaseline {
  readonly status: 'UNAVAILABLE'
  readonly eventId: number
  readonly reason: 'PREVIOUS_FINALIZED_SEASON_BASELINE_NOT_YET_VERIFIED'
  readonly candidatePreviousEventHistoryComplete: boolean
}

export type LiveSeasonBaseline = AvailableSeasonBaseline | UnavailableSeasonBaseline

export interface LiveOfficialStandingComparison {
  readonly rank: number
  readonly lastRank: number | null
  readonly rankSort: number
  readonly eventTotal: number
  readonly seasonTotal: number
  readonly gameweekScoreDifference: number
  readonly seasonTotalDifference: number
  /** Equality only means the current values match; it is not proof of finalization. */
  readonly valuesCurrentlyMatch: boolean
}

export interface LiveLeagueStandingRow extends LiveLeagueTeamScore {
  readonly baselineSeasonTotal: number
  readonly liveSeasonTotal: number
  /** Competition rank. Equal totals share a rank and the next rank is skipped. */
  readonly liveRank: number
  readonly isTied: boolean
  readonly tiedTeamCount: number
  readonly priorRank: number | null
  /** Positive means places gained. Null when no verified prior rank exists. */
  readonly rankMovement: number | null
  /** Points to the nearest strictly higher score; null when no higher score exists. */
  readonly gapToAbove: number | null
  /** Points over the nearest strictly lower score; null when no lower score exists. */
  readonly gapToBelow: number | null
  readonly officialComparison: LiveOfficialStandingComparison
}

export interface AvailableLiveLeagueStandings {
  readonly status: 'AVAILABLE'
  readonly rows: readonly LiveLeagueStandingRow[]
}

export interface UnavailableLiveLeagueStandings {
  readonly status: 'UNAVAILABLE'
  readonly reason: UnavailableSeasonBaseline['reason']
}

export interface LiveLeagueStandingsSnapshot {
  readonly leagueId: number
  readonly eventId: number
  readonly gameweekState: FplDraftGameweekState
  readonly teamScores: readonly LiveLeagueTeamScore[]
  readonly seasonBaseline: LiveSeasonBaseline
  readonly standings: AvailableLiveLeagueStandings | UnavailableLiveLeagueStandings
  readonly calculationStatus: 'PROVISIONAL'
  readonly reconciliationStatus: 'NOT_PROVEN'
  readonly freshness: LiveLeagueFreshness
}

export interface BuildLiveLeagueStandingsInput {
  readonly identity: OfficialLeagueIdentityEvidence
  readonly gameweekState: FplDraftGameweekState
  readonly knownPlayerIds: readonly string[]
  readonly lineups: readonly FplDraftEntryEventLineup[]
  readonly liveEvent: FplDraftLiveEvent
  readonly histories?: readonly FplDraftEntryHistory[]
  readonly leagueDetails: FplDraftLeagueDetails
  readonly retrievedAt: string
  readonly now?: Date
  readonly staleAfterMs?: number
  /** Optional only after a future source has independently met the finalized-baseline contract. */
  readonly seasonBaseline?: LiveSeasonBaseline
}

const DEFAULT_STALE_AFTER_MS = 90_000

function fail(message: string): never {
  throw new FplDataError('MISSING_REQUIRED_MAPPING', message)
}

function uniqueMap<T, K>(
  values: readonly T[],
  keyOf: (value: T) => K,
  label: string,
): Map<K, T> {
  const result = new Map<K, T>()
  values.forEach((value) => {
    const key = keyOf(value)
    if (result.has(key)) fail(`Duplicate ${label} ${String(key)}`)
    result.set(key, value)
  })
  return result
}

export function deriveLiveLeagueFreshness(
  retrievedAt: string,
  now: Date = new Date(),
  staleAfterMs = DEFAULT_STALE_AFTER_MS,
): LiveLeagueFreshness {
  const retrievedTime = Date.parse(retrievedAt)
  if (Number.isNaN(retrievedTime)) fail('Live league retrieval time must be an ISO timestamp')
  if (!Number.isFinite(staleAfterMs) || staleAfterMs <= 0) fail('Stale threshold must be positive')
  const ageMs = Math.max(0, now.getTime() - retrievedTime)
  return Object.freeze({
    retrievedAt,
    ageMs,
    staleAfterMs,
    status: ageMs > staleAfterMs ? 'STALE' : 'FRESH',
  })
}

export function deriveLiveSeasonBaseline(
  eventId: number,
  identity: OfficialLeagueIdentityEvidence,
  histories: readonly FplDraftEntryHistory[],
): LiveSeasonBaseline {
  const historyByEntry = uniqueMap(histories, ({ officialEntryId }) => officialEntryId, 'entry history')
  if (historyByEntry.size !== identity.participants.length) {
    fail('Entry history collection must contain exactly the six verified league entries')
  }
  identity.participants.forEach(({ officialEntryId }) => {
    if (!historyByEntry.has(officialEntryId)) fail(`Official entry ${officialEntryId} has no history`)
  })
  historyByEntry.forEach((_, officialEntryId) => {
    if (!identity.participants.some((participant) => participant.officialEntryId === officialEntryId)) {
      fail(`Entry history references unknown official entry ${officialEntryId}`)
    }
  })

  if (eventId === 1) {
    return Object.freeze({
      status: 'AVAILABLE',
      eventId,
      provenance: 'SEASON_START_ZERO',
      entries: Object.freeze(identity.participants.map(({ officialEntryId }) => Object.freeze({
        officialEntryId,
        seasonTotal: 0,
        priorRank: null,
      }))),
    })
  }

  const previousEventId = eventId - 1
  const candidatePreviousEventHistoryComplete = identity.participants.every(({ officialEntryId }) => (
    historyByEntry.get(officialEntryId)?.records.some((record) => record.eventId === previousEventId) === true
  ))
  return Object.freeze({
    status: 'UNAVAILABLE',
    eventId,
    reason: 'PREVIOUS_FINALIZED_SEASON_BASELINE_NOT_YET_VERIFIED',
    candidatePreviousEventHistoryComplete,
  })
}

function validateIdentityAndSources(input: BuildLiveLeagueStandingsInput): {
  lineupByEntry: Map<number, FplDraftEntryEventLineup>
  livePointsByPlayer: Map<string, number>
  standingByLeagueEntry: Map<number, FplDraftLeagueStanding>
} {
  const { identity, gameweekState, knownPlayerIds, lineups, liveEvent, leagueDetails } = input
  if (identity.leagueId !== leagueDetails.leagueId) fail('League details do not match the verified league')
  if (liveEvent.eventId !== gameweekState.eventId) fail('Live event and Gameweek state IDs do not match')
  if (identity.participants.length !== 6) fail('Live standings require exactly six verified participants')

  const identityByEntry = uniqueMap(identity.participants, ({ officialEntryId }) => officialEntryId, 'identity entry')
  const identityByLeagueEntry = uniqueMap(
    identity.participants,
    ({ officialLeagueEntryId }) => officialLeagueEntryId,
    'identity league-entry',
  )
  const lineupByEntry = uniqueMap(lineups, ({ officialEntryId }) => officialEntryId, 'lineup entry')
  if (lineupByEntry.size !== identityByEntry.size) fail('Lineups must contain exactly six verified entries')
  lineupByEntry.forEach((lineup, officialEntryId) => {
    if (!identityByEntry.has(officialEntryId)) fail(`Lineup references unknown official entry ${officialEntryId}`)
    if (lineup.eventId !== gameweekState.eventId) fail(`Lineup entry ${officialEntryId} has a contradictory Gameweek ID`)
    if (lineup.starters.length !== 11 || lineup.bench.length !== 4) {
      fail(`Lineup entry ${officialEntryId} must contain 11 starters and 4 bench players`)
    }
    if (lineup.substitutionCount !== 0) {
      fail(`Lineup entry ${officialEntryId} contains unverified substitution semantics`)
    }
    const selections = [...lineup.starters, ...lineup.bench]
    const selectionIds = new Set(selections.map(({ elementId }) => elementId))
    const positions = new Set(selections.map(({ position }) => position))
    if (selectionIds.size !== 15 || positions.size !== 15) {
      fail(`Lineup entry ${officialEntryId} contains duplicate player or position data`)
    }
  })
  identityByEntry.forEach((_, officialEntryId) => {
    if (!lineupByEntry.has(officialEntryId)) fail(`Official entry ${officialEntryId} has no lineup`)
  })

  const knownIds = new Set(knownPlayerIds)
  if (knownIds.size !== knownPlayerIds.length) fail('Normalized player pool contains duplicate player IDs')
  const liveByPlayer = uniqueMap(liveEvent.players, ({ elementId }) => elementId, 'live player')
  if (
    knownIds.size !== liveByPlayer.size
    || [...knownIds].some((elementId) => !liveByPlayer.has(elementId))
  ) {
    fail('Live player IDs do not exactly match the normalized current player pool')
  }
  const livePointsByPlayer = new Map(
    liveEvent.players.map(({ elementId, stats }) => [elementId, stats.totalPoints]),
  )

  const participantByEntry = uniqueMap(
    leagueDetails.participants,
    ({ officialEntryId }) => officialEntryId,
    'league participant entry',
  )
  if (participantByEntry.size !== identityByEntry.size) fail('League details must contain six participants')
  identity.participants.forEach((participant) => {
    const observed = participantByEntry.get(participant.officialEntryId)
    if (
      observed === undefined
      || observed.officialLeagueEntryId !== participant.officialLeagueEntryId
      || observed.entryName !== participant.officialEntryName
      || observed.playerFirstName !== participant.officialPlayerFirstName
    ) {
      fail(`League participant identity contradicts ${participant.teamName}`)
    }
  })

  const standingByLeagueEntry = uniqueMap(
    leagueDetails.standings,
    ({ officialLeagueEntryId }) => officialLeagueEntryId,
    'league standing',
  )
  if (standingByLeagueEntry.size !== identityByLeagueEntry.size) fail('League details must contain six standings')
  standingByLeagueEntry.forEach((_, officialLeagueEntryId) => {
    if (!identityByLeagueEntry.has(officialLeagueEntryId)) {
      fail(`Standing references unknown official league-entry ${officialLeagueEntryId}`)
    }
  })

  return { lineupByEntry, livePointsByPlayer, standingByLeagueEntry }
}

function scoreSelections(
  selections: FplDraftEntryEventLineup['starters'],
  livePointsByPlayer: ReadonlyMap<string, number>,
  officialEntryId: number,
): readonly LiveLineupPlayerScore[] {
  return Object.freeze(selections.map((selection) => {
    const livePoints = livePointsByPlayer.get(selection.elementId)
    if (livePoints === undefined) {
      fail(`Lineup entry ${officialEntryId} references missing live player ${selection.elementId}`)
    }
    if (!Number.isSafeInteger(selection.multiplier) || selection.multiplier < 0) {
      fail(`Lineup player ${selection.elementId} has invalid multiplier ${selection.multiplier}`)
    }
    return Object.freeze({
      elementId: selection.elementId,
      position: selection.position,
      multiplier: selection.multiplier,
      livePoints,
      scoreContribution: livePoints * selection.multiplier,
    })
  }))
}

function buildRanks(
  teamScores: readonly LiveLeagueTeamScore[],
  baseline: AvailableSeasonBaseline,
  standingByLeagueEntry: ReadonlyMap<number, FplDraftLeagueStanding>,
): readonly LiveLeagueStandingRow[] {
  const baselineByEntry = uniqueMap(
    baseline.entries,
    ({ officialEntryId }) => officialEntryId,
    'season baseline entry',
  )
  if (baselineByEntry.size !== teamScores.length) {
    fail('Season baseline must contain exactly the six verified entries')
  }
  baselineByEntry.forEach((_, officialEntryId) => {
    if (!teamScores.some((team) => team.officialEntryId === officialEntryId)) {
      fail(`Season baseline references unknown official entry ${officialEntryId}`)
    }
  })
  const totals = teamScores.map((team) => {
    const baselineEntry = baselineByEntry.get(team.officialEntryId)
    if (baselineEntry === undefined) fail(`Missing baseline for entry ${team.officialEntryId}`)
    const baselineSeasonTotal = baselineEntry.seasonTotal
    return { team, baselineSeasonTotal, liveSeasonTotal: baselineSeasonTotal + team.liveGameweekScore }
  }).sort((left, right) => (
    right.liveSeasonTotal - left.liveSeasonTotal
    || left.team.officialEntryId - right.team.officialEntryId
  ))
  const countByTotal = new Map<number, number>()
  totals.forEach(({ liveSeasonTotal }) => {
    countByTotal.set(liveSeasonTotal, (countByTotal.get(liveSeasonTotal) ?? 0) + 1)
  })
  const distinctTotals = [...countByTotal.keys()].sort((left, right) => right - left)

  return Object.freeze(totals.map((item, index) => {
    const previous = totals[index - 1]
    const liveRank = previous === undefined || previous.liveSeasonTotal !== item.liveSeasonTotal
      ? index + 1
      : (totals.findIndex(({ liveSeasonTotal }) => liveSeasonTotal === item.liveSeasonTotal) + 1)
    const totalIndex = distinctTotals.indexOf(item.liveSeasonTotal)
    const higherTotal = distinctTotals[totalIndex - 1]
    const lowerTotal = distinctTotals[totalIndex + 1]
    const priorRank = baselineByEntry.get(item.team.officialEntryId)?.priorRank ?? null
    const official = standingByLeagueEntry.get(item.team.officialLeagueEntryId)
    if (official === undefined) fail(`Missing official standing for ${item.team.teamName}`)
    const officialComparison = Object.freeze({
      rank: official.rank,
      lastRank: official.lastRank,
      rankSort: official.rankSort,
      eventTotal: official.eventTotal,
      seasonTotal: official.total,
      gameweekScoreDifference: item.team.liveGameweekScore - official.eventTotal,
      seasonTotalDifference: item.liveSeasonTotal - official.total,
      valuesCurrentlyMatch: (
        item.team.liveGameweekScore === official.eventTotal
        && item.liveSeasonTotal === official.total
      ),
    })
    return Object.freeze({
      ...item.team,
      baselineSeasonTotal: item.baselineSeasonTotal,
      liveSeasonTotal: item.liveSeasonTotal,
      liveRank,
      isTied: (countByTotal.get(item.liveSeasonTotal) ?? 0) > 1,
      tiedTeamCount: countByTotal.get(item.liveSeasonTotal) ?? 1,
      priorRank,
      rankMovement: priorRank === null ? null : priorRank - liveRank,
      gapToAbove: higherTotal === undefined ? null : higherTotal - item.liveSeasonTotal,
      gapToBelow: lowerTotal === undefined ? null : item.liveSeasonTotal - lowerTotal,
      officialComparison,
    })
  }))
}

export function buildLiveLeagueStandings(
  input: BuildLiveLeagueStandingsInput,
): LiveLeagueStandingsSnapshot {
  const { lineupByEntry, livePointsByPlayer, standingByLeagueEntry } = validateIdentityAndSources(input)
  const teamScores = Object.freeze(input.identity.participants.map((identity) => {
    const lineup = lineupByEntry.get(identity.officialEntryId)
    if (lineup === undefined) fail(`Official entry ${identity.officialEntryId} has no lineup`)
    const starters = scoreSelections(lineup.starters, livePointsByPlayer, identity.officialEntryId)
    const bench = scoreSelections(lineup.bench, livePointsByPlayer, identity.officialEntryId)
    return Object.freeze({
      teamName: identity.teamName,
      accountManagerName: identity.accountManagerName,
      rosterManagerId: identity.rosterManagerId,
      officialEntryId: identity.officialEntryId,
      officialLeagueEntryId: identity.officialLeagueEntryId,
      eventId: input.gameweekState.eventId,
      liveGameweekScore: starters.reduce((sum, player) => sum + player.scoreContribution, 0),
      starters,
      bench,
      provenance: 'OFFICIAL_LINEUP_PLUS_OFFICIAL_LIVE_PLAYER_POINTS' as const,
    })
  }))
  const histories = input.histories ?? input.identity.participants.map(({ officialEntryId }) => ({
    officialEntryId,
    records: [],
  }))
  const seasonBaseline = input.seasonBaseline ?? deriveLiveSeasonBaseline(
    input.gameweekState.eventId,
    input.identity,
    histories,
  )
  if (seasonBaseline.eventId !== input.gameweekState.eventId) {
    fail('Season baseline and Gameweek state IDs do not match')
  }
  const standings: AvailableLiveLeagueStandings | UnavailableLiveLeagueStandings = (
    seasonBaseline.status === 'AVAILABLE'
      ? Object.freeze({
          status: 'AVAILABLE' as const,
          rows: buildRanks(teamScores, seasonBaseline, standingByLeagueEntry),
        })
      : Object.freeze({ status: 'UNAVAILABLE' as const, reason: seasonBaseline.reason })
  )
  return Object.freeze({
    leagueId: input.identity.leagueId,
    eventId: input.gameweekState.eventId,
    gameweekState: input.gameweekState,
    teamScores,
    seasonBaseline,
    standings,
    calculationStatus: 'PROVISIONAL',
    reconciliationStatus: 'NOT_PROVEN',
    freshness: deriveLiveLeagueFreshness(
      input.retrievedAt,
      input.now,
      input.staleAfterMs,
    ),
  })
}
