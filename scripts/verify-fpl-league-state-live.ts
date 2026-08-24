import { officialLeagueIdentity202627 } from '../src/data/leagues/kile-n-others/officialLeagueIdentity2026-27.ts'
import { verifyOfficialLeagueIdentity } from '../src/data/leagues/kile-n-others/officialLeagueIdentity.ts'
import {
  deriveFplDraftGameweekState,
  retrieveFplDraftChoices,
  retrieveFplDraftEntryEventLineup,
  retrieveFplDraftEntryHistory,
  retrieveFplDraftEventSchedule,
  retrieveFplDraftEventStatus,
  retrieveFplDraftFixtures,
  retrieveFplDraftGame,
  retrieveFplDraftLeagueActivityAvailability,
  retrieveFplDraftLeagueDetails,
  retrieveFplDraftLeagueElementStatuses,
  retrieveFplDraftLiveEvent,
  retrieveFplPlayerData,
  verifyFplDraftLeagueState,
  type FetchImplementation,
} from '../src/services/fpl/index.ts'

interface ObservedHeaders {
  readonly age: string | null
  readonly cacheControl: string | null
}

const observedHeaders = new Map<string, ObservedHeaders>()
const observingFetch: FetchImplementation = async (input, init) => {
  const response = await fetch(input, init)
  observedHeaders.set(String(input), {
    age: response.headers.get('age'),
    cacheControl: response.headers.get('cache-control'),
  })
  return response
}

const leagueId = officialLeagueIdentity202627.leagueId
const [
  playerData,
  game,
  schedule,
  eventStatus,
  details,
  choices,
  elementStatuses,
  transactions,
  trades,
] = await Promise.all([
  retrieveFplPlayerData({ fetchImplementation: observingFetch }),
  retrieveFplDraftGame(observingFetch),
  retrieveFplDraftEventSchedule(observingFetch),
  retrieveFplDraftEventStatus(observingFetch),
  retrieveFplDraftLeagueDetails(leagueId, { fetchImplementation: observingFetch }),
  retrieveFplDraftChoices(leagueId, observingFetch),
  retrieveFplDraftLeagueElementStatuses(leagueId, observingFetch),
  retrieveFplDraftLeagueActivityAvailability(leagueId, 'transactions', observingFetch),
  retrieveFplDraftLeagueActivityAvailability(leagueId, 'trades', observingFetch),
])

verifyOfficialLeagueIdentity(officialLeagueIdentity202627, details, choices)
if (game.currentEventId === null) throw new Error('Official game response has no current event')
if (schedule.currentEventId !== game.currentEventId) {
  throw new Error('Game and event schedule disagree on the current event')
}
const currentEvent = schedule.events.find(({ eventId }) => eventId === game.currentEventId)
if (currentEvent === undefined) throw new Error(`Event ${game.currentEventId} is missing from the schedule`)

const [fixtures, liveEvent, lineups, histories] = await Promise.all([
  retrieveFplDraftFixtures(game.currentEventId, observingFetch),
  retrieveFplDraftLiveEvent(game.currentEventId, observingFetch),
  Promise.all(officialLeagueIdentity202627.participants.map(({ officialEntryId }) => (
    retrieveFplDraftEntryEventLineup(officialEntryId, game.currentEventId!, observingFetch)
  ))),
  Promise.all(officialLeagueIdentity202627.participants.map(({ officialEntryId }) => (
    retrieveFplDraftEntryHistory(officialEntryId, observingFetch)
  ))),
])
const verifiedState = verifyFplDraftLeagueState(
  officialLeagueIdentity202627,
  playerData.players,
  lineups,
  liveEvent,
  elementStatuses,
)
const gameweekState = deriveFplDraftGameweekState(game, currentEvent, fixtures)

