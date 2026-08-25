import type { FplPlayerDataResponse } from './contract.ts'
import {
  BROWSER_FPL_REQUEST_TIMEOUT_MS,
  fetchWithTimeout,
  FplRequestTimeoutError,
} from './requestTimeout.ts'

export type BrowserFetchImplementation = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>

export async function loadFplPlayerData(
  fetchImplementation: BrowserFetchImplementation = fetch,
  timeoutMs: number = BROWSER_FPL_REQUEST_TIMEOUT_MS,
): Promise<FplPlayerDataResponse> {
  let response: Response
  try {
    response = await fetchWithTimeout(
      fetchImplementation,
      '/api/fpl',
      { headers: { accept: 'application/json' } },
      timeoutMs,
      'Player directory request timed out',
    )
  } catch (error) {
    if (error instanceof FplRequestTimeoutError) {
      throw new Error('Player directory took too long to load. Try again.', { cause: error })
    }
    throw new Error('Player directory is unavailable. Try again.', { cause: error })
  }
  if (!response.ok) {
    let message = 'Current FPL Draft player data is unavailable'
    try {
      const body = (await response.json()) as { error?: { message?: unknown } }
      if (typeof body.error?.message === 'string') message = body.error.message
    } catch {
      // Keep the controlled project message when the error response is malformed.
    }
    throw new Error(message)
  }
  const body = (await response.json()) as Partial<FplPlayerDataResponse>
  if (
    typeof body.retrievedAt !== 'string' ||
    !Number.isInteger(body.playerCount) ||
    !Array.isArray(body.players) ||
    body.playerCount !== body.players.length
  ) {
    throw new Error('The FPL player response did not match the project contract')
  }
  return body as FplPlayerDataResponse
}
