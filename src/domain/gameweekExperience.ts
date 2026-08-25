import { officialLeagueIdentity202627 } from '../data/leagues/kile-n-others/officialLeagueIdentity2026-27.ts'
import type { OfficialLeagueParticipantIdentity } from '../data/leagues/kile-n-others/officialLeagueIdentity.ts'
import type { Player, Position } from './player.ts'
import type { LiveLineupPlayerScore } from './liveLeagueStandings.ts'
import type { LiveLeagueRefreshState, RetrievedLiveLeagueState } from '../services/fpl/liveLeagueState.ts'
import { FplDataError } from '../services/fpl/errors.ts'

export type GameweekExperienceMode = 'PLANNER' | 'OFFICIAL' | 'UNAVAILABLE'

export interface GameweekModeResolution {
  readonly mode: GameweekExperienceMode
  readonly eventId: number
  readonly deadlineTime: string
  readonly reason:
    | 'UPCOMING_BEFORE_DEADLINE'
    | 'NEXT_EVENT_BEFORE_DEADLINE'
    | 'CURRENT_EVENT_OFFICIAL_LINEUP'
    | 'NEXT_EVENT_LINEUP_NOT_YET_AVAILABLE'
}

export type GameweekPlayerRole = 'CURRENT_ROSTER' | 'STARTER' | 'BENCH'

export interface EnrichedGameweekPlayer {
  readonly id: string
  readonly name: string
  readonly position: Position
  readonly clubName: string
  readonly clubShortName: string
  readonly form: number | null
  readonly totalPoints: number | null
  readonly officialDraftRank: number | null
  readonly ownerTeamName: string
  readonly officialOwnerEntryId: number
  readonly role: GameweekPlayerRole
  readonly lineupPosition: number | null
  readonly benchOrder: number | null
  readonly liveGameweekPoints: number | null
  readonly multiplier: number | null
  readonly scoreContribution: number | null
}

export interface EnrichedOfficialLineup {
  readonly starters: readonly EnrichedGameweekPlayer[]
  readonly bench: readonly EnrichedGameweekPlayer[]
  readonly formation: string
  readonly liveGameweekScore: number
  readonly provenance: 'OFFICIAL_LINEUP_PLUS_OFFICIAL_LIVE_PLAYER_POINTS'
}

export interface EnrichedGameweekTeam {
  readonly teamName: string
  readonly managerName: string
  readonly rosterManagerId: string
  readonly officialEntryId: number
  readonly officialLeagueEntryId: number
  readonly currentRoster: readonly EnrichedGameweekPlayer[]
  readonly officialLineup: EnrichedOfficialLineup
}

export interface LeagueGameweekExperience {
  readonly mode: GameweekExperienceMode
  readonly modeReason: GameweekModeResolution['reason']
  readonly eventId: number
  readonly deadlineTime: string
  readonly sourceEventId: number
  readonly phase: RetrievedLiveLeagueState['snapshot']['gameweekState']['phase']
  readonly teams: readonly EnrichedGameweekTeam[]
  readonly freshness: LiveLeagueRefreshState['freshness']
  readonly refreshStatus: LiveLeagueRefreshState['status']
  readonly refreshError: string | null
  readonly retrievedAt: string
  readonly calculationStatus: 'PROVISIONAL'
  readonly reconciliationStatus: 'NOT_PROVEN'
}

export interface PlannerLineup {
  readonly eventId: number
  readonly rosterFingerprint: string
  readonly starters: readonly EnrichedGameweekPlayer[]
  readonly bench: readonly EnrichedGameweekPlayer[]
  readonly formation: string
}

const POSITION_ORDER: readonly Position[] = ['GK', 'DEF', 'MID', 'FWD']
const PLANNER_STARTER_COUNTS: Readonly<Record<Position, number>> = {
  GK: 1,
  DEF: 4,
  MID: 4,
  FWD: 2,
}

function fail(message: string): never {
  throw new FplDataError('MISSING_REQUIRED_MAPPING', message)
}

function uniqueMap<T, K>(values: readonly T[], key: (value: T) => K, label: string): Map<K, T> {
  const mapped = new Map<K, T>()
  values.forEach((value) => {
    const id = key(value)
    if (mapped.has(id)) fail(`Duplicate ${label} ${String(id)}`)
    mapped.set(id, value)
  })
  return mapped
}