const livePointsByPlayer = new Map(
  liveEvent.players.map(({ elementId, stats }) => [elementId, stats.totalPoints]),
)
const participantByEntry = new Map(
  officialLeagueIdentity202627.participants.map((identity) => [identity.officialEntryId, identity]),
)
const participantByLeagueEntry = new Map(
  officialLeagueIdentity202627.participants.map((identity) => [identity.officialLeagueEntryId, identity]),
)
const standingByEntry = new Map(details.standings.map((standing) => {
  const identity = participantByLeagueEntry.get(standing.officialLeagueEntryId)
  if (identity === undefined) throw new Error(`Unknown standings entry ${standing.officialLeagueEntryId}`)
  return [identity.officialEntryId, standing]
}))
const lineupEvidence = lineups.map((lineup) => {
  const identity = participantByEntry.get(lineup.officialEntryId)
  if (identity === undefined) throw new Error(`Unknown lineup entry ${lineup.officialEntryId}`)
  const standing = standingByEntry.get(lineup.officialEntryId)
  if (standing === undefined) throw new Error(`Missing standing for entry ${lineup.officialEntryId}`)
  const liveXiTotal = lineup.starters.reduce(
    (total, pick) => total + (livePointsByPlayer.get(pick.elementId) ?? 0) * pick.multiplier,
    0,
  )
  return {
    teamName: identity.teamName,
    officialEntryId: lineup.officialEntryId,
    starters: lineup.starters.length,
    benchPositions: lineup.bench.map(({ position }) => position),
    benchPlayerIds: lineup.bench.map(({ elementId }) => elementId),
    captainFlags: [...lineup.starters, ...lineup.bench]
      .filter(({ isCaptain, isViceCaptain }) => isCaptain || isViceCaptain).length,
    multiplierValues: [...new Set([...lineup.starters, ...lineup.bench].map(({ multiplier }) => multiplier))],
    substitutionCount: lineup.substitutionCount,
    liveXiTotal,
    officialStandingEventTotal: standing.eventTotal,
    standingsMatchesLiveXi: liveXiTotal === standing.eventTotal,
  }
})

const fixtureStatIdentifiers = [...new Set(
  fixtures.flatMap((fixture) => fixture.stats.map(({ identifier }) => identifier)),
)].sort()
const historyEvidence = histories.map((history) => {
  const identity = participantByEntry.get(history.officialEntryId)
  if (identity === undefined) throw new Error(`Unknown history entry ${history.officialEntryId}`)
  return {
    teamName: identity.teamName,
    events: history.records.map(({ eventId }) => eventId),
    latest: history.records.at(-1) ?? null,
  }
})

console.log(JSON.stringify({
  verifiedAt: new Date().toISOString(),
  leagueId,
  currentGameweek: {
    game,
    event: currentEvent,
    derived: gameweekState,
    eventStatus,
  },
  fixtures: {
    count: fixtures.length,
    started: fixtures.filter(({ started }) => started).length,
    live: fixtures.filter(({ started, finished, finishedProvisional }) => (
      started && !finished && !finishedProvisional
    )).length,
    footballComplete: fixtures.filter(({ finished, finishedProvisional }) => (
      finished || finishedProvisional
    )).length,
    statIdentifiers: fixtureStatIdentifiers,
  },
  livePlayers: {
    count: liveEvent.players.length,
    normalizedFields: Object.keys(liveEvent.players[0]?.stats ?? {}),
  },
  lineups: lineupEvidence,
  ownership: {
    playerCount: verifiedState.playerCount,
    available: verifiedState.availablePlayerCount,
    owned: verifiedState.ownedPlayerCount,
    locked: verifiedState.lockedPlayerCount,
    participants: verifiedState.participants,
    inAcceptedTrade: elementStatuses.elements.filter(({ inAcceptedTrade }) => inAcceptedTrade).length,
  },
  standings: details.standings,
  history: historyEvidence,
  activityRoutes: { transactions, trades },
  observedResponseCaching: Object.fromEntries(observedHeaders),
  limitations: {
    liveEventLatencySeconds: null,
    liveEventLatencyReason: 'No real football event occurred during this verifier run.',
    lockedStatusObserved: verifiedState.lockedPlayerCount > 0,
    transactionRecordSchemaObserved: transactions.recordCount > 0,
    tradeRecordSchemaObserved: trades.recordCount > 0,
  },
}, null, 2))
