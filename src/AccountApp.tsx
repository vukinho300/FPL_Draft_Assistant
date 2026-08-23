import { useEffect, useState } from 'react'

import LeagueDashboard from './LeagueDashboard.tsx'
import { resolveLeagueAccountRosterManagerId } from './data/leagues/kile-n-others/accountRosterIdentity.ts'
import {
  getSupabaseAuthSessionService,
  getSupabaseBrowserClient,
  LEAGUE_TEAM_LOGIN_IDENTITIES,
  type AuthSessionState,
} from './services/supabase/index.ts'
import './AccountApp.css'

type LeagueAccount = {
  id: string
  auth_user_id: string | null
  team_name: string
  manager_name: string
  role: 'MEMBER' | 'LEAGUE_OWNER'
}

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
  const [account, setAccount] = useState<LeagueAccount | null>(null)
  const [accountError, setAccountError] = useState<string | null>(null)
  const authUserId = session.status === 'AUTHENTICATED' ? session.session?.user.id ?? null : null

  useEffect(() => {
    const unsubscribe = service.subscribe(setSession)
    void service.initialize()
    return unsubscribe
  }, [service])

  useEffect(() => {
    setAccount(null)
    setAccountError(null)
    if (authUserId === null) return

    let active = true
    void getSupabaseBrowserClient().from('league_accounts').select('id, auth_user_id, team_name, manager_name, role').eq('auth_user_id', authUserId).maybeSingle().then(({ data, error }) => {
      if (!active) return
      if (error !== null || data === null) {
        setAccountError('This authenticated account is not configured for the league.')
        return
      }
      setAccount(data as LeagueAccount)
    })
    return () => { active = false }
  }, [authUserId])

  if (session.status === 'INITIALIZING') return <main className="auth-page"><p className="auth-loading">Opening Kile N Others…</p></main>
  if (session.status === 'UNAUTHENTICATED') return <Login onLogin={() => undefined} />
  if (accountError !== null) return <AccountSetupRequired onLogout={() => void service.signOut()}>{accountError}</AccountSetupRequired>
  if (account === null) return <main className="auth-page"><p className="auth-loading">Loading league account…</p></main>

  const currentManagerId = resolveLeagueAccountRosterManagerId(account.team_name, account.manager_name)
  if (currentManagerId === null) {
    return <AccountSetupRequired onLogout={() => void service.signOut()}>
      This authenticated account does not map to an official league roster.
    </AccountSetupRequired>
  }

  return (
    <div className="authenticated-app">
      <div className="account-banner">
        <span>{account.team_name}{account.role === 'LEAGUE_OWNER' ? ' · Commissioner' : ''}</span>
        <button type="button" onClick={() => void service.signOut()}>Log out</button>
      </div>
      <LeagueDashboard
        currentManagerId={currentManagerId}
        account={{ teamName: account.team_name, isCommissioner: account.role === 'LEAGUE_OWNER' }}
        onLogout={() => void service.signOut()}
      />
    </div>
  )
}
