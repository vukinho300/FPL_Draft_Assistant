import { describe, expect, it } from 'vitest'

import {
  getFplDraftLeagueActivityEndpoint,
  normalizeFplDraftLeagueActivityAvailability,
} from './leagueActivity.ts'

describe('FPL Draft league activity route availability', () => {
  it('normalizes only the verified collection availability and count', () => {
    expect(normalizeFplDraftLeagueActivityAvailability(
      { transactions: [] },
      45938,
      'transactions',
    )).toEqual({ leagueId: 45938, kind: 'transactions', recordCount: 0 })
    expect(normalizeFplDraftLeagueActivityAvailability(
      { trades: [{ unverified_shape: true }] },
      45938,
      'trades',
    )).toEqual({ leagueId: 45938, kind: 'trades', recordCount: 1 })
  })

  it('uses the observed read-only Draft league routes', () => {
    expect(getFplDraftLeagueActivityEndpoint(45938, 'transactions')).toBe(
      'https://draft.premierleague.com/api/draft/league/45938/transactions',
    )
    expect(getFplDraftLeagueActivityEndpoint(45938, 'trades')).toBe(
      'https://draft.premierleague.com/api/draft/league/45938/trades',
    )
  })
})
