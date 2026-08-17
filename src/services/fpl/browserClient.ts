import type { FplPlayerDataResponse } from './contract.ts'

export type BrowserFetchImplementation = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>

export async function loadFplPlayerData(
  fetchImplementation: BrowserFetchImplementation = fetch,
): Promise<FplPlayerDataResponse> {
  const response = await fetchImplementation('/api/fpl', {
    headers: { accept: 'application/json' },
  })
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
