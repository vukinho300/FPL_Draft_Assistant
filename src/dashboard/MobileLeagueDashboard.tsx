import type { LeagueDashboardModel } from './useLeagueDashboardModel.ts'
import './MobileLeagueDashboard.css'

export function MobileLeagueDashboard({ model }: { readonly model: LeagueDashboardModel }) {
  return (
    <div className="mobile-league-dashboard" data-presentation="mobile">
      <header className="mobile-boundary-header">
        <p>Kile N Others · 2026/27</p>
        <h1>{model.currentTitle}</h1>
      </header>
      <nav className="mobile-boundary-navigation" aria-label="League dashboard">
        {model.navigation.map(({ id, label }) => (
          <button
            type="button"
            key={id}
            className={model.view === id ? 'active' : ''}
            aria-current={model.view === id ? 'page' : undefined}
            onClick={() => model.navigate(id)}
          >
            {label}
          </button>
        ))}
      </nav>
      <main className="mobile-boundary-content">
        <p>Mobile presentation foundation</p>
        <h2>{model.currentTitle}</h2>
        <p>The phone-first {model.currentTitle} view will be implemented in the next F2 presentation step.</p>
      </main>
    </div>
  )
}
