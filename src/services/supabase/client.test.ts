import { describe, expect, it } from 'vitest'

import { createSupabaseBrowserClient, SUPABASE_BROWSER_AUTH_OPTIONS } from './client.ts'

describe('Supabase browser client boundary', () => {
  it('creates a client from valid public configuration without contacting a remote project', () => {
    const client = createSupabaseBrowserClient({
      VITE_SUPABASE_URL: 'https://project-ref.supabase.co',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_fixture-key',
    })

    expect(client).toBeDefined()
    expect(client.auth).toBeDefined()
  })

  it('uses Supabase-managed browser persistence and refresh without custom project storage', () => {
    expect(SUPABASE_BROWSER_AUTH_OPTIONS).toEqual({ autoRefreshToken: true, detectSessionInUrl: true, persistSession: true })
    expect(SUPABASE_BROWSER_AUTH_OPTIONS).not.toHaveProperty('storage')
  })
})
