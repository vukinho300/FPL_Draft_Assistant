import type { ReactNode } from 'react'

import type { Position } from '../domain/player.ts'
import type { CurrentLeagueRoster } from '../domain/transactions.ts'
import type { LeagueDashboardModel } from './useLeagueDashboardModel.ts'
import type { LeagueView } from './navigation.ts'
import {
  getPlayerDirectoryName,
  formatPlayerForm,
  getPlayerDirectorySortLabel,
  PLAYER_DIRECTORY_SORTS,
  PLAYER_OWNERSHIP_FILTERS,
  type PlayerDirectoryEntry,
  type PlayerDirectorySort,
  type PlayerOwnershipFilter,
} from './playerDirectory.ts'
import './DesktopLeagueDashboard.css'

function DashboardNavigation({
  model,
}: {
  readonly model: LeagueDashboardModel
}) {
  return (
    <nav className="dashboard-navigation dashboard-navigation-sidebar" aria-label="League dashboard">
      {model.navigation.map(({ id, label }) => (
        <button
          type="button"
          key={id}
          className={model.view === id ? 'active' : ''}
          aria-current={model.view === id ? 'page' : undefined}
          onClick={() => model.navigate(id)}
        >
          <i aria-hidden="true" />
          {label}
        </button>
      ))}
    </nav>
  )
}

function Placeholder({ children }: { readonly children: ReactNode }) {
  return <span className="not-connected">{children}</span>
}

