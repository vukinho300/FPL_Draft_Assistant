import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'

import type { Database } from './database.types.ts'
import { hasFantacalcioAccess } from './fantacalcioAccess.ts'

function clientWithResult(result: { data: { auth_user_id: string } | null; error: { message: string } | null }) {
  const maybeSingle = vi.fn().mockResolvedValue(result)
  const eq = vi.fn().mockReturnValue({ maybeSingle })
  const select = vi.fn().mockReturnValue({ eq })
  const from = vi.fn().mockReturnValue({ select })
  return { client: { from } as unknown as SupabaseClient<Database>, from, select, eq }
}

describe('Fantacalcio access lookup', () => {
  it('accepts only a successful grant for the signed-in Auth user ID', async () => {
    const own = clientWithResult({ data: { auth_user_id: 'vuk-auth' }, error: null })
    expect(await hasFantacalcioAccess('vuk-auth', own.client)).toBe(true)
    expect(own.from).toHaveBeenCalledWith('fantacalcio_access')
    expect(own.eq).toHaveBeenCalledWith('auth_user_id', 'vuk-auth')

    const another = clientWithResult({ data: { auth_user_id: 'other-auth' }, error: null })
    expect(await hasFantacalcioAccess('vuk-auth', another.client)).toBe(false)
  })

  it('fails closed for absent grants and database errors', async () => {
    expect(await hasFantacalcioAccess('member-auth', clientWithResult({ data: null, error: null }).client)).toBe(false)
    expect(await hasFantacalcioAccess('vuk-auth', clientWithResult({ data: null, error: { message: 'RLS unavailable' } }).client)).toBe(false)
  })
})
