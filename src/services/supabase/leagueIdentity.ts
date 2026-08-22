/**
 * Non-secret identifiers used only to translate the future team-name login UX
 * into Supabase Auth's internal email/password credential shape.
 */
export const LEAGUE_TEAM_LOGIN_IDENTITIES = Object.freeze([
  { teamName: 'Jakin Goff', teamSlug: 'jakin-goff' },
  { teamName: 'Dindi', teamSlug: 'dindi' },
  { teamName: '22nd oBlock', teamSlug: '22nd-oblock' },
  { teamName: 'Miku007', teamSlug: 'miku007' },
  { teamName: 'Rod Wave Disciples', teamSlug: 'rod-wave-disciples' },
  { teamName: 'Tintilinic', teamSlug: 'tintilinic' },
] as const)

export function internalLoginEmail(teamSlug: string): string {
  return `${teamSlug}@auth.kile-n-others.invalid`
}

function normalizedTeamName(teamName: string): string {
  return teamName.trim().toLocaleLowerCase('en-US')
}

/** Resolves a visible team name without making the internal Auth email a UI contract. */
export function resolveTeamLoginEmail(teamName: string): string {
  const normalized = normalizedTeamName(teamName)
  const identity = LEAGUE_TEAM_LOGIN_IDENTITIES.find(
    (candidate) => normalizedTeamName(candidate.teamName) === normalized,
  )
  if (identity === undefined) {
    throw new Error('Unknown league team')
  }
  return internalLoginEmail(identity.teamSlug)
}
