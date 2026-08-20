import { describe, expect, it } from 'vitest'

import { getLeagueViewLabel, LEAGUE_NAVIGATION } from './navigation.ts'

describe('league dashboard navigation', () => {
  it('defines the seven shared league destinations once', () => {
    expect(LEAGUE_NAVIGATION).toEqual([
      { id: 'league', label: 'League' },
      { id: 'my-team', label: 'My Team' },
      { id: 'teams', label: 'Teams' },
      { id: 'matchday', label: 'Matchday' },
      { id: 'players', label: 'Players' },
      { id: 'transactions', label: 'Transactions' },
      { id: 'draft-archive', label: 'Draft Archive' },
    ])
    expect(getLeagueViewLabel('draft-archive')).toBe('Draft Archive')
  })
})
