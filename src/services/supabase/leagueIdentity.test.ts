import { describe, expect, it } from 'vitest'

import { LEAGUE_TEAM_LOGIN_IDENTITIES, resolveTeamLoginEmail } from './leagueIdentity.ts'

describe('league team login identity', () => {
  it('uses one approved six-team source and keeps the internal address behind resolution', () => {
    expect(LEAGUE_TEAM_LOGIN_IDENTITIES).toHaveLength(6)
    expect(resolveTeamLoginEmail(' dindi ')).toBe('dindi@auth.kile-n-others.invalid')
  })

  it('rejects unknown teams', () => {
    expect(() => resolveTeamLoginEmail('Unknown')).toThrow('Unknown league team')
  })
})
