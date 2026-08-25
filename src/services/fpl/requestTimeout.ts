export const OFFICIAL_FPL_REQUEST_TIMEOUT_MS = 12_000
export const BROWSER_FPL_REQUEST_TIMEOUT_MS = 10_000

export class FplRequestTimeoutError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'FplRequestTimeoutError'
  }
}

export async function fetchWithTimeout(
  fetchImplementation: typeof fetch,
  input: string | URL | Request,
  init: RequestInit,
  timeoutMs: number,
  timeoutMessage: string,
): Promise<Response> {
  const controller = new AbortController()
  let timer: ReturnType<typeof setTimeout> | null = null
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort()
      reject(new FplRequestTimeoutError(timeoutMessage))
    }, timeoutMs)
  })

  try {
    return await Promise.race([
      fetchImplementation(input, { ...init, signal: controller.signal }),
      timeout,
    ])
  } finally {
    if (timer !== null) clearTimeout(timer)
  }
}

export async function resolveWithTimeout<T>(
  request: Promise<T>,
  timeoutMs: number,
  timeoutMessage: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new FplRequestTimeoutError(timeoutMessage)), timeoutMs)
  })

  try {
    return await Promise.race([request, timeout])
  } finally {
    if (timer !== null) clearTimeout(timer)
  }
}
