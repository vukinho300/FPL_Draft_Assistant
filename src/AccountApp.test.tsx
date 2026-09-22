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
  hasFantacalcioAccess: vi.fn(),
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
  default: ({ currentManagerId }: { readonly currentManagerId?: string }) => (
    <div data-testid="league-dashboard">Dashboard for {currentManagerId}</div>
  ),
}))

vi.mock('./fantacalcio/FantacalcioShell.tsx', () => ({
  FantacalcioShell: ({ onReturnToFpl }: { readonly onReturnToFpl: () => void }) => (
    <section><h1 id="fantacalcio-title">Your auction space is ready.</h1><button type="button" onClick={onReturnToFpl}>Return to FPL Draft</button></section>
  ),
}))

vi.mock('./services/supabase/fantacalcioAccess.ts', () => ({
  hasFantacalcioAccess: mocks.hasFantacalcioAccess,
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
  mocks.hasFantacalcioAccess.mockResolvedValue(false)
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
    expect(container.querySelector('[data-testid="league-dashboard"]')?.textContent).toContain('demo-manager-1')
    expect(container.textContent).toContain('Jakin Goff · Commissioner')
  })

  it('uses the resolved member identity without treating a member as Commissioner', async () => {
    configure(sessionState('AUTHENTICATED', 'dindi-auth'), {
      data: { id: 'dindi-account', auth_user_id: 'dindi-auth', team_name: 'Dindi', manager_name: 'Kristian', role: 'MEMBER' },
      error: null,
    })
    const container = await renderApp()
    await settle()

    expect(container.querySelector('[data-testid="league-dashboard"]')?.textContent).toContain('demo-manager-3')
    expect(container.textContent).toContain('Dindi')
    expect(container.textContent).not.toContain('Commissioner')
    expect(container.textContent).not.toContain('Fantacalcio')
  })

  it('lets an explicitly authorized Vuk switch products and return to the same FPL roster', async () => {
    mocks.hasFantacalcioAccess.mockResolvedValue(true)
    configure(sessionState('AUTHENTICATED', 'jakin-auth'), {
      data: { id: 'jakin-account', auth_user_id: 'jakin-auth', team_name: 'Jakin Goff', manager_name: 'Vuk', role: 'LEAGUE_OWNER' },
      error: null,
    })
    const container = await renderApp()
    await settle()

    expect(mocks.hasFantacalcioAccess).toHaveBeenCalledWith('jakin-auth')
    expect(container.querySelector('[data-testid="league-dashboard"]')?.textContent).toContain('demo-manager-1')
    const entry = [...container.querySelectorAll('button')].find((button) => button.textContent === 'Fantacalcio')
    expect(entry).not.toBeUndefined()
    act(() => entry!.dispatchEvent(new MouseEvent('click', { bubbles: true })))
    expect(container.querySelector('[data-testid="league-dashboard"]')).toBeNull()
    expect(container.querySelector('#fantacalcio-title')?.textContent).toContain('auction space')
    expect(container.textContent).not.toContain('500 credits')

    const returnButton = [...container.querySelectorAll('button')].find((button) => button.textContent === 'Return to FPL Draft')
    act(() => returnButton!.dispatchEvent(new MouseEvent('click', { bubbles: true })))
    expect(container.querySelector('[data-testid="league-dashboard"]')?.textContent).toContain('demo-manager-1')
  })

  it('does not use an FPL roster identity as the Fantacalcio capability', async () => {
    mocks.hasFantacalcioAccess.mockResolvedValue(true)
    configure(sessionState('AUTHENTICATED', 'verified-auth'), {
      data: { id: 'account', auth_user_id: 'verified-auth', team_name: 'Miku007', manager_name: 'Vuk', role: 'MEMBER' },
      error: null,
    })
    const container = await renderApp()
    await settle()

    expect(container.textContent).toContain('Account setup required')
    const entry = [...container.querySelectorAll('button')].find((button) => button.textContent === 'Fantacalcio')
    act(() => entry!.dispatchEvent(new MouseEvent('click', { bubbles: true })))
    expect(container.querySelector('#fantacalcio-title')).not.toBeNull()
    expect(container.querySelector('[data-testid="league-dashboard"]')).toBeNull()
  })

  it('can enter Fantacalcio with an explicit grant even if no FPL account row resolves', async () => {
    mocks.hasFantacalcioAccess.mockResolvedValue(true)
    configure(sessionState('AUTHENTICATED', 'fantacalcio-auth'))
    const container = await renderApp()
    await settle()

    expect(container.textContent).toContain('Account setup required')
    const entry = [...container.querySelectorAll('button')].find((button) => button.textContent === 'Fantacalcio')
    act(() => entry!.dispatchEvent(new MouseEvent('click', { bubbles: true })))
    expect(container.querySelector('#fantacalcio-title')).not.toBeNull()
  })

  it('removes Fantacalcio immediately when the signed-in Auth user changes', async () => {
    let emitSession: ((state: AuthSessionState) => void) | undefined
    mocks.hasFantacalcioAccess.mockImplementation((userId: string) => Promise.resolve(userId === 'jakin-auth'))
    configure(sessionState('AUTHENTICATED', 'jakin-auth'), {
      data: { id: 'jakin-account', auth_user_id: 'jakin-auth', team_name: 'Jakin Goff', manager_name: 'Vuk', role: 'LEAGUE_OWNER' },
      error: null,
    })
    mocks.subscribe.mockImplementation((listener: (state: AuthSessionState) => void) => {
      emitSession = listener
      listener(sessionState('AUTHENTICATED', 'jakin-auth'))
      return vi.fn()
    })
    const container = await renderApp()
    await settle()
    const entry = [...container.querySelectorAll('button')].find((button) => button.textContent === 'Fantacalcio')
    act(() => entry!.dispatchEvent(new MouseEvent('click', { bubbles: true })))
    expect(container.querySelector('#fantacalcio-title')).not.toBeNull()

    act(() => emitSession?.(sessionState('AUTHENTICATED', 'dindi-auth')))
    expect(container.querySelector('#fantacalcio-title')).toBeNull()
    expect(container.textContent).not.toContain('Fantacalcio')
  })

  it('fails closed for an authenticated user without a league account mapping', async () => {
    configure(sessionState('AUTHENTICATED', 'unbound-auth'))
    const container = await renderApp()
    await settle()

    expect(container.textContent).toContain('Account setup required')
    expect(container.querySelector('[data-testid="league-dashboard"]')).toBeNull()
  })

  it('maps Miku007/Lovro to the Miku draft roster rather than Jakin Goff', async () => {
    configure(sessionState('AUTHENTICATED', 'miku-auth'), {
      data: { id: 'miku-account', auth_user_id: 'miku-auth', team_name: 'Miku007', manager_name: 'Lovro', role: 'MEMBER' },
      error: null,
    })
    const container = await renderApp()
    await settle()

    expect(container.querySelector('[data-testid="league-dashboard"]')?.textContent).toContain('demo-manager-4')
    expect(container.querySelector('[data-testid="league-dashboard"]')?.textContent).not.toContain('demo-manager-1')
    expect(container.textContent).not.toContain('Commissioner')
  })

  it('fails closed when a database account does not match an approved roster identity', async () => {
    configure(sessionState('AUTHENTICATED', 'mismatch-auth'), {
      data: { id: 'mismatch-account', auth_user_id: 'mismatch-auth', team_name: 'Miku007', manager_name: 'Vuk', role: 'MEMBER' },
      error: null,
    })
    const container = await renderApp()
    await settle()

    expect(container.textContent).toContain('Account setup required')
    expect(container.querySelector('[data-testid="league-dashboard"]')).toBeNull()
  })

  it('clears the previous account dashboard while a different authenticated user resolves', async () => {
    let emitSession: ((state: AuthSessionState) => void) | undefined
    configure(sessionState('AUTHENTICATED', 'jakin-auth'), {
      data: { id: 'jakin-account', auth_user_id: 'jakin-auth', team_name: 'Jakin Goff', manager_name: 'Vuk', role: 'LEAGUE_OWNER' },
      error: null,
    })
    mocks.subscribe.mockImplementation((listener: (next: AuthSessionState) => void) => {
      emitSession = listener
      listener(sessionState('AUTHENTICATED', 'jakin-auth'))
      return vi.fn()
    })
    mocks.from
      .mockReturnValueOnce({ select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'jakin-account', auth_user_id: 'jakin-auth', team_name: 'Jakin Goff', manager_name: 'Vuk', role: 'LEAGUE_OWNER' }, error: null }) }) }) })
      .mockReturnValueOnce({ select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ maybeSingle: vi.fn().mockReturnValue(new Promise(() => undefined)) }) }) })

    const container = await renderApp()
    await settle()
    expect(container.querySelector('[data-testid="league-dashboard"]')?.textContent).toContain('demo-manager-1')

    act(() => emitSession?.(sessionState('AUTHENTICATED', 'miku-auth')))

    expect(container.querySelector('[data-testid="league-dashboard"]')).toBeNull()
    expect(container.textContent).toContain('Loading league account')
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
