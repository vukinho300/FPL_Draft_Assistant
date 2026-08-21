import type { ReactNode } from 'react'

import { MobileBottomNavigation } from './MobileBottomNavigation.tsx'
import { MobileSquad } from './MobileSquad.tsx'
import type { LeagueView } from './navigation.ts'
import type { LeagueDashboardModel } from './useLeagueDashboardModel.ts'
import './MobileLeagueDashboard.css'

function MobilePageHeader({ title }: { readonly title: string }) {
  return (
    <header className="mobile-app-header">
      <p>Kile N Others · 2026/27</p>
      <h1>{title}</h1>
    </header>
  )
}

function MobileCard({ children, className = '' }: { readonly children: ReactNode; readonly className?: string }) {
  return <section className={`mobile-card ${className}`.trim()}>{children}</section>
}

function MobileLeaguePage({ model }: { readonly model: LeagueDashboardModel }) {
  const { leagueSummary } = model
  return (
    <div className="mobile-page-stack">
      <section className="mobile-league-hero">
        <p className="mobile-eyebrow">2026/27 season hub</p>
        <h2>Kile N Others</h2>
        <p>The completed official draft is frozen. Season data will be layered on without rewriting that history.</p>
        <button type="button" onClick={() => model.navigate('draft-archive')}>Open Draft Archive</button>
      </section>

      <section className="mobile-summary-grid" aria-label="League summary">
        <MobileCard><span>Managers</span><strong>{leagueSummary.managerCount}</strong><small>Kile N Others league</small></MobileCard>
        <MobileCard><span>Complete squads</span><strong>{leagueSummary.completeSquadCount}/{leagueSummary.managerCount}</strong><small>Every roster validates at 15 players</small></MobileCard>
        <MobileCard><span>Official draft</span><strong>{leagueSummary.officialDraftPickCount}</strong><small>Immutable sequential picks</small></MobileCard>
        <MobileCard><span>Current Gameweek</span><strong>—</strong><small>Not yet connected</small></MobileCard>
      </section>

      <MobileCard>
        <div className="mobile-card-heading"><div><p className="mobile-eyebrow">League squads</p><h2>Roster completeness</h2></div><span>Base state</span></div>
        <div className="mobile-roster-list">
          {model.rosters.map((roster) => (
            <article key={roster.managerId}>
              <div><strong>{roster.managerName}</strong><span>{roster.players.length}/15</span></div>
              <small>{model.positions.map((position) => `${position} ${roster.positionCounts[position]}`).join(' · ')}</small>
            </article>
          ))}
        </div>
      </MobileCard>

      <MobileCard>
        <div className="mobile-card-heading"><div><p className="mobile-eyebrow">League activity</p><h2>Latest recorded events</h2></div><span>Draft archive</span></div>
        <ol className="mobile-activity-list">
          {model.activity.slice(0, 6).map((event) => <li key={event.id}><span>{event.kind}</span><strong>{event.description}</strong></li>)}
        </ol>
      </MobileCard>

      <section className="mobile-future-list" aria-label="Future data availability">
        <MobileCard><span>Standings</span><strong>Source not verified</strong></MobileCard>
        <MobileCard><span>Gameweek points</span><strong>Source not verified</strong></MobileCard>
        <MobileCard><span>Live points</span><strong>Source not verified</strong></MobileCard>
        <MobileCard><span>Recent transactions</span><strong>No recorded transactions</strong></MobileCard>
      </section>
    </div>
  )
}

function MobileTeamsPage({ model }: { readonly model: LeagueDashboardModel }) {
  return (
    <div className="mobile-page-stack">
      <section className="mobile-page-intro">
        <p className="mobile-eyebrow">League squads</p>
        <h2>Choose a manager</h2>
        <p>Each squad is grouped by role and does not imply a Gameweek lineup.</p>
      </section>
      <div className="mobile-manager-selector" aria-label="Choose manager">
        {model.rosters.map((roster) => (
          <button
            type="button"
            key={roster.managerId}
            className={roster.managerId === model.selectedManagerId ? 'active' : ''}
            aria-pressed={roster.managerId === model.selectedManagerId}
            onClick={() => model.selectManager(roster.managerId)}
          >
            {roster.managerName}
          </button>
        ))}
      </div>
      <MobileSquad model={model} roster={model.selectedManagerRoster} title={`${model.selectedManagerRoster.managerName}'s squad`} />
    </div>
  )
}

function MobileMatchdayPage({ model }: { readonly model: LeagueDashboardModel }) {
  return (
    <div className="mobile-page-stack">
      <section className="mobile-page-intro">
        <p className="mobile-eyebrow">Matchday</p>
        <h2>Gameweek centre</h2>
        <p>No score or lineup is shown until a safe FPL Draft source is verified.</p>
      </section>
      <section className="mobile-matchday-list" aria-label="Manager matchday status">
        {model.rosters.map((roster) => (
          <MobileCard key={roster.managerId} className="mobile-matchday-card">
            <strong>{roster.managerName}</strong>
            <span>GW score —</span>
            <small>Lineup not connected</small>
          </MobileCard>
        ))}
      </section>
      <MobileCard className="mobile-capability-card">
        <p className="mobile-eyebrow">Verified boundary</p>
        <h2>No fabricated matchday values</h2>
        <ul>
          <li><span>League standings</span><strong>UNVERIFIED</strong></li>
          <li><span>Manager lineups</span><strong>UNVERIFIED</strong></li>
          <li><span>Live scores</span><strong>UNVERIFIED</strong></li>
          <li><span>Public player pool</span><strong className="available">AVAILABLE</strong></li>
        </ul>
      </MobileCard>
    </div>
  )
}

function MobileDeferredPage({ title }: { readonly title: string }) {
  return (
    <section className="mobile-deferred-page">
      <p className="mobile-eyebrow">Mobile presentation</p>
      <h2>{title}</h2>
      <p>The phone-first {title} view is scheduled for the next F2 implementation step.</p>
    </section>
  )
}

function CurrentMobileView({ model }: { readonly model: LeagueDashboardModel }) {
  const views: Record<LeagueView, ReactNode> = {
    league: <MobileLeaguePage model={model} />,
    'my-team': <MobileSquad model={model} roster={model.vukRoster} title="Vuk's squad" />,
    teams: <MobileTeamsPage model={model} />,
    matchday: <MobileMatchdayPage model={model} />,
    players: <MobileDeferredPage title="Players" />,
    transactions: <MobileDeferredPage title="Transactions" />,
    'draft-archive': <MobileDeferredPage title="Draft Archive" />,
  }
  return views[model.view]
}

export function MobileLeagueDashboard({ model }: { readonly model: LeagueDashboardModel }) {
  return (
    <div className="mobile-league-dashboard" data-presentation="mobile">
      <MobilePageHeader title={model.currentTitle} />
      <main className="mobile-app-main">
        <CurrentMobileView model={model} />
      </main>
      <MobileBottomNavigation model={model} />
    </div>
  )
}
