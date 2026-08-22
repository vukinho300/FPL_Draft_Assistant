import {
  LEAGUE_TEAM_LOGIN_IDENTITIES,
  internalLoginEmail,
} from '../src/services/supabase/leagueIdentity.ts'

export type LeagueAccountRole = 'MEMBER' | 'LEAGUE_OWNER'

export interface InitialLeagueAccount {
  readonly teamSlug: string
  readonly teamName: string
  readonly managerName: string
  readonly role: LeagueAccountRole
  readonly passwordEnvironmentKey: string
}

/**
 * Public league identity metadata only. Passwords and Auth UUIDs are supplied
 * exclusively at trusted provisioning time.
 */
export const INITIAL_LEAGUE_ACCOUNTS = Object.freeze([
  {
    ...LEAGUE_TEAM_LOGIN_IDENTITIES[0],
    managerName: 'Vuk',
    role: 'LEAGUE_OWNER',
    passwordEnvironmentKey: 'LEAGUE_ACCOUNT_JAKIN_GOFF_PASSWORD',
  },
  {
    ...LEAGUE_TEAM_LOGIN_IDENTITIES[1],
    managerName: 'Kristian',
    role: 'MEMBER',
    passwordEnvironmentKey: 'LEAGUE_ACCOUNT_DINDI_PASSWORD',
  },
  {
    ...LEAGUE_TEAM_LOGIN_IDENTITIES[2],
    managerName: 'Diego',
    role: 'MEMBER',
    passwordEnvironmentKey: 'LEAGUE_ACCOUNT_22ND_OBLOCK_PASSWORD',
  },
  {
    ...LEAGUE_TEAM_LOGIN_IDENTITIES[3],
    managerName: 'Lovro',
    role: 'MEMBER',
    passwordEnvironmentKey: 'LEAGUE_ACCOUNT_MIKU007_PASSWORD',
  },
  {
    ...LEAGUE_TEAM_LOGIN_IDENTITIES[4],
    managerName: 'Deni',
    role: 'MEMBER',
    passwordEnvironmentKey: 'LEAGUE_ACCOUNT_ROD_WAVE_DISCIPLES_PASSWORD',
  },
  {
    ...LEAGUE_TEAM_LOGIN_IDENTITIES[5],
    managerName: 'Tin',
    role: 'MEMBER',
    passwordEnvironmentKey: 'LEAGUE_ACCOUNT_TINTILINIC_PASSWORD',
  },
] as const satisfies readonly InitialLeagueAccount[])

export { internalLoginEmail }
