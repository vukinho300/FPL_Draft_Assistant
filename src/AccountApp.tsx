import { useEffect, useState, type ReactNode } from 'react'

import LeagueDashboard from './LeagueDashboard.tsx'
import { resolveLeagueAccountRosterManagerId } from './data/leagues/kile-n-others/accountRosterIdentity.ts'
import { FantacalcioShell } from './fantacalcio/FantacalcioShell.tsx'
import {
  getSupabaseAuthSessionService,
  getSupabaseBrowserClient,
  LEAGUE_TEAM_LOGIN_IDENTITIES,
  type AuthSessionState,
} from './services/supabase/index.ts'
import { hasFantacalcioAccess } from './services/supabase/fantacalcioAccess.ts'
import './AccountApp.css'

type LeagueAccount = {
  id: string
  auth_user_id: string | null
  team_name: string
  manager_name: string
  role: 'MEMBER' | 'LEAGUE_OWNER'
}

type AccountResolution = Readonly<{
  authUserId: string
  account: LeagueAccount | null
  error: string | null
}>

type FantacalcioResolution = Readonly<{
  authUserId: string
  allowed: boolean
}>

function Login({ onLogin }: { readonly onLogin: () => void }) {
  const [team, setTeam] = useState<string>(LEAGUE_TEAM_LOGIN_IDENTITIES[0].teamName)
  const [password, setPassword] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  return (
    <main className="auth-page">
      <form className="auth-card" onSubmit={async (event) => {
        event.preventDefault()
        setPending(true)
        setError(null)
        const state = await getSupabaseAuthSessionService().signInWithTeamName(team, password)
        setPassword('')
        setPending(false)
        if (state.status === 'AUTHENTICATED') onLogin()
        else setError('Unable to log in. Check your team and password.')
      }}>
        <p>2026/27 FPL Draft League</p>
        <h1>Kile N Others</h1>
        <label>Team<select value={team} onChange={(event) => setTeam(event.target.value)}>{LEAGUE_TEAM_LOGIN_IDENTITIES.map((identity) => <option key={identity.teamSlug}>{identity.teamName}</option>)}</select></label>
        <label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required /></label>
        {error !== null && <p role="alert">{error}</p>}
        <button type="submit" disabled={pending}>{pending ? 'Logging in…' : 'Log in'}</button>
      </form>
    </main>
  )
}

function AccountSetupRequired({ children, onLogout }: { readonly children: string; readonly onLogout: () => void }) {
  return <main className="auth-page"><section className="auth-card"><h1>Account setup required</h1><p>{children}</p><button type="button" onClick={onLogout}>Log out</button></section></main>
}

export default function AccountApp() {
  let service
  try {
    service = getSupabaseAuthSessionService()
  } catch {
    return <main className="auth-page"><section className="auth-card"><h1>Configuration required</h1><p>Supabase browser configuration is missing or invalid.</p></section></main>
  }
  return <ConfiguredAccountApp service={service} />
}

function ConfiguredAccountApp({ service }: { readonly service: ReturnType<typeof getSupabaseAuthSessionService> }) {
  const [session, setSession] = useState<AuthSessionState>(() => service.getState())
  const [accountResolution, setAccountResolution] = useState<AccountResolution | null>(null)
  const [fantacalcioResolution, setFantacalcioResolution] = useState<FantacalcioResolution | null>(null)
  const [product, setProduct] = useState<'FPL' | 'FANTACALCIO'>('FPL')
  const authUserId = session.status === 'AUTHENTICATED' ? session.session?.user.id ?? null : null

  useEffect(() => {
    const unsubscribe = service.subscribe(setSession)
    void service.initialize()
    return unsubscribe
  }, [service])

  useEffect(() => {
    setAccountResolution(null)
    setFantacalcioResolution(null)
    setProduct('FPL')
    if (authUserId === null) return

    let active = true
    void Promise.resolve(getSupabaseBrowserClient().from('league_accounts').select('id, auth_user_id, team_name, manager_name, role').eq('auth_user_id', authUserId).maybeSingle())
      .then(({ data, error }) => {
        if (!active) return
        setAccountResolution({
          authUserId,
          account: error === null ? data as LeagueAccount | null : null,
          error: error !== null || data === null ? 'This authenticated account is not configured for the league.' : null,
        })
      }).catch(() => {
        if (active) setAccountResolution({ authUserId, account: null, error: 'This authenticated account is not configured for the league.' })
      })
    void hasFantacalcioAccess(authUserId).then((allowed) => {
      if (active) setFantacalcioResolution({ authUserId, allowed })
    }).catch(() => {
      if (active) setFantacalcioResolution({ authUserId, allowed: false })
    })
    return () => { active = false }
  }, [authUserId])

  if (session.status === 'INITIALIZING') return <main className="auth-page"><p className="auth-loading">Opening Kile N Others…</p></main>
  if (session.status === 'UNAUTHENTICATED') return <Login onLogin={() => undefined} />
  const accountState = accountResolution?.authUserId === authUserId ? accountResolution : null
  const account = accountState?.account ?? null
  const canUseFantacalcio = fantacalcioResolution?.authUserId === authUserId && fantacalcioResolution.allowed
  const currentManagerId = account === null
    ? null
    : resolveLeagueAccountRosterManagerId(account.team_name, account.manager_name)
  const showFantacalcio = canUseFantacalcio && product === 'FANTACALCIO'

  let fplExperience: ReactNode
  if (accountState === null) {
    fplExperience = <main className="auth-page"><p className="auth-loading">Loading league account…</p></main>
  } else if (accountState.error !== null || account === null) {
    fplExperience = <AccountSetupRequired onLogout={() => void service.signOut()}>
      {accountState.error ?? 'This authenticated account is not configured for the league.'}
    </AccountSetupRequired>
  } else if (currentManagerId === null) {
    fplExperience = <AccountSetupRequired onLogout={() => void service.signOut()}>
      This authenticated account does not map to an official league roster.
    </AccountSetupRequired>
  } else {
    fplExperience = <LeagueDashboard
      currentManagerId={currentManagerId}
      account={{
        id: account.id,
        teamName: account.team_name,
        managerName: account.manager_name,
        role: account.role,
      }}
      onLogout={() => void service.signOut()}
    />
  }

  if (!canUseFantacalcio && (accountState === null || accountState.error !== null || currentManagerId === null)) {
    return fplExperience
  }

  return (
    <div className="authenticated-app">
      <div className="account-banner">
        <span>{account?.team_name ?? 'Signed in'}{account?.role === 'LEAGUE_OWNER' ? ' · Commissioner' : ''}</span>
        {canUseFantacalcio && <nav className="product-navigation" aria-label="Products">
          <button type="button" aria-current={!showFantacalcio ? 'page' : undefined} onClick={() => setProduct('FPL')}>FPL Draft</button>
          <button type="button" aria-current={showFantacalcio ? 'page' : undefined} onClick={() => setProduct('FANTACALCIO')}>Fantacalcio</button>
        </nav>}
        <button type="button" onClick={() => void service.signOut()}>Log out</button>
      </div>
      {showFantacalcio
        ? <FantacalcioShell onReturnToFpl={() => setProduct('FPL')} />
        : fplExperience}
    </div>
  )
}
