import { officialLeagueIdentity202627 } from '../src/data/leagues/kile-n-others/officialLeagueIdentity2026-27.ts'
import { verifyOfficialLeagueIdentity } from '../src/data/leagues/kile-n-others/officialLeagueIdentity.ts'
import {
  retrieveFplDraftChoices,
  retrieveFplDraftLeagueDetails,
} from '../src/services/fpl/index.ts'

const [details, draftChoices] = await Promise.all([
  retrieveFplDraftLeagueDetails(officialLeagueIdentity202627.leagueId),
  retrieveFplDraftChoices(officialLeagueIdentity202627.leagueId),
])
const verified = verifyOfficialLeagueIdentity(
  officialLeagueIdentity202627,
  details,
  draftChoices,
)

console.log(JSON.stringify({
  verifiedAt: new Date().toISOString(),
  league: {
    id: verified.leagueId,
    officialName: verified.leagueName,
    scoring: details.scoring,
    startEvent: details.startEvent,
    stopEvent: details.stopEvent,
    draftStatus: details.draftStatus,
  },
  contracts: {
    leagueDetails: verified.detailsSourceEndpoint,
    leagueDetailCollections: ['league', 'league_entries', 'standings'],
    entryIdentityFields: [
      'entry_id',
      'id (league-entry ID)',
      'entry_name',
      'player_first_name',
    ],
    standingsFields: ['league_entry', 'rank', 'last_rank', 'rank_sort', 'event_total', 'total'],
    draftChoices: verified.draftChoicesSourceEndpoint,
    draftChoiceFields: ['league', 'entry', 'element', 'index', 'round', 'pick'],
  },
  mappingBasis: verified.mappingBasis,
  officialDraftChoiceCount: draftChoices.choices.length,
  participants: verified.participants.map((identity) => ({
    teamName: identity.teamName,
    accountManagerName: identity.accountManagerName,
    rosterManagerId: identity.rosterManagerId,
    officialEntryId: identity.officialEntryId,
    officialLeagueEntryId: identity.officialLeagueEntryId,
    officialEntryName: identity.officialEntryName,
  })),
}, null, 2))
