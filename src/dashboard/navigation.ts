export const LEAGUE_NAVIGATION = [
  { id: 'league', label: 'League' },
  { id: 'my-team', label: 'My Team' },
  { id: 'teams', label: 'Teams' },
  { id: 'matchday', label: 'Matchday' },
  { id: 'players', label: 'Players' },
  { id: 'transactions', label: 'Transactions' },
  { id: 'draft-archive', label: 'Draft Archive' },
] as const

export type LeagueView = (typeof LEAGUE_NAVIGATION)[number]['id']

export function getLeagueViewLabel(view: LeagueView): string {
  return LEAGUE_NAVIGATION.find(({ id }) => id === view)?.label ?? 'League'
}
