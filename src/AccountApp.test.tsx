// @vitest-environment jsdom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { AuthSessionState } from './services/supabase/authSession.ts'

const mocks = vi.hoisted(() => ({
  getService: vi.fn(),
  getClient: vi.fn(),
  signInWithTeamName: vi.fn(),
  signOut: vi.fn(),
  initialize: vi.fn(),
  subscribe: vi.fn(),
  getState: vi.fn(),
  from: vi.fn(),
}))

vi.mock('./services/supabase/index.ts', () => ({
  getSupabaseAuthSessionService: mocks.getService,
  getSupabaseBrowserClient: mocks.getClient,
  LEAGUE_TEAM_LOGIN_IDENTITIES: [
    { teamSlug: 'jakin-goff', teamName: 'Jakin Goff' },
    { teamSlug: 'dindi', teamName: 'Dindi' },
    { teamSlug: '22nd-oblock', teamName: '22nd oBlock' },
    { teamSlug: 'miku007', teamName: 'Miku007' },
    { teamSlug: 'rod-wave-disciples', teamName: 'Rod Wave Disciples' },
    { teamSlug: 'tintilinic', teamName: 'Tintilinic' },
  ],
}))

vi.mock('./LeagueDashboard.tsx', () => ({
  default: ({ currentManagerName }: { readonly currentManagerName?: string }) => (
    <div data-testid="league-dashboard">Dashboard for {currentManagerName}</div>
  ),
}))

import AccountApp from './AccountApp.tsx'

type AccountRow = {
  readonly id: string
  readonly auth_user_id: string
  readonly team_name: string
  readonly manager_name: string
  readonly role: 'MEMBER' | 'LEAGUE_OWNER'
}

const roots: { root: Root; container: HTMLDivElement }[] = []

function sessionState(status: AuthSessionState['status'], userId = 'auth-user'): AuthSessionState {
  return {
    status,
    error: null,
    session: status === 'AUTHENTICATED'
      ? ({ user: { id: userId } } as AuthSessionState['session'])
      : null,
  }
}

function setAccountResponse(response: { readonly data: AccountRow | null; readonly error: unknown | null }) {
  mocks.from.mockReturnValue({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue(response),
      }),
    }),
  })
}

function configure(state: AuthSessionState, response: { readonly data: AccountRow | null; readonly error: unknown | null } = { data: null, error: null }) {
  mocks.getState.mockReturnValue(state)
  mocks.initialize.mockResolvedValue(state)
  mocks.subscribe.mockImplementation((listener: (next: AuthSessionState) => void) => {
    listener(state)
    return vi.fn()
  })
  mocks.getService.mockReturnValue({
    getState: mocks.getState,
    initialize: mocks.initialize,
    subscribe: mocks.subscribe,
    signInWithTeamName: mocks.signInWithTeamName,
    signOut: mocks.signOut,
  })
  setAccountResponse(response)
  mocks.getClient.mockReturnValue({ from: mocks.from })
}

async function renderApp() {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  await act(async () => root.render(<AccountApp />))
  roots.push({ root, container })
  return container
}

async function settle() {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })
}

beforeEach(() => {
  ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  vi.clearAllMocks()
  mocks.signInWithTeamName.mockResolvedValue(sessionState('UNAUTHENTICATED'))
  mocks.signOut.mockResolvedValue(sessionState('UNAUTHENTICATED'))
})

afterEach(() => {
  roots.splice(0).forEach(({ root, container }) => {
    act(() => root.unmount())
    container.remove()
  })
})