function SquadPitch({
  model,
  roster,
  title,
}: {
  readonly model: LeagueDashboardModel
  readonly roster: CurrentLeagueRoster
  readonly title: string
}) {
  return (
    <section className="squad-view" aria-label={`${roster.managerName} squad`}>
      <div className="squad-heading">
        <div><p className="dashboard-kicker">Squad · not a Gameweek XI</p><h2>{title}</h2></div>
        <strong>{roster.players.length}/15</strong>
      </div>
      <div className="squad-counts">
        {model.positions.map((position) => (
          <span key={position}>
            {position} {roster.positionCounts[position]}/{model.rosterRequirements[position]}
          </span>
        ))}
      </div>
      <div className="football-pitch">
        <div className="pitch-markings" aria-hidden="true"><i /><b /><em /></div>
        {model.positions.map((position) => (
          <section
            className={`pitch-line pitch-${position.toLowerCase()}`}
            key={position}
            aria-label={`${position} players`}
          >
            <h3>{position}</h3>
            <div>
              {roster.players.filter((player) => player.position === position).map((player) => (
                <article className="pitch-player" key={player.playerId}>
                  <span className={`player-position position-${player.position.toLowerCase()}`}>{player.position}</span>
                  <strong>{player.displayName}</strong>
                  <small>{player.club.shortName} · Pick #{player.originalDraftPick ?? '—'}</small>
                  <small>Draft MVP #{player.draftDayMvpRank ?? '—'}</small>
                  <div><Placeholder>Availability not connected</Placeholder><Placeholder>Fixture not connected</Placeholder></div>
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>
      <section className="lineup-placeholder">
        <div><p className="dashboard-kicker">Gameweek lineup &amp; bench</p><h3>Not connected</h3></div>
        <p>The role-grouped squad above does not imply starters or bench order. Official Gameweek lineup data must be verified first.</p>
      </section>
    </section>
  )
}

function LeagueHome({ model }: { readonly model: LeagueDashboardModel }) {
  return (
    <div className="page-stack">
      <section className="league-hero">
        <div><p className="dashboard-kicker">2026/27 season hub</p><h2>Kile N Others</h2><p>The completed official draft is frozen. Season data will be layered on without rewriting that history.</p></div>
        <button type="button" onClick={() => model.navigate('draft-archive')}>Open Draft Archive</button>
      </section>
      <section className="metric-grid">
        <article><span>Managers</span><strong>6</strong><small>Vuk · Diego · Kristian · Miku · Tin · Deni</small></article>
        <article><span>Complete squads</span><strong>6/6</strong><small>Every roster validates at 15 players</small></article>
        <article><span>Official draft</span><strong>90</strong><small>Immutable sequential picks</small></article>
        <article><span>Current Gameweek</span><strong>—</strong><small>Not yet connected</small></article>
      </section>
      <div className="dashboard-columns">
        <section className="dashboard-card">
          <div className="card-heading"><div><p className="dashboard-kicker">League squads</p><h2>Roster completeness</h2></div><span>Base state</span></div>
          <div className="manager-completeness">
            {model.rosters.map((roster) => <article key={roster.managerId}><strong>{roster.managerName}</strong><span>{roster.players.length}/15</span><small>{model.positions.map((position) => `${position} ${roster.positionCounts[position]}`).join(' · ')}</small></article>)}
          </div>
        </section>
        <section className="dashboard-card">
          <div className="card-heading"><div><p className="dashboard-kicker">League activity</p><h2>Latest recorded events</h2></div><span>Draft archive</span></div>
          <ol className="activity-list">
            {model.activity.slice(0, 6).map((event) => <li key={event.id}><span>{event.kind}</span><strong>{event.description}</strong></li>)}
          </ol>
        </section>
      </div>
      <section className="future-data-strip">
        <article><span>Standings</span><Placeholder>Source not verified</Placeholder></article>
        <article><span>Gameweek points</span><Placeholder>Source not verified</Placeholder></article>
        <article><span>Live points</span><Placeholder>Source not verified</Placeholder></article>
        <article><span>Recent transactions</span><Placeholder>No recorded transactions</Placeholder></article>
      </section>
    </div>
  )
}

function TeamsPage({ model }: { readonly model: LeagueDashboardModel }) {
  return (
    <div className="page-stack">
      <div className="manager-tabs" aria-label="Choose manager">
        {model.rosters.map((roster) => (
          <button
            type="button"
            key={roster.managerId}
            className={roster.managerId === model.selectedManagerId ? 'active' : ''}
            onClick={() => model.selectManager(roster.managerId)}
          >
            {roster.managerName}
          </button>
        ))}
      </div>
      <SquadPitch
        model={model}
        roster={model.selectedManagerRoster}
        title={`${model.selectedManagerRoster.managerName}'s squad`}
      />
    </div>
  )
}

function MatchdayPage({ model }: { readonly model: LeagueDashboardModel }) {
  return (
    <div className="page-stack">
      <section className="page-intro"><p className="dashboard-kicker">Matchday</p><h2>Gameweek centre</h2><p>The shell is ready, but no score or lineup is shown until a safe FPL Draft source is verified.</p></section>
      <div className="matchday-grid">
        {model.rosters.map((roster) => <article key={roster.managerId}><strong>{roster.managerName}</strong><span>GW score —</span><Placeholder>Lineup not connected</Placeholder></article>)}
      </div>
      <section className="dashboard-card capability-card">
        <p className="dashboard-kicker">Verified boundary</p><h2>No fabricated matchday values</h2>
        <div><span>League standings <b>UNVERIFIED</b></span><span>Manager lineups <b>UNVERIFIED</b></span><span>Live scores <b>UNVERIFIED</b></span><span>Public player pool <b className="available">AVAILABLE</b></span></div>
      </section>
    </div>
  )
}

function TransactionsPage({ model }: { readonly model: LeagueDashboardModel }) {
  return (
    <div className="page-stack">
      <section className="page-intro"><p className="dashboard-kicker">Project tracker</p><h2>Transactions</h2><p>Only a transaction marked PROCESSED changes current rosters. The immutable draft always remains unchanged.</p></section>
      <div className="transaction-tabs" aria-label="Transaction category">
        {model.transactionTabs.map((tab) => <button type="button" key={tab} className={model.transactionTab === tab ? 'active' : ''} onClick={() => model.setTransactionTab(tab)}>{tab}</button>)}
      </div>
      <section className="dashboard-card transaction-panel">
        {model.transactionTab === 'ACTIVITY'
          ? <ol className="activity-list long">{model.activity.map((event) => <li key={event.id}><span>{event.gameweek === null ? 'DRAFT' : `GW${event.gameweek}`}</span><strong>{event.description}</strong></li>)}</ol>
          : <div className="empty-state"><strong>No {model.transactionTab.toLocaleLowerCase()} recorded</strong><p>This tracker never submits or automates an official FPL transaction.</p></div>}
      </section>
    </div>
  )
}

function PlayersPage({ model }: { readonly model: LeagueDashboardModel }) {
  const directory = model.playerDirectory
  return (
    <div className="page-stack">
      <section className="page-intro"><p className="dashboard-kicker">League directory</p><h2>Players &amp; ownership</h2><p>Ownership reflects the immutable draft plus processed transactions. Official FPL Draft rank, Form and Total Points are current official data; MVP consensus remains project ranking evidence.</p></section>
      <section className="dashboard-card player-directory">
        <div className="player-tools">
          <input type="search" aria-label="Search players or owners" placeholder="Search players or owners" value={directory.search} onChange={(event) => directory.setSearch(event.target.value)} />
          <div className="player-filter-group" aria-label="Filter players by position">{(['ALL', ...model.positions] as const).map((position: Position | 'ALL') => <button type="button" key={position} className={directory.position === position ? 'active' : ''} aria-pressed={directory.position === position} onClick={() => directory.setPosition(position)}>{position}</button>)}</div>
          <div className="player-filter-group" aria-label="Filter players by ownership">{PLAYER_OWNERSHIP_FILTERS.map((ownership: PlayerOwnershipFilter) => <button type="button" key={ownership} className={directory.ownership === ownership ? 'active' : ''} aria-pressed={directory.ownership === ownership} onClick={() => directory.setOwnership(ownership)}>{ownership === 'FREE_AGENTS' ? 'Free Agents' : ownership}</button>)}</div>
          <label className="player-sort-control">Sort by<select aria-label="Sort players" value={directory.sort} onChange={(event) => directory.setSort(event.target.value as PlayerDirectorySort)}>{PLAYER_DIRECTORY_SORTS.map((sort) => <option key={sort} value={sort}>{getPlayerDirectorySortLabel(sort)}</option>)}</select></label>
        </div>
        {directory.players.length > 0 && <div className="player-leaders" aria-label="Player leaders"><PlayerLeaders title="Form leaders" entries={directory.leaders.form} valueFor={(entry) => formatPlayerForm(entry.player.form)} /><PlayerLeaders title="Total Points leaders" entries={directory.leaders.totalPoints} valueFor={(entry) => entry.player.totalPoints ?? '—'} /></div>}
        {directory.error !== null
          ? <div className="empty-state"><strong>Live player directory unavailable</strong><p>{directory.error}</p></div>
          : directory.players.length === 0
            ? <div className="empty-state"><strong>Loading verified FPL players…</strong></div>
            : <div className="directory-scroll"><table><thead><tr><th>Player</th><th>Pos</th><th>Club</th><th>Owner</th><th>Official FPL Draft</th><th>Form</th><th>Total Points</th><th>MVP consensus</th></tr></thead><tbody>{directory.filtered.map((entry: PlayerDirectoryEntry) => <tr key={entry.player.id}><td><strong>{getPlayerDirectoryName(entry)}</strong></td><td><span className={`player-position position-${entry.player.position.toLowerCase()}`}>{entry.player.position}</span></td><td>{entry.player.club.shortName}</td><td><b className={entry.ownerManagerId === null ? 'free-agent-owner' : ''}>{entry.ownerName}</b></td><td>{entry.player.officialDraftRank ?? '—'}</td><td>{formatPlayerForm(entry.player.form)}</td><td>{entry.player.totalPoints ?? '—'}</td><td>{entry.mvpConsensusRank}</td></tr>)}</tbody></table></div>}
      </section>
    </div>
  )
}

function PlayerLeaders({ title, entries, valueFor }: {
  readonly title: string
  readonly entries: readonly PlayerDirectoryEntry[]
  readonly valueFor: (entry: PlayerDirectoryEntry) => string | number
}) {
  return (
    <section className="player-leader-card">
      <h3>{title}</h3>
      {entries.length === 0
        ? <p>No current values available.</p>
        : <ol>{entries.map((entry) => <li key={entry.player.id}><span>{getPlayerDirectoryName(entry)}</span><strong>{valueFor(entry)}</strong></li>)}</ol>}
    </section>
  )
}

function DraftArchivePage({ model }: { readonly model: LeagueDashboardModel }) {
  const metadata = model.archive.metadata
  return (
    <div className="page-stack">
      <section className="archive-banner"><p className="dashboard-kicker">Official draft</p><h2>Immutable historical record</h2><p>90 picks · six complete squads · captured {new Date(model.archive.completedAt).toLocaleString()}</p></section>
      <section className="archive-metadata">
        <article><span>Source commit</span><strong>{model.archive.sourceCommit.slice(0, 12)}</strong></article>
        <article><span>Ranking heuristic</span><strong>{metadata.heuristicVersion}</strong></article>
        <article><span>Ranking weights</span><strong>70% official · 30% model</strong></article>
        <article><span>Evidence</span><strong>{metadata.liveSnapshot.playerCount} players · {metadata.modelArtifact.modelSignalCount} model signals</strong></article>
      </section>
      <section className="dashboard-card">
        <div className="card-heading"><div><p className="dashboard-kicker">Final squads</p><h2>Draft result</h2></div><span>Read only</span></div>
        <div className="manager-completeness">{model.rosters.map((roster) => <article key={roster.managerId}><strong>{roster.managerName}</strong><span>15/15</span><small>{model.positions.map((position) => `${position} ${roster.positionCounts[position]}`).join(' · ')}</small></article>)}</div>
      </section>
      <section className="dashboard-card archive-table">
        <div className="card-heading"><div><p className="dashboard-kicker">Complete history</p><h2>Picks 1–90</h2></div><span>Draft Room code retained separately</span></div>
        <div className="directory-scroll"><table><thead><tr><th>Pick</th><th>Round</th><th>Manager</th><th>Player</th><th>Pos</th><th>Club</th><th>Official at draft</th><th>Model at draft</th><th>MVP at draft</th></tr></thead><tbody>{model.archive.picks.map((pick) => <tr key={pick.overallPickNumber}><td><strong>#{pick.overallPickNumber}</strong></td><td>{pick.roundNumber}</td><td>{pick.managerName}</td><td><strong>{pick.playerName}</strong></td><td><span className={`player-position position-${pick.position.toLowerCase()}`}>{pick.position}</span></td><td>{pick.club.shortName}</td><td>{pick.officialDraftRankAtDraft ?? '—'}</td><td>{pick.modelRankAtDraft ?? '—'}</td><td>{pick.mvpConsensusRankAtDraft ?? '—'}</td></tr>)}</tbody></table></div>
      </section>
    </div>
  )
}

function CurrentDesktopView({ model }: { readonly model: LeagueDashboardModel }) {
  const views: Record<LeagueView, ReactNode> = {
    league: <LeagueHome model={model} />,
    'my-team': <SquadPitch model={model} roster={model.vukRoster} title={`${model.vukRoster.managerName}'s squad`} />,
    teams: <TeamsPage model={model} />,
    matchday: <MatchdayPage model={model} />,
    players: <PlayersPage model={model} />,
    transactions: <TransactionsPage model={model} />,
    'draft-archive': <DraftArchivePage model={model} />,
  }
  return views[model.view]
}

export function DesktopLeagueDashboard({ model }: { readonly model: LeagueDashboardModel }) {
  return (
    <div className="league-dashboard-shell desktop-league-dashboard" data-presentation="desktop">
      <aside className="league-sidebar">
        <div className="league-brand"><span>2026/27</span><strong>Kile N Others</strong><small>FPL Draft League Dashboard</small></div>
        <DashboardNavigation model={model} />
        <div className="sidebar-status"><span>Official draft</span><strong>Frozen · 90/90</strong><small>Historical base state</small></div>
      </aside>
      <main className="league-main">
        <header className="league-topbar"><div><p className="dashboard-kicker">Kile N Others · 2026/27</p><h1>{model.currentTitle}</h1></div><div className="season-pill"><i /> Official draft archived</div></header>
        <CurrentDesktopView model={model} />
      </main>
    </div>
  )
}
