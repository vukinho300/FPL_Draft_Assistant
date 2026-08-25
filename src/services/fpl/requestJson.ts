import type { FetchImplementation } from './client.ts'
import { FplDataError } from './errors.ts'
import { fetchWithTimeout, OFFICIAL_FPL_REQUEST_TIMEOUT_MS } from './requestTimeout.ts'

export async function retrieveOfficialJson(
  endpoint: string,
  label: string,
  fetchImplementation: FetchImplementation = fetch,
  timeoutMs: number = OFFICIAL_FPL_REQUEST_TIMEOUT_MS,
): Promise<unknown> {
  let response: Response
  try {
    response = await fetchWithTimeout(
      fetchImplementation,
      endpoint,
      { headers: { accept: 'application/json' } },
      timeoutMs,
      `${label} endpoint timed out`,
    )
  } catch (error) {
    throw new FplDataError('NETWORK_ERROR', `Unable to reach the ${label} endpoint`, { cause: error })
  }

  if (!response.ok) {
    throw new FplDataError('UPSTREAM_HTTP_ERROR', `${label} endpoint returned HTTP ${response.status}`)
  }
  const contentType = response.headers.get('content-type')?.toLowerCase()
  if (contentType === undefined || !contentType.includes('application/json')) {
    throw new FplDataError(
      'UNEXPECTED_CONTENT_TYPE',
      `${label} endpoint returned ${contentType ?? 'no content type'}`,
    )
  }

  try {
    return await response.json()
  } catch (error) {
    throw new FplDataError('INVALID_JSON', `${label} endpoint returned invalid JSON`, { cause: error })
  }
}
