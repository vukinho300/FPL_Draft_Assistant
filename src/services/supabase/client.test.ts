import { describe, expect, it } from 'vitest'

import { createSupabaseBrowserClient } from './client.ts'

describe('Supabase browser client boundary', () => {
  it('creates a client from valid public configuration without contacting a remote project', () => {
    const client = createSupabaseBrowserClient({
      VITE_SUPABASE_URL: 'https://project-ref.supabase.co',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_fixture-key',
    })

    expect(client).toBeDefined()
    expect(client.auth).toBeDefined()
  })
})
