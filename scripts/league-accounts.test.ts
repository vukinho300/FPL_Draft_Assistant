import { describe, expect, it } from 'vitest'

import {
  INITIAL_LEAGUE_ACCOUNTS,
  internalLoginEmail,
} from './league-accounts.ts'

describe('initial league account registry', () => {
  it('defines exactly the approved six identities with one Jakin Goff league owner', () => {
    expect(INITIAL_LEAGUE_ACCOUNTS).toHaveLength(6)
    expect(INITIAL_LEAGUE_ACCOUNTS.map((account) => account.teamName)).toEqual([
      'Jakin Goff',
      'Dindi',
      '22nd oBlock',
      'Miku007',
      'Rod Wave Disciples',
      'Tintilinic',
    ])
    expect(INITIAL_LEAGUE_ACCOUNTS.filter((account) => account.role === 'LEAGUE_OWNER')).toEqual([
      expect.objectContaining({
        managerName: 'Vuk',
        teamName: 'Jakin Goff',
        teamSlug: 'jakin-goff',
      }),
    ])
    expect(INITIAL_LEAGUE_ACCOUNTS.filter((account) => account.role === 'MEMBER')).toHaveLength(5)
  })

  it('uses deterministic internal-only login identities without embedding credentials', () => {
    expect(INITIAL_LEAGUE_ACCOUNTS.map((account) => internalLoginEmail(account.teamSlug))).toEqual([
      'jakin-goff@auth.kile-n-others.invalid',
      'dindi@auth.kile-n-others.invalid',
      '22nd-oblock@auth.kile-n-others.invalid',
      'miku007@auth.kile-n-others.invalid',
      'rod-wave-disciples@auth.kile-n-others.invalid',
      'tintilinic@auth.kile-n-others.invalid',
    ])
    expect(INITIAL_LEAGUE_ACCOUNTS.every((account) => (
      account.passwordEnvironmentKey.endsWith('_PASSWORD')
    ))).toBe(true)
  })
})