function comparePlayers(left: Player, right: Player): number {
  return (
    POSITION_ORDER.indexOf(left.position) - POSITION_ORDER.indexOf(right.position)
    || (left.fullName ?? left.displayName).localeCompare(right.fullName ?? right.displayName)
    || Number(left.id) - Number(right.id)
  )
}

function displayName(player: Player): string {
  return player.fullName ?? player.displayName
}

function enrichRosterPlayer(
  player: Player,
  identity: OfficialLeagueParticipantIdentity,
): EnrichedGameweekPlayer {
  return Object.freeze({
    id: player.id,
    name: displayName(player),
    position: player.position,
    clubName: player.club.name,
    clubShortName: player.club.shortName,
    form: player.form ?? null,
    totalPoints: player.totalPoints ?? null,
    officialDraftRank: player.officialDraftRank,
    ownerTeamName: identity.teamName,
    officialOwnerEntryId: identity.officialEntryId,
    role: 'CURRENT_ROSTER',
    lineupPosition: null,
    benchOrder: null,
    liveGameweekPoints: null,
    multiplier: null,
    scoreContribution: null,
  })
}

export function resolveGameweekExperienceMode(
  live: RetrievedLiveLeagueState,
  now: Date = new Date(),
): GameweekModeResolution {
  const state = live.snapshot.gameweekState
  const currentDeadline = Date.parse(state.deadlineTime)
  if (Number.isNaN(currentDeadline)) fail('Current Gameweek deadline is invalid')

  if (
    (state.phase === 'FOOTBALL_COMPLETE' || state.phase === 'OFFICIAL_EVENT_MARKED_FINISHED')
    && live.nextEvent !== null
  ) {
    const nextDeadline = Date.parse(live.nextEvent.deadlineTime)
    if (Number.isNaN(nextDeadline)) fail('Next Gameweek deadline is invalid')
    return Object.freeze({
      mode: now.getTime() < nextDeadline ? 'PLANNER' : 'UNAVAILABLE',
      eventId: live.nextEvent.eventId,
      deadlineTime: live.nextEvent.deadlineTime,
      reason: now.getTime() < nextDeadline
        ? 'NEXT_EVENT_BEFORE_DEADLINE'
        : 'NEXT_EVENT_LINEUP_NOT_YET_AVAILABLE',
    })
  }

  if (state.phase === 'UPCOMING' && now.getTime() < currentDeadline) {
    return Object.freeze({
      mode: 'PLANNER',
      eventId: state.eventId,
      deadlineTime: state.deadlineTime,
      reason: 'UPCOMING_BEFORE_DEADLINE',
    })
  }

  return Object.freeze({
    mode: 'OFFICIAL',
    eventId: state.eventId,
    deadlineTime: state.deadlineTime,
    reason: 'CURRENT_EVENT_OFFICIAL_LINEUP',
  })
}

export function deriveFormation(players: readonly Pick<EnrichedGameweekPlayer, 'position'>[]): string {
  const counts = { DEF: 0, MID: 0, FWD: 0 }
  players.forEach(({ position }) => {
    if (position !== 'GK') counts[position] += 1
  })
  return `${counts.DEF}-${counts.MID}-${counts.FWD}`
}

function enrichSelection(
  rosterPlayer: EnrichedGameweekPlayer,
  selection: LiveLineupPlayerScore,
  role: 'STARTER' | 'BENCH',
): EnrichedGameweekPlayer {
  return Object.freeze({
    ...rosterPlayer,
    role,
    lineupPosition: selection.position,
    benchOrder: role === 'BENCH' ? selection.position - 11 : null,
    liveGameweekPoints: selection.livePoints,
    multiplier: selection.multiplier,
    scoreContribution: selection.scoreContribution,
  })
}

