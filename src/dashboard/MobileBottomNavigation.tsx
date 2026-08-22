import { useId, useState } from 'react'

import type { LeagueView } from './navigation.ts'
import type { LeagueDashboardModel } from './useLeagueDashboardModel.ts'

const primaryViews: readonly LeagueView[] = ['league', 'my-team', 'teams']
const moreViews: readonly LeagueView[] = ['players', 'matchday', 'transactions', 'draft-archive']

function isPrimaryView(view: LeagueView): boolean {
  return primaryViews.includes(view)
}

function NavigationIcon({ view }: { readonly view: LeagueView | 'more' }) {
  if (view === 'league') return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 11.5 12 5l8 6.5v7.25a1.25 1.25 0 0 1-1.25 1.25H5.25A1.25 1.25 0 0 1 4 18.75V11.5Z" /><path d="M9.5 20v-5h5v5" /></svg>
  if (view === 'my-team') return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3" /><path d="M5.5 20c.6-3.6 2.8-5.5 6.5-5.5s5.9 1.9 6.5 5.5" /></svg>
  if (view === 'teams') return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="8" cy="9" r="2.5" /><circle cx="16" cy="9" r="2.5" /><path d="M3.5 19c.5-3 2.1-4.5 4.5-4.5 1.4 0 2.5.5 3.3 1.5M20.5 19c-.5-3-2.1-4.5-4.5-4.5-1.4 0-2.5.5-3.3 1.5" /></svg>
  return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="19" cy="12" r="1.5" /></svg>
}

export function MobileBottomNavigation({ model, account, onLogout }: { readonly model: LeagueDashboardModel; readonly account?: { readonly teamName: string; readonly isCommissioner: boolean }; readonly onLogout?: () => void }) {
  const [moreOpen, setMoreOpen] = useState(false)
  const moreMenuId = useId()
  const primaryItems = model.navigation.filter(({ id }) => isPrimaryView(id))
  const moreItems = moreViews.map((view) => model.navigation.find(({ id }) => id === view)!)

  const navigate = (view: LeagueView) => {
    model.navigate(view)
    setMoreOpen(false)
  }

  return (
    <nav
      className="mobile-bottom-navigation"
      aria-label="League dashboard"
      onKeyDown={(event) => {
        if (event.key === 'Escape') setMoreOpen(false)
      }}
    >
      {moreOpen && (
        <div className="mobile-more-menu" id={moreMenuId} aria-label="More dashboard views">
          {account !== undefined && <section className="mobile-account-surface"><strong>{account.teamName}</strong>{account.isCommissioner && <span>Commissioner</span>}{onLogout !== undefined && <button type="button" onClick={onLogout}>Log out</button>}</section>}
          {moreItems.map(({ id, label }) => (
            <button
              type="button"
              key={id}
              className={model.view === id ? 'active' : ''}
              aria-current={model.view === id ? 'page' : undefined}
              onClick={() => navigate(id)}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      {primaryItems.map(({ id, label }) => (
        <button
          type="button"
          key={id}
          className={model.view === id ? 'active' : ''}
          aria-current={model.view === id ? 'page' : undefined}
          onClick={() => navigate(id)}
        >
          <NavigationIcon view={id} />
          <span>{label}</span>
        </button>
      ))}
      <button
        type="button"
        className={!isPrimaryView(model.view) ? 'active' : ''}
        aria-controls={moreMenuId}
        aria-expanded={moreOpen}
        onClick={() => setMoreOpen((open) => !open)}
      >
        <NavigationIcon view="more" />
        <span>More</span>
      </button>
    </nav>
  )
}
