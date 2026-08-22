import { AuthError, type AuthChangeEvent, type Session } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'

import { SupabaseAuthSessionService, type AuthSessionClient } from './authSession.ts'

const session = { user: { id: 'fixture-user' } } as Session

function response<T>(data: T, error: AuthError | null) {
  return { data, error } as never
}

function fixture(storedSession: Session | null = null) {
  let listener: ((event: AuthChangeEvent, value: Session | null) => void) | undefined
  const unsubscribe = vi.fn()
  const client = {
    auth: {
      getSession: vi.fn().mockResolvedValue(response({ session: storedSession }, null)),
      getUser: vi.fn().mockResolvedValue(response({ user: storedSession?.user ?? null }, null)),
      onAuthStateChange: vi.fn((callback) => {
        listener = callback
        return { data: { subscription: { unsubscribe } } }
      }),
      signInWithPassword: vi.fn().mockResolvedValue(response({ session }, null)),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
  } as unknown as AuthSessionClient
  return { client, emit: (event: AuthChangeEvent, value: Session | null) => listener?.(event, value), unsubscribe }
}

describe('SupabaseAuthSessionService', () => {
  it('holds INITIALIZING until startup session resolution completes', async () => {
    let resolve: ((result: never) => void) | undefined
    const pending = new Promise<never>((complete) => { resolve = complete })
    const setup = fixture()
    setup.client.auth.getSession = vi.fn().mockReturnValue(pending) as never
    const service = new SupabaseAuthSessionService(setup.client)
    const initialization = service.initialize()
    expect(service.getState().status).toBe('INITIALIZING')
    resolve?.(response({ session: null }, null))
    await expect(initialization).resolves.toMatchObject({ status: 'UNAUTHENTICATED' })
  })

  it('restores valid sessions and safely resolves invalid or missing sessions', async () => {
    await expect(new SupabaseAuthSessionService(fixture(session).client).initialize()).resolves.toMatchObject({ status: 'AUTHENTICATED' })
    const invalid = fixture()
    invalid.client.auth.getSession = vi.fn().mockResolvedValue(response({ session: null }, new AuthError('invalid session'))) as never
    await expect(new SupabaseAuthSessionService(invalid.client).initialize()).resolves.toMatchObject({ status: 'UNAUTHENTICATED' })
  })

  it('updates one shared state on sign-in, token refresh, and sign-out events', async () => {
    const setup = fixture()
    const service = new SupabaseAuthSessionService(setup.client)
    await service.initialize()
    setup.emit('SIGNED_IN', session)
    expect(service.getState().status).toBe('AUTHENTICATED')
    setup.emit('TOKEN_REFRESHED', session)
    expect(service.getState().status).toBe('AUTHENTICATED')
    setup.emit('SIGNED_OUT', null)
    expect(service.getState().status).toBe('UNAUTHENTICATED')
    await service.initialize()
    expect(setup.client.auth.onAuthStateChange).toHaveBeenCalledTimes(1)
  })

  it('passes a password only to the immediate Supabase request and clears state on sign-out', async () => {
    const setup = fixture()
    const resolver = vi.fn().mockReturnValue('internal@example.invalid')
    const service = new SupabaseAuthSessionService(setup.client, resolver)
    await service.signInWithTeamName('Dindi', 'test-only-immediate-value')
    expect(setup.client.auth.signInWithPassword).toHaveBeenCalledWith({ email: 'internal@example.invalid', password: 'test-only-immediate-value' })
    expect(service.getState()).not.toHaveProperty('password')
    await service.signOut()
    expect(service.getState().status).toBe('UNAUTHENTICATED')
  })

  it('cleans up its auth subscription', async () => {
    const setup = fixture()
    const service = new SupabaseAuthSessionService(setup.client)
    await service.initialize()
    service.dispose()
    expect(setup.unsubscribe).toHaveBeenCalledOnce()
  })
})
