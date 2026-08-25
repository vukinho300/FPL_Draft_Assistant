import type { FplPlayerDataResponse } from './contract.ts'
import { FplDataError } from './errors.ts'
import { normalizeFplBootstrap } from './normalize.ts'
import { fetchWithTimeout, OFFICIAL_FPL_REQUEST_TIMEOUT_MS } from './requestTimeout.ts'

export const FPL_DRAFT_BOOTSTRAP_ENDPOINT =
  'https://draft.premierleague.com/api/bootstrap-static'

export type FetchImplementation = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>

export interface RetrieveFplPlayerDataOptions {
  fetchImplementation?: FetchImplementation
  now?: () => Date
  requestTimeoutMs?: number
}

export async function retrieveFplPlayerData(
  options: RetrieveFplPlayerDataOptions = {},
): Promise<FplPlayerDataResponse> {
  const fetchImplementation = options.fetchImplementation ?? fetch
  const now = options.now ?? (() => new Date())
  const requestTimeoutMs = options.requestTimeoutMs ?? OFFICIAL_FPL_REQUEST_TIMEOUT_MS
  let response: Response

  try {
    response = await fetchWithTimeout(
      fetchImplementation,
      FPL_DRAFT_BOOTSTRAP_ENDPOINT,
      { headers: { accept: 'application/json' } },
      requestTimeoutMs,
      'FPL Draft bootstrap endpoint timed out',
    )
  } catch (error) {
    throw new FplDataError('NETWORK_ERROR', 'Unable to reach the FPL Draft endpoint', {
      cause: error,
    })
  }

  if (!response.ok) {
    throw new FplDataError(
      'UPSTREAM_HTTP_ERROR',
      `FPL Draft endpoint returned HTTP ${response.status}`,
    )
  }

  const contentType = response.headers.get('content-type')?.toLowerCase()
  if (contentType === undefined || !contentType.includes('application/json')) {
    throw new FplDataError(
      'UNEXPECTED_CONTENT_TYPE',
      `FPL Draft endpoint returned ${contentType ?? 'no content type'}`,
    )
  }

  let rawBootstrap: unknown
  try {
    rawBootstrap = await response.json()
  } catch (error) {
    throw new FplDataError('INVALID_JSON', 'FPL Draft endpoint returned invalid JSON', {
      cause: error,
    })
  }

  const players = normalizeFplBootstrap(rawBootstrap)

  return {
    retrievedAt: now().toISOString(),
    playerCount: players.length,
    players,
  }
}
