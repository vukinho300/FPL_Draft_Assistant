import { describe, expect, it } from 'vitest'

import { KILE_N_OTHERS_ACCOUNT_ROSTER_IDENTITIES } from '../../data/leagues/kile-n-others/accountRosterIdentity.ts'
import {
  assembleLeagueTeamProfiles,
  createFallbackLeagueTeamProfiles,
  getTeamAvatarInitial,
  TEAM_AVATAR_MAX_BYTES,
  validateTeamAvatarFile,
} from './teamProfiles.ts'

const accounts = KILE_N_OTHERS_ACCOUNT_ROSTER_IDENTITIES.map((identity, index) => ({
  id: `account-${index + 1}`,
  team_name: identity.teamName,
  manager_name: identity.accountManagerName,
  role: identity.teamName === 'Jakin Goff' ? 'LEAGUE_OWNER' as const : 'MEMBER' as const,
}))
const rows = accounts.map(({ id }, index) => ({
  account_id: id,
  avatar_path: index === 0 ? `${id}/avatar-version` : null,
}))

describe('team profile model', () => {
  it('maps exactly six database profiles through the approved roster identities', () => {
    const profiles = assembleLeagueTeamProfiles(
      accounts,
      rows,
      new Map([['account-1/avatar-version', 'https://signed.example/avatar']]),
    )

    expect(profiles).toHaveLength(6)
    expect(profiles.map(({ rosterManagerId }) => rosterManagerId)).toEqual(
      KILE_N_OTHERS_ACCOUNT_ROSTER_IDENTITIES.map(({ rosterManagerId }) => rosterManagerId),
    )
    expect(profiles[0]).toMatchObject({
      teamName: 'Jakin Goff',
      managerName: 'Vuk',
      role: 'LEAGUE_OWNER',
      avatarUrl: 'https://signed.example/avatar',
    })
    expect(profiles.filter(({ role }) => role === 'LEAGUE_OWNER')).toHaveLength(1)
  })

  it('fails closed for missing or inconsistent profile identities', () => {
    expect(() => assembleLeagueTeamProfiles(accounts, rows.slice(1), new Map())).toThrow(
      'League profile is missing for Jakin Goff',
    )
    expect(() => assembleLeagueTeamProfiles(
      accounts.map((account) => account.team_name === 'Miku007'
        ? { ...account, manager_name: 'Vuk' }
        : account),
      rows,
      new Map(),
    )).toThrow('League profile identity is inconsistent for Miku007')
  })

  it('uses deterministic team initials without inventing default images', () => {
    expect(getTeamAvatarInitial('Jakin Goff')).toBe('J')
    expect(getTeamAvatarInitial(' Dindi ')).toBe('D')
    expect(getTeamAvatarInitial('22nd oBlock')).toBe('2')
    expect(createFallbackLeagueTeamProfiles().every(({ avatarUrl }) => avatarUrl === null)).toBe(true)
  })

  it('accepts only non-empty JPEG, PNG or WebP images up to 2 MB', () => {
    expect(validateTeamAvatarFile({ type: 'image/png', size: TEAM_AVATAR_MAX_BYTES })).toBeNull()
    expect(validateTeamAvatarFile({ type: 'image/gif', size: 100 })).toContain('JPEG, PNG or WebP')
    expect(validateTeamAvatarFile({ type: 'image/png', size: 0 })).toContain('empty')
    expect(validateTeamAvatarFile({ type: 'image/jpeg', size: TEAM_AVATAR_MAX_BYTES + 1 })).toContain('smaller than 2 MB')
  })
})