describe('AccountApp', () => {
  it('keeps the application closed while the persisted session is initializing', async () => {
    configure(sessionState('INITIALIZING'))
    const container = await renderApp()

    expect(container.textContent).toContain('Opening Kile N Others…')
    expect(container.querySelector('form')).toBeNull()
    expect(container.querySelector('[data-testid="league-dashboard"]')).toBeNull()
  })

  it('renders the six-team login form only when unauthenticated and clears a failed password submission', async () => {
    configure(sessionState('UNAUTHENTICATED'))
    const container = await renderApp()
    const password = container.querySelector<HTMLInputElement>('input[type="password"]')
    const form = container.querySelector('form')

    expect(container.textContent).toContain('Kile N Others')
    expect(container.querySelectorAll('select option')).toHaveLength(6)
    expect(password).not.toBeNull()
    expect(container.textContent).not.toContain('@auth.kile-n-others.invalid')

    const nativeValueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
    nativeValueSetter?.call(password, 'temporary-local-test-password')
    act(() => password!.dispatchEvent(new Event('change', { bubbles: true })))
    await act(async () => form!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })))

    expect(mocks.signInWithTeamName).toHaveBeenCalledWith('Jakin Goff', 'temporary-local-test-password')
    expect(password!.value).toBe('')
    expect(container.textContent).toContain('Unable to log in. Check your team and password.')
  })

  it('resolves the authenticated Jakin Goff account before mounting the dashboard and derives Commissioner from its database role', async () => {
    configure(sessionState('AUTHENTICATED', 'jakin-auth'))
    let resolveResponse: (response: { readonly data: AccountRow; readonly error: null }) => void = () => undefined
    const response = new Promise<{ readonly data: AccountRow; readonly error: null }>((resolve) => {
      resolveResponse = resolve
    })
    mocks.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({ maybeSingle: vi.fn().mockReturnValue(response) }),
      }),
    })
    const container = await renderApp()

    expect(container.querySelector('[data-testid="league-dashboard"]')).toBeNull()
    resolveResponse({
      data: { id: 'jakin-account', auth_user_id: 'jakin-auth', team_name: 'Jakin Goff', manager_name: 'Vuk', role: 'LEAGUE_OWNER' },
      error: null,
    })
    await settle()
    expect(mocks.from).toHaveBeenCalledWith('league_accounts')
    expect(container.querySelector('[data-testid="league-dashboard"]')?.textContent).toContain('Vuk')
    expect(container.textContent).toContain('Jakin Goff · Commissioner')
  })

  it('uses the resolved member identity without treating a member as Commissioner', async () => {
    configure(sessionState('AUTHENTICATED', 'dindi-auth'), {
      data: { id: 'dindi-account', auth_user_id: 'dindi-auth', team_name: 'Dindi', manager_name: 'Kristian', role: 'MEMBER' },
      error: null,
    })
    const container = await renderApp()
    await settle()

    expect(container.querySelector('[data-testid="league-dashboard"]')?.textContent).toContain('Kristian')
    expect(container.textContent).toContain('Dindi')
    expect(container.textContent).not.toContain('Commissioner')
  })

  it('fails closed for an authenticated user without a league account mapping', async () => {
    configure(sessionState('AUTHENTICATED', 'unbound-auth'))
    const container = await renderApp()
    await settle()

    expect(container.textContent).toContain('Account setup required')
    expect(container.querySelector('[data-testid="league-dashboard"]')).toBeNull()
  })

  it('uses the real sign-out service from the desktop account surface', async () => {
    configure(sessionState('AUTHENTICATED', 'jakin-auth'), {
      data: { id: 'jakin-account', auth_user_id: 'jakin-auth', team_name: 'Jakin Goff', manager_name: 'Vuk', role: 'LEAGUE_OWNER' },
      error: null,
    })
    const container = await renderApp()
    await settle()
    const logout = [...container.querySelectorAll('button')].find((button) => button.textContent === 'Log out')

    act(() => logout!.dispatchEvent(new MouseEvent('click', { bubbles: true })))
    expect(mocks.signOut).toHaveBeenCalledTimes(1)
  })

  it('shows configuration required instead of crashing when the browser Supabase boundary rejects configuration', async () => {
    mocks.getService.mockImplementation(() => { throw new Error('missing configuration') })
    const container = await renderApp()

    expect(container.textContent).toContain('Configuration required')
    expect(container.querySelector('[data-testid="league-dashboard"]')).toBeNull()
  })
})
