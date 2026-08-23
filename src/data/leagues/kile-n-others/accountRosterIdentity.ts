import type { ManagerId } from '../../../domain/manager.ts'

/**
 * Maps the persistent account registry to the immutable 2026/27 draft manager
 * identifiers. Account manager names are person-facing identities; the draft
 * snapshot uses its own stable manager IDs and, for Lovro, the historic
 * display name "Miku".
 */
export interface LeagueAccountRosterIdentity {
  readonly teamName: string
  readonly accountManagerName: string
  readonly rosterManagerId: ManagerId
}

export const KILE_N_OTHERS_ACCOUNT_ROSTER_IDENTITIES = Object.freeze([
  { teamName: 'Jakin Goff', accountManagerName: 'Vuk', rosterManagerId: 'demo-manager-1' },
  { teamName: 'Dindi', accountManagerName: 'Kristian', rosterManagerId: 'demo-manager-3' },
  { teamName: '22nd oBlock', accountManagerName: 'Diego', rosterManagerId: 'demo-manager-2' },
  { teamName: 'Miku007', accountManagerName: 'Lovro', rosterManagerId: 'demo-manager-4' },
  { teamName: 'Rod Wave Disciples', accountManagerName: 'Deni', rosterManagerId: 'demo-manager-6' },
  { teamName: 'Tintilinic', accountManagerName: 'Tin', rosterManagerId: 'demo-manager-5' },
] as const satisfies readonly LeagueAccountRosterIdentity[])

function normalizeIdentity(value: string): string {
  return value.trim().toLocaleLowerCase('en-US')
}

/**
 * Fails closed when a database account row is not one of the six approved
 * account-to-roster identities. This prevents a missing match from falling
 * back to the first (Jakin/Vuk) roster.
 */
export function resolveLeagueAccountRosterManagerId(
  teamName: string,
  accountManagerName: string,
): ManagerId | null {
  const identity = KILE_N_OTHERS_ACCOUNT_ROSTER_IDENTITIES.find((candidate) => (
    normalizeIdentity(candidate.teamName) === normalizeIdentity(teamName)
    && normalizeIdentity(candidate.accountManagerName) === normalizeIdentity(accountManagerName)
  ))

  return identity?.rosterManagerId ?? null
}
