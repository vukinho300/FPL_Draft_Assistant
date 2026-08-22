export const SUPABASE_BROWSER_ENVIRONMENT_KEYS = Object.freeze([
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_PUBLISHABLE_KEY',
] as const)

export interface SupabaseBrowserEnvironment {
  readonly [key: string]: unknown
  readonly VITE_SUPABASE_URL?: unknown
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: unknown
}

export interface SupabaseBrowserConfig {
  readonly url: string
  readonly publishableKey: string
}

function readRequiredString(
  environment: SupabaseBrowserEnvironment,
  key: keyof SupabaseBrowserEnvironment,
): string {
  const value = environment[key]
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`Missing required browser configuration: ${key}`)
  }
  return value.trim()
}

function readProjectUrl(value: string): string {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new Error('VITE_SUPABASE_URL must be a valid absolute URL')
  }

  const isLocalHttp = url.protocol === 'http:'
    && (url.hostname === '127.0.0.1' || url.hostname === 'localhost')
  if (url.protocol !== 'https:' && !isLocalHttp) {
    throw new Error('VITE_SUPABASE_URL must use HTTPS, except for local development')
  }
  if (url.pathname !== '/' || url.search !== '' || url.hash !== '') {
    throw new Error('VITE_SUPABASE_URL must be the Supabase project origin without a path')
  }

  return url.origin
}

function readPublishableKey(value: string): string {
  if (!value.startsWith('sb_publishable_')) {
    throw new Error('VITE_SUPABASE_PUBLISHABLE_KEY must be a Supabase publishable key')
  }
  return value
}

/** Reads only the public configuration that may safely enter a Vite browser bundle. */
export function readSupabaseBrowserConfig(
  environment: SupabaseBrowserEnvironment,
): SupabaseBrowserConfig {
  return Object.freeze({
    url: readProjectUrl(readRequiredString(environment, 'VITE_SUPABASE_URL')),
    publishableKey: readPublishableKey(
      readRequiredString(environment, 'VITE_SUPABASE_PUBLISHABLE_KEY'),
    ),
  })
}
