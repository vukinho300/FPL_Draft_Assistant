import { buildLeagueGameweekExperience } from '../src/domain/gameweekExperience.ts'
import { deriveLiveLeagueFreshness } from '../src/domain/liveLeagueStandings.ts'
import { retrieveFplPlayerData } from '../src/services/fpl/client.ts'
import { retrieveKileNOthersLiveLeagueState } from '../src/services/fpl/liveLeagueState.ts'

const [catalogue, live] = await Promise.all([
  retrieveFplPlayerData(),
  retrieveKileNOthersLiveLeagueState(),
])
const now = new Date()
const refresh = {
  status: 'READY' as const,
  data: live,
  lastSuccessfulAt: now.toISOString(),
  errorMessage: null,
  freshness: deriveLiveLeagueFreshness(
    live.snapshot.freshness.retrievedAt,
    now,
    live.snapshot.freshness.staleAfterMs,
  ),
}
const experience = buildLeagueGameweekExperience(catalogue.players, refresh, now)

console.log(JSON.stringify({
  verifiedAt: now.toISOString(),
  sourceEventId: experience.sourceEventId,
  experienceEventId: experience.eventId,
  mode: experience.mode,
  modeReason: experience.modeReason,
  phase: experience.phase,
  freshness: experience.freshness,
  teams: experience.teams.map((team) => ({
    teamName: team.teamName,
    rosterManagerId: team.rosterManagerId,
    officialEntryId: team.officialEntryId,
    currentRosterCount: team.currentRoster.length,
    officialStarterCount: team.officialLineup.starters.length,
    officialBenchPositions: team.officialLineup.bench.map(({ lineupPosition }) => lineupPosition),
    officialFormation: team.officialLineup.formation,
    liveGameweekScore: team.officialLineup.liveGameweekScore,
  })),
}, null, 2))