export function buildLeagueGameweekExperience(
  players: readonly Player[],
  refresh: LiveLeagueRefreshState,
  now: Date = new Date(),
): LeagueGameweekExperience {
  if (refresh.data === null || refresh.freshness === null) fail('Live league state is unavailable')
  const live = refresh.data
  const playerById = uniqueMap(players, ({ id }) => id, 'catalogue player')
  const ownerByPlayer = uniqueMap(live.ownership.elements, ({ elementId }) => elementId, 'ownership player')
  if (
    playerById.size !== ownerByPlayer.size
    || [...playerById.keys()].some((id) => !ownerByPlayer.has(id))
  ) fail('Official ownership does not exactly match the current player catalogue')

  const identityByEntry = uniqueMap(
    officialLeagueIdentity202627.participants,
    ({ officialEntryId }) => officialEntryId,
    'official participant',
  )
  const scoreByEntry = uniqueMap(
    live.snapshot.teamScores,
    ({ officialEntryId }) => officialEntryId,
    'live team score',
  )
  if (scoreByEntry.size !== identityByEntry.size) fail('Live team scores must contain all six entries')

  const rosterIdsByEntry = new Map<number, string[]>()
  live.ownership.elements.forEach((ownership) => {
    if (ownership.officialOwnerEntryId === null) return
    if (!identityByEntry.has(ownership.officialOwnerEntryId)) {
      fail(`Player ${ownership.elementId} references an unknown official owner`)
    }
    const ids = rosterIdsByEntry.get(ownership.officialOwnerEntryId) ?? []
    ids.push(ownership.elementId)
    rosterIdsByEntry.set(ownership.officialOwnerEntryId, ids)
  })

  const teams = officialLeagueIdentity202627.participants.map((identity) => {
    const rosterIds = rosterIdsByEntry.get(identity.officialEntryId) ?? []
    if (rosterIds.length !== 15) fail(`${identity.teamName} current official roster must contain 15 players`)
    const currentRoster = Object.freeze(rosterIds.map((id) => {
      const player = playerById.get(id)
      if (player === undefined) fail(`Official roster references missing catalogue player ${id}`)
      return enrichRosterPlayer(player, identity)
    }).sort((left, right) => comparePlayers(
      playerById.get(left.id)!,
      playerById.get(right.id)!,
    )))
    const score = scoreByEntry.get(identity.officialEntryId)
    if (score === undefined || score.rosterManagerId !== identity.rosterManagerId) {
      fail(`${identity.teamName} live score does not match its verified product identity`)
    }

    const enrichOfficial = (
      selection: typeof score.starters[number],
      role: 'STARTER' | 'BENCH',
    ) => {
      const player = playerById.get(selection.elementId)
      if (player === undefined) fail(`${identity.teamName} lineup references missing player ${selection.elementId}`)
      const rosterPlayer = enrichRosterPlayer(player, identity)
      return enrichSelection(rosterPlayer, selection, role)
    }
    const starters = Object.freeze(score.starters.map((selection) => enrichOfficial(selection, 'STARTER')))
    const bench = Object.freeze(score.bench.map((selection) => enrichOfficial(selection, 'BENCH')))
    return Object.freeze({
      teamName: identity.teamName,
      managerName: identity.accountManagerName,
      rosterManagerId: identity.rosterManagerId,
      officialEntryId: identity.officialEntryId,
      officialLeagueEntryId: identity.officialLeagueEntryId,
      currentRoster,
      officialLineup: Object.freeze({
        starters,
        bench,
        formation: deriveFormation(starters),
        liveGameweekScore: score.liveGameweekScore,
        provenance: score.provenance,
      }),
    })
  })

  scoreByEntry.forEach((_, entryId) => {
    if (!identityByEntry.has(entryId)) fail(`Live team scores reference unknown entry ${entryId}`)
  })
  const mode = resolveGameweekExperienceMode(live, now)
  return Object.freeze({
    mode: mode.mode,
    modeReason: mode.reason,
    eventId: mode.eventId,
    deadlineTime: mode.deadlineTime,
    sourceEventId: live.snapshot.eventId,
    phase: live.snapshot.gameweekState.phase,
    teams: Object.freeze(teams),
    freshness: refresh.freshness,
    refreshStatus: refresh.status,
    refreshError: refresh.errorMessage,
    retrievedAt: live.snapshot.freshness.retrievedAt,
    calculationStatus: live.snapshot.calculationStatus,
    reconciliationStatus: live.snapshot.reconciliationStatus,
  })
}

export function getGameweekTeam(
  experience: LeagueGameweekExperience,
  rosterManagerId: string,
): EnrichedGameweekTeam {
  const matches = experience.teams.filter((team) => team.rosterManagerId === rosterManagerId)
  if (matches.length !== 1) fail(`Roster manager ${rosterManagerId} does not map to one Gameweek team`)
  return matches[0]
}

