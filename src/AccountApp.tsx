import { useEffect, useState } from 'react'

import LeagueDashboard from './LeagueDashboard.tsx'
import { getSupabaseAuthSessionService, getSupabaseBrowserClient, LEAGUE_TEAM_LOGIN_IDENTITIES, type AuthSessionState } from './services/supabase/index.ts'
import './AccountApp.css'

type LeagueAccount = { id: string; auth_user_id: string | null; team_name: string; manager_name: string; role: 'MEMBER' | 'LEAGUE_OWNER' }

function Login({ onLogin }: { readonly onLogin: () => void }) {
  const [team, setTeam] = useState<string>(LEAGUE_TEAM_LOGIN_IDENTITIES[0].teamName)
  const [password, setPassword] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  return <main className="auth-page"><form className="auth-card" onSubmit={async (event) => { event.preventDefault(); setPending(true); setError(null); const state = await getSupabaseAuthSessionService().signInWithTeamName(team, password); setPassword(''); setPending(false); if (state.status === 'AUTHENTICATED') onLogin(); else setError('Unable to log in. Check your team and password.') }}><p>2026/27 FPL Draft League</p><h1>Kile N Others</h1><label>Team<select value={team} onChange={(event) => setTeam(event.target.value)}>{LEAGUE_TEAM_LOGIN_IDENTITIES.map((identity) => <option key={identity.teamSlug}>{identity.teamName}</option>)}</select></label><label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required /></label>{error !== null && <p role="alert">{error}</p>}<button type="submit" disabled={pending}>{pending ? 'Logging in…' : 'Log in'}</button></form></main>
}

export default function AccountApp() {
  const service = getSupabaseAuthSessionService()
  const [session, setSession] = useState<AuthSessionState>(() => service.getState())
  const [account, setAccount] = useState<LeagueAccount | null>(null)
  const [accountError, setAccountError] = useState<string | null>(null)
  useEffect(() => { const unsubscribe = service.subscribe(setSession); void service.initialize(); return unsubscribe }, [service])
  useEffect(() => { if (session.status !== 'AUTHENTICATED' || session.session === null) { setAccount(null); return }; let active = true; void getSupabaseBrowserClient().from('league_accounts').select('id, auth_user_id, team_name, manager_name, role').eq('auth_user_id', session.session.user.id).maybeSingle().then(({ data, error }) => { if (!active) return; if (error !== null || data === null) { setAccountError('This authenticated account is not configured for the league.'); setAccount(null) } else { setAccount(data as LeagueAccount); setAccountError(null) } }); return () => { active = false } }, [session])
  if (session.status === 'INITIALIZING') return <main className="auth-page"><p className="auth-loading">Opening Kile N Others…</p></main>
  if (session.status === 'UNAUTHENTICATED') return <Login onLogin={() => undefined} />
  if (accountError !== null) return <main className="auth-page"><section className="auth-card"><h1>Account setup required</h1><p>{accountError}</p><button type="button" onClick={() => void service.signOut()}>Log out</button></section></main>
  if (account === null) return <main className="auth-page"><p className="auth-loading">Loading league account…</p></main>
  return <div className="authenticated-app"><div className="account-banner"><span>{account.team_name}{account.role === 'LEAGUE_OWNER' ? ' · Commissioner' : ''}</span><button type="button" onClick={() => void service.signOut()}>Log out</button></div><LeagueDashboard currentManagerName={account.manager_name} /></div>
}
