import rawIdentity from './officialLeagueIdentity2026-27.json' with { type: 'json' }

import {
  validateOfficialLeagueIdentityEvidence,
  type OfficialLeagueIdentityEvidence,
} from './officialLeagueIdentity.ts'

/**
 * Verified public official FPL Draft integration identity. This does not replace
 * either Supabase account identity or immutable project roster identity.
 * Mapping is proven by each entry's exact 15-player official draft-choice set.
 */
export const officialLeagueIdentity202627 = validateOfficialLeagueIdentityEvidence(
  rawIdentity as OfficialLeagueIdentityEvidence,
)
