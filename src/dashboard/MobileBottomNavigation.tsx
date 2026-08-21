import { useId, useState } from 'react'

import type { LeagueView } from './navigation.ts'
import type { LeagueDashboardModel } from './useLeagueDashboardModel.ts'

const primaryViews: readonly LeagueView[] = ['league', 'my-team', 'players']

function isPrimaryView(view: LeagueView): boolean {
  return primaryViews.includes(view)
}

export function MobileBottomNavigation({ model }: { readonly model: LeagueDashboardModel }) {
  const [moreOpen, setMoreOpen] = useState(false)
  const moreMenuId = useId()
  const primaryItems = model.navigation.filter(({ id }) => isPrimaryView(id))
  const moreItems = model.navigation.filter(({ id }) => !isPrimaryView(id))

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
          {label}
        </button>
      ))}
      <button
        type="button"
        className={!isPrimaryView(model.view) ? 'active' : ''}
        aria-controls={moreMenuId}
        aria-expanded={moreOpen}
        onClick={() => setMoreOpen((open) => !open)}
      >
        More
      </button>
    </nav>
  )
}
