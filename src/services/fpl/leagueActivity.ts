import type { FetchImplementation } from './client.ts'
import { FplDataError } from './errors.ts'
import { retrieveOfficialJson } from './requestJson.ts'
import { isRecord, readArray } from './schema.ts'

export type FplDraftLeagueActivityKind = 'transactions' | 'trades'

export interface FplDraftLeagueActivityAvailability {
  readonly leagueId: number
  readonly kind: FplDraftLeagueActivityKind
  readonly recordCount: number
}

export function getFplDraftLeagueActivityEndpoint(
  leagueId: number,
  kind: FplDraftLeagueActivityKind,
): string {
  if (!Number.isSafeInteger(leagueId) || leagueId <= 0) {
    throw new FplDataError('MISSING_REQUIRED_MAPPING', 'FPL Draft league ID must be a positive integer')
  }
  return `https://draft.premierleague.com/api/draft/league/${leagueId}/${kind}`
}

export function normalizeFplDraftLeagueActivityAvailability(
  rawActivity: unknown,
  leagueId: number,
  kind: FplDraftLeagueActivityKind,
): FplDraftLeagueActivityAvailability {
  getFplDraftLeagueActivityEndpoint(leagueId, kind)
  if (!isRecord(rawActivity)) {
    throw new FplDataError('UNEXPECTED_SCHEMA', `FPL Draft ${kind} response must be an object`)
  }
  return Object.freeze({
    leagueId,
    kind,
    recordCount: readArray(rawActivity, kind, kind).length,
  })
}

export async function retrieveFplDraftLeagueActivityAvailability(
  leagueId: number,
  kind: FplDraftLeagueActivityKind,
  fetchImplementation: FetchImplementation = fetch,
): Promise<FplDraftLeagueActivityAvailability> {
  const endpoint = getFplDraftLeagueActivityEndpoint(leagueId, kind)
  const raw = await retrieveOfficialJson(endpoint, `FPL Draft league ${kind}`, fetchImplementation)
  return normalizeFplDraftLeagueActivityAvailability(raw, leagueId, kind)
}
