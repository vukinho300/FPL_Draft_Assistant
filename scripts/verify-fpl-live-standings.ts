import { retrieveKileNOthersLiveLeagueState } from '../src/services/fpl/liveLeagueState.ts'

const { snapshot, eventStatus } = await retrieveKileNOthersLiveLeagueState()
const standings = snapshot.standings.status === 'AVAILABLE'
  ? snapshot.standings.rows.map((row) => ({
      teamName: row.teamName,
      officialEntryId: row.officialEntryId,
      liveGameweekScore: row.liveGameweekScore,
      baselineSeasonTotal: row.baselineSeasonTotal,
      liveSeasonTotal: row.liveSeasonTotal,
      liveRank: row.liveRank,
      isTied: row.isTied,
      gapToAbove: row.gapToAbove,
      gapToBelow: row.gapToBelow,
      officialEventTotal: row.officialComparison.eventTotal,
      officialSeasonTotal: row.officialComparison.seasonTotal,
      officialValuesCurrentlyMatch: row.officialComparison.valuesCurrentlyMatch,
    }))
  : snapshot.standings

console.log(JSON.stringify({
  verifiedAt: new Date().toISOString(),
  leagueId: snapshot.leagueId,
  eventId: snapshot.eventId,
  gameweekState: snapshot.gameweekState,
  calculationStatus: snapshot.calculationStatus,
  reconciliationStatus: snapshot.reconciliationStatus,
  baseline: snapshot.seasonBaseline.status === 'AVAILABLE'
    ? {
        status: snapshot.seasonBaseline.status,
        provenance: snapshot.seasonBaseline.provenance,
        entries: snapshot.seasonBaseline.entries,
      }
    : snapshot.seasonBaseline,
  teamScores: snapshot.teamScores.map(({ teamName, officialEntryId, liveGameweekScore }) => ({
    teamName, officialEntryId, liveGameweekScore,
  })),
  standings,
  eventStatus,
  freshness: snapshot.freshness,
}, null, 2))
