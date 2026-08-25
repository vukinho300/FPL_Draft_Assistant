import type { ReactNode } from 'react'

import { MobileBottomNavigation } from './MobileBottomNavigation.tsx'
import {
  MobileDraftArchivePage,
  MobilePlayersPage,
  MobileTransactionsPage,
} from './MobileDataPages.tsx'
import { GameweekTeamExperience } from './GameweekTeamExperience.tsx'
import { TeamAvatar, TeamProfileHeader } from './TeamProfile.tsx'
import type { LeagueView } from './navigation.ts'
import type { LeagueDashboardModel } from './useLeagueDashboardModel.ts'
import type { AuthenticatedDashboardAccount, LeagueTeamProfilesModel } from './useLeagueTeamProfiles.ts'
import './MobileLeagueDashboard.css'

function MobilePageHeader({ title }: { readonly title: string }) {
  return (
    <header className="mobile-app-header">
      <p>2026/27 FPL Draft League</p>
      <h1>{title}</h1>
    </header>
  )
}

function MobileCard({ children, className = '' }: { readonly children: ReactNode; readonly className?: string }) {
  return <section className={`mobile-card ${className}`.trim()}>{children}</section>
}

function MobileLeaguePage({ model }: { readonly model: LeagueDashboardModel }) {
  return (
    <div className="mobile-page-stack">
      <section className="mobile-gameweek-hero">
        <p className="mobile-eyebrow">Current Gameweek</p>
        <h2>Gameweek data is not connected</h2>
        <p>A verified Gameweek source will appear here when it is available for this league.</p>
      </section>

      <MobileCard className="mobile-points-card">
        <p className="mobile-eyebrow">My Gameweek Points</p>
        <strong>Unavailable</strong>
        <p>Verified Gameweek points are not connected yet.</p>
      </MobileCard>

      <MobileCard className="mobile-standings-card">
        <div className="mobile-card-heading"><div><p className="mobile-eyebrow">League standings</p><h2>Standings unavailable</h2></div><span>Not connected</span></div>
        <div className="mobile-standings-columns" aria-hidden="true"><span>Rank</span><span>Manager</span><span>Points</span></div>
        <p>Verified league standings will appear here when the league Gameweek adapter is connected.</p>
      </MobileCard>

      <MobileCard className="mobile-events-card">
        <div className="mobile-card-heading"><div><p className="mobile-eyebrow">Important Gameweek events</p><h2>No verified events available</h2></div><span>Not connected</span></div>
        <p>Goals, assists and other significant verified Gameweek events will appear here when their data source is available.</p>
      </MobileCard>

      <MobileCard className="mobile-recent-transactions">
        <div className="mobile-card-heading"><div><p className="mobile-eyebrow">Recent transactions</p><h2>League activity</h2></div><span>Lower priority</span></div>
        {model.recentTransactions.length === 0
          ? <p className="mobile-muted-copy">No league transactions are recorded.</p>
          : <ol className="mobile-transaction-list">{model.recentTransactions.slice(0, 5).map((event) => <li key={event.id}><span>{event.gameweek === null ? 'League' : `GW${event.gameweek}`}</span><strong>{event.description}</strong></li>)}</ol>}
      </MobileCard>
    </div>
  )
}

function MobileMyTeamPage({ model, profiles }: { readonly model: LeagueDashboardModel; readonly profiles: LeagueTeamProfilesModel }) {
  return (
    <div className="mobile-page-stack team-profile-page">
      <TeamProfileHeader
        profile={profiles.current}
        editable
        loading={profiles.loading}
        uploading={profiles.uploading}
        error={profiles.error}
        onAvatarSelected={(file) => void profiles.uploadCurrentAvatar(file)}
      />
      <GameweekTeamExperience model={model} team={model.gameweek.currentTeam} privatePlanner />
    </div>
  )
}

function MobileTeamsPage({ model, profiles }: { readonly model: LeagueDashboardModel; readonly profiles: LeagueTeamProfilesModel }) {
  return (
    <div className="mobile-page-stack">
      <div className="mobile-manager-selector" aria-label="Choose manager">
        {model.rosters.map((roster) => {
          const profile = profiles.profileForRoster(roster.managerId)
          return (
            <button
              type="button"
              key={roster.managerId}
              className={roster.managerId === model.selectedManagerId ? 'active' : ''}
              aria-pressed={roster.managerId === model.selectedManagerId}
              onClick={() => model.selectManager(roster.managerId)}
            >
              <TeamAvatar profile={profile} size="small" decorative />
              <span>{profile.teamName}</span>
            </button>
          )
        })}
      </div>
      <TeamProfileHeader profile={profiles.selected} error={profiles.error} />
      <GameweekTeamExperience model={model} team={model.gameweek.selectedTeam} privatePlanner={false} />
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

function CurrentMobileView({ model, profiles }: { readonly model: LeagueDashboardModel; readonly profiles: LeagueTeamProfilesModel }) {
  const views: Record<LeagueView, ReactNode> = {
    league: <MobileLeaguePage model={model} />,
    'my-team': <MobileMyTeamPage model={model} profiles={profiles} />,
    teams: <MobileTeamsPage model={model} profiles={profiles} />,
    matchday: <MobileMatchdayPage model={model} />,
    players: <MobilePlayersPage model={model} />,
    transactions: <MobileTransactionsPage model={model} />,
    'draft-archive': <MobileDraftArchivePage model={model} />,
  }
  return <div className="mobile-view-transition" key={model.view}>{views[model.view]}</div>
}

export function MobileLeagueDashboard({ model, profiles, account, onLogout }: { readonly model: LeagueDashboardModel; readonly profiles: LeagueTeamProfilesModel; readonly account?: AuthenticatedDashboardAccount; readonly onLogout?: () => void }) {
  const title = model.view === 'league' ? 'Kile N Others' : model.currentTitle
  return (
    <div className="mobile-league-dashboard" data-presentation="mobile">
      <MobilePageHeader title={title} />
      <main className="mobile-app-main">
        <CurrentMobileView model={model} profiles={profiles} />
      </main>
      <MobileBottomNavigation model={model} profiles={profiles} account={account} onLogout={onLogout} />
    </div>
  )
}
