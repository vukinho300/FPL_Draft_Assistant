import { describe, expect, it } from 'vitest'

import { officialDraft202627 } from './officialDraft2026-27.ts'
import {
  KILE_N_OTHERS_ACCOUNT_ROSTER_IDENTITIES,
  resolveLeagueAccountRosterManagerId,
} from './accountRosterIdentity.ts'

describe('Kile N Others account roster identities', () => {
  it('maps every approved account to exactly one immutable draft roster', () => {
    expect(KILE_N_OTHERS_ACCOUNT_ROSTER_IDENTITIES).toHaveLength(6)

    const resolvedIds = KILE_N_OTHERS_ACCOUNT_ROSTER_IDENTITIES.map((identity) => (
      resolveLeagueAccountRosterManagerId(identity.teamName, identity.accountManagerName)
    ))

    expect(resolvedIds).toEqual([
      'demo-manager-1',
      'demo-manager-3',
      'demo-manager-2',
      'demo-manager-4',
      'demo-manager-6',
      'demo-manager-5',
    ])
    expect(new Set(resolvedIds).size).toBe(6)
    expect(resolvedIds.every((id) => officialDraft202627.managers.some((manager) => manager.id === id))).toBe(true)
  })

  it('maps Miku007/Lovro to Miku\'s immutable draft roster rather than falling back to Vuk', () => {
    const managerId = resolveLeagueAccountRosterManagerId('Miku007', 'Lovro')
    const manager = officialDraft202627.managers.find((candidate) => candidate.id === managerId)

    expect(manager).toMatchObject({ id: 'demo-manager-4', displayName: 'Miku' })
    expect(manager?.id).not.toBe(officialDraft202627.managers[0].id)
  })

  it('fails closed for an unknown or inconsistent account identity', () => {
    expect(resolveLeagueAccountRosterManagerId('Miku007', 'Vuk')).toBeNull()
    expect(resolveLeagueAccountRosterManagerId('Unknown Team', 'Lovro')).toBeNull()
  })
})