export function createDefaultPlannerLineup(
  eventId: number,
  roster: readonly EnrichedGameweekPlayer[],
): PlannerLineup {
  if (roster.length !== 15 || new Set(roster.map(({ id }) => id)).size !== 15) {
    fail('Planner requires one unique 15-player official roster')
  }
  const byPosition = new Map(POSITION_ORDER.map((position) => [
    position,
    roster.filter((player) => player.position === position),
  ]))
  const starters = POSITION_ORDER.flatMap((position) => (
    (byPosition.get(position) ?? []).slice(0, PLANNER_STARTER_COUNTS[position])
  ))
  const starterIds = new Set(starters.map(({ id }) => id))
  const reserveGoalkeeper = (byPosition.get('GK') ?? []).find(({ id }) => !starterIds.has(id))
  if (reserveGoalkeeper === undefined || starters.length !== 11) {
    fail('Official roster cannot form the default 4-4-2 decision workspace')
  }
  const bench = [
    reserveGoalkeeper,
    ...roster.filter(({ id, position }) => position !== 'GK' && !starterIds.has(id)),
  ]
  const planner = Object.freeze({
    eventId,
    rosterFingerprint: [...roster.map(({ id }) => id)].sort().join(','),
    starters: Object.freeze(starters.map((player, index) => Object.freeze({
      ...player,
      role: 'STARTER' as const,
      lineupPosition: index + 1,
    }))),
    bench: Object.freeze(bench.map((player, index) => Object.freeze({
      ...player,
      role: 'BENCH' as const,
      lineupPosition: index + 12,
      benchOrder: index + 1,
    }))),
    formation: deriveFormation(starters),
  })
  validatePlannerLineup(planner)
  return planner
}

export function validatePlannerLineup(planner: PlannerLineup): PlannerLineup {
  if (planner.starters.length !== 11 || planner.bench.length !== 4) {
    fail('Planner must contain 11 starters and four bench players')
  }
  const all = [...planner.starters, ...planner.bench]
  if (new Set(all.map(({ id }) => id)).size !== 15) fail('Planner contains duplicate players')
  if ([...all.map(({ id }) => id)].sort().join(',') !== planner.rosterFingerprint) {
    fail('Planner no longer matches the current official roster')
  }
  const count = (position: Position) => planner.starters.filter((player) => player.position === position).length
  if (
    count('GK') !== 1
    || count('DEF') < 3 || count('DEF') > 5
    || count('MID') < 2 || count('MID') > 5
    || count('FWD') < 1 || count('FWD') > 3
    || planner.bench[0]?.position !== 'GK'
  ) fail('Planner selection is not a valid FPL formation with a goalkeeper-first bench')
  return planner
}

export function swapPlannerPlayers(
  planner: PlannerLineup,
  firstPlayerId: string,
  secondPlayerId: string,
): PlannerLineup {
  if (firstPlayerId === secondPlayerId) return planner
  const starters = [...planner.starters]
  const bench = [...planner.bench]
  const firstStarter = starters.findIndex(({ id }) => id === firstPlayerId)
  const secondStarter = starters.findIndex(({ id }) => id === secondPlayerId)
  const firstBench = bench.findIndex(({ id }) => id === firstPlayerId)
  const secondBench = bench.findIndex(({ id }) => id === secondPlayerId)
  if (firstStarter < 0 && firstBench < 0) fail(`Planner player ${firstPlayerId} is missing`)
  if (secondStarter < 0 && secondBench < 0) fail(`Planner player ${secondPlayerId} is missing`)

  if (firstStarter >= 0 && secondBench >= 0) {
    ;[starters[firstStarter], bench[secondBench]] = [bench[secondBench], starters[firstStarter]]
  } else if (secondStarter >= 0 && firstBench >= 0) {
    ;[starters[secondStarter], bench[firstBench]] = [bench[firstBench], starters[secondStarter]]
  } else if (firstBench >= 0 && secondBench >= 0) {
    ;[bench[firstBench], bench[secondBench]] = [bench[secondBench], bench[firstBench]]
  } else {
    ;[starters[firstStarter], starters[secondStarter]] = [starters[secondStarter], starters[firstStarter]]
  }
  const next = Object.freeze({
    ...planner,
    starters: Object.freeze(starters.map((player, index) => Object.freeze({
      ...player, role: 'STARTER' as const, lineupPosition: index + 1, benchOrder: null,
    }))),
    bench: Object.freeze(bench.map((player, index) => Object.freeze({
      ...player, role: 'BENCH' as const, lineupPosition: index + 12, benchOrder: index + 1,
    }))),
    formation: deriveFormation(starters),
  })
  return validatePlannerLineup(next)
}
