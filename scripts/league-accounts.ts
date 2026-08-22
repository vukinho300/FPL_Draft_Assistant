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
    teamSlug: 'jakin-goff',
    teamName: 'Jakin Goff',
    managerName: 'Vuk',
    role: 'LEAGUE_OWNER',
    passwordEnvironmentKey: 'LEAGUE_ACCOUNT_JAKIN_GOFF_PASSWORD',
  },
  {
    teamSlug: 'dindi',
    teamName: 'Dindi',
    managerName: 'Kristian',
    role: 'MEMBER',
    passwordEnvironmentKey: 'LEAGUE_ACCOUNT_DINDI_PASSWORD',
  },
  {
    teamSlug: '22nd-oblock',
    teamName: '22nd oBlock',
    managerName: 'Diego',
    role: 'MEMBER',
    passwordEnvironmentKey: 'LEAGUE_ACCOUNT_22ND_OBLOCK_PASSWORD',
  },
  {
    teamSlug: 'miku007',
    teamName: 'Miku007',
    managerName: 'Lovro',
    role: 'MEMBER',
    passwordEnvironmentKey: 'LEAGUE_ACCOUNT_MIKU007_PASSWORD',
  },
  {
    teamSlug: 'rod-wave-disciples',
    teamName: 'Rod Wave Disciples',
    managerName: 'Deni',
    role: 'MEMBER',
    passwordEnvironmentKey: 'LEAGUE_ACCOUNT_ROD_WAVE_DISCIPLES_PASSWORD',
  },
  {
    teamSlug: 'tintilinic',
    teamName: 'Tintilinic',
    managerName: 'Tin',
    role: 'MEMBER',
    passwordEnvironmentKey: 'LEAGUE_ACCOUNT_TINTILINIC_PASSWORD',
  },
] as const satisfies readonly InitialLeagueAccount[])

export function internalLoginEmail(teamSlug: string): string {
  return `${teamSlug}@auth.kile-n-others.invalid`
}
