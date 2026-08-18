import { useEffect, useMemo, useState } from 'react'

import './LeagueDashboard.css'
import { officialDraft202627 } from './data/leagues/kile-n-others/officialDraft2026-27.ts'
import { kileNOthersTransactions } from './data/leagues/kile-n-others/transactions.ts'
import { POSITION_ORDER, ROSTER_REQUIREMENTS } from './domain/league.ts'
import type { Player, Position } from './domain/player.ts'
import {
  buildLeagueActivity,
  buildPlayerOwnershipDirectory,
  deriveCurrentLeagueRosters,
  type CurrentLeagueRoster,
  type PlayerOwnershipEntry,
} from './domain/transactions.ts'
import { loadFplPlayerData } from './services/fpl/browserClient.ts'

const navigation = [
  ['league', 'League'],
  ['my-team', 'My Team'],
  ['teams', 'Teams'],
  ['matchday', 'Matchday'],
  ['players', 'Players'],
  ['transactions', 'Transactions'],
  ['draft-archive', 'Draft Archive'],
] as const

type LeagueView = (typeof navigation)[number][0]
type TransactionTab = 'TRADES' | 'WAIVERS' | 'FREE AGENTS' | 'ACTIVITY'

function Placeholder({ children }: { readonly children: React.ReactNode }) {
  return <span className="not-connected">{children}</span>
}

function SquadPitch({ roster, title }: { readonly roster: CurrentLeagueRoster; readonly title: string }) {
  return (
    <section className="squad-view" aria-label={`${roster.managerName} squad`}>
      <div className="squad-heading">
        <div><p className="dashboard-kicker">Squad · not a Gameweek XI</p><h2>{title}</h2></div>
        <strong>{roster.players.length}/15</strong>
      </div>
      <div className="squad-counts">
        {POSITION_ORDER.map((position) => (
          <span key={position}>{position} {roster.positionCounts[position]}/{ROSTER_REQUIREMENTS[position]}</span>
        ))}
      </div>
      <div className="football-pitch">
        <div className="pitch-markings" aria-hidden="true"><i /><b /><em /></div>
        {POSITION_ORDER.map((position) => (
          <section className={`pitch-line pitch-${position.toLowerCase()}`} key={position} aria-label={`${position} players`}>
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

function LeagueHome({ rosters, onArchive }: { readonly rosters: readonly CurrentLeagueRoster[]; readonly onArchive: () => void }) {
  const activity = buildLeagueActivity(officialDraft202627, kileNOthersTransactions)
  return (
    <div className="page-stack">
      <section className="league-hero">
        <div><p className="dashboard-kicker">2026/27 season hub</p><h2>Kile N Others</h2><p>The completed official draft is frozen. Season data will be layered on without rewriting that history.</p></div>
        <button type="button" onClick={onArchive}>Open Draft Archive</button>
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
            {rosters.map((roster) => <article key={roster.managerId}><strong>{roster.managerName}</strong><span>{roster.players.length}/15</span><small>{POSITION_ORDER.map((position) => `${position} ${roster.positionCounts[position]}`).join(' · ')}</small></article>)}
          </div>
        </section>
        <section className="dashboard-card">
          <div className="card-heading"><div><p className="dashboard-kicker">League activity</p><h2>Latest recorded events</h2></div><span>Draft archive</span></div>
          <ol className="activity-list">
            {activity.slice(0, 6).map((event) => <li key={event.id}><span>{event.kind}</span><strong>{event.description}</strong></li>)}
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

function TeamsPage({ rosters }: { readonly rosters: readonly CurrentLeagueRoster[] }) {
  const [managerId, setManagerId] = useState(rosters[0].managerId)
  const roster = rosters.find((item) => item.managerId === managerId) ?? rosters[0]
  return (
    <div className="page-stack">
      <div className="manager-tabs" aria-label="Choose manager">
        {rosters.map((item) => <button type="button" key={item.managerId} className={item.managerId === roster.managerId ? 'active' : ''} onClick={() => setManagerId(item.managerId)}>{item.managerName}</button>)}
      </div>
      <SquadPitch roster={roster} title={`${roster.managerName}'s squad`} />
    </div>
  )
}

function MatchdayPage({ rosters }: { readonly rosters: readonly CurrentLeagueRoster[] }) {
  return (
    <div className="page-stack">
      <section className="page-intro"><p className="dashboard-kicker">Matchday</p><h2>Gameweek centre</h2><p>The shell is ready, but no score or lineup is shown until a safe FPL Draft source is verified.</p></section>
      <div className="matchday-grid">
        {rosters.map((roster) => <article key={roster.managerId}><strong>{roster.managerName}</strong><span>GW score —</span><Placeholder>Lineup not connected</Placeholder></article>)}
      </div>
      <section className="dashboard-card capability-card">
        <p className="dashboard-kicker">Verified boundary</p><h2>No fabricated matchday values</h2>
        <div><span>League standings <b>UNVERIFIED</b></span><span>Manager lineups <b>UNVERIFIED</b></span><span>Live scores <b>UNVERIFIED</b></span><span>Public player pool <b className="available">AVAILABLE</b></span></div>
      </section>
    </div>
  )
}

function TransactionsPage() {
  const [tab, setTab] = useState<TransactionTab>('TRADES')
  const activity = buildLeagueActivity(officialDraft202627, kileNOthersTransactions)
  return (
    <div className="page-stack">
      <section className="page-intro"><p className="dashboard-kicker">Project tracker</p><h2>Transactions</h2><p>Only a transaction marked PROCESSED changes current rosters. The immutable draft always remains unchanged.</p></section>
      <div className="transaction-tabs" aria-label="Transaction category">
        {(['TRADES', 'WAIVERS', 'FREE AGENTS', 'ACTIVITY'] as const).map((item) => <button type="button" key={item} className={tab === item ? 'active' : ''} onClick={() => setTab(item)}>{item}</button>)}
      </div>
      <section className="dashboard-card transaction-panel">
        {tab === 'ACTIVITY' ? <ol className="activity-list long">{activity.map((event) => <li key={event.id}><span>{event.gameweek === null ? 'DRAFT' : `GW${event.gameweek}`}</span><strong>{event.description}</strong></li>)}</ol> : <div className="empty-state"><strong>No {tab.toLocaleLowerCase()} recorded</strong><p>This tracker never submits or automates an official FPL transaction.</p></div>}
      </section>
    </div>
  )
}

function PlayersPage({ rosters }: { readonly rosters: readonly CurrentLeagueRoster[] }) {
  const [players, setPlayers] = useState<readonly Player[]>([])
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [position, setPosition] = useState<Position | 'ALL'>('ALL')

  useEffect(() => {
    let active = true
    loadFplPlayerData().then((response) => {
      if (active) setPlayers(response.players)
    }).catch((reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason.message : 'Player directory is unavailable')
    })
    return () => { active = false }
  }, [])

  const directory = useMemo(
    () => buildPlayerOwnershipDirectory(players, rosters, officialDraft202627),
    [players, rosters],
  )
  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase()
    return directory.filter((entry) =>
      (position === 'ALL' || entry.player.position === position) &&
      (query === '' || entry.player.displayName.toLocaleLowerCase().includes(query) || entry.ownerName.toLocaleLowerCase().includes(query)),
    )
  }, [directory, position, search])

  return (
    <div className="page-stack">
      <section className="page-intro"><p className="dashboard-kicker">League directory</p><h2>Players &amp; ownership</h2><p>Ownership is derived from the official draft plus processed project transactions.</p></section>
      <section className="dashboard-card player-directory">
        <div className="player-tools"><input type="search" aria-label="Search players or owners" placeholder="Search players or owners" value={search} onChange={(event) => setSearch(event.target.value)} /><div>{(['ALL', ...POSITION_ORDER] as const).map((item) => <button type="button" key={item} className={position === item ? 'active' : ''} onClick={() => setPosition(item)}>{item}</button>)}</div></div>
        {error !== null ? <div className="empty-state"><strong>Live player directory unavailable</strong><p>{error}</p></div> : players.length === 0 ? <div className="empty-state"><strong>Loading verified FPL players…</strong></div> : <div className="directory-scroll"><table><thead><tr><th>Player</th><th>Pos</th><th>Club</th><th>Owner</th><th>Official</th><th>Original pick</th><th>Draft MVP</th></tr></thead><tbody>{filtered.map((entry: PlayerOwnershipEntry) => <tr key={entry.player.id}><td><strong>{entry.player.displayName}</strong></td><td><span className={`player-position position-${entry.player.position.toLowerCase()}`}>{entry.player.position}</span></td><td>{entry.player.club.shortName}</td><td><b className={entry.ownerManagerId === null ? 'free-agent-owner' : ''}>{entry.ownerName}</b></td><td>{entry.player.officialDraftRank ?? '—'}</td><td>{entry.originalDraftPick ?? '—'}</td><td>{entry.draftDayMvpRank ?? '—'}</td></tr>)}</tbody></table></div>}
      </section>
    </div>
  )
}

function DraftArchivePage({ rosters }: { readonly rosters: readonly CurrentLeagueRoster[] }) {
  const metadata = officialDraft202627.rankingSnapshotMetadata
  return (
    <div className="page-stack">
      <section className="archive-banner"><p className="dashboard-kicker">Official draft</p><h2>Immutable historical record</h2><p>90 picks · six complete squads · captured {new Date(officialDraft202627.completedAt).toLocaleString()}</p></section>
      <section className="archive-metadata">
        <article><span>Source commit</span><strong>{officialDraft202627.sourceCommit.slice(0, 12)}</strong></article>
        <article><span>Ranking heuristic</span><strong>{metadata.heuristicVersion}</strong></article>
        <article><span>Ranking weights</span><strong>70% official · 30% model</strong></article>
        <article><span>Evidence</span><strong>{metadata.liveSnapshot.playerCount} players · {metadata.modelArtifact.modelSignalCount} model signals</strong></article>
      </section>
      <section className="dashboard-card">
        <div className="card-heading"><div><p className="dashboard-kicker">Final squads</p><h2>Draft result</h2></div><span>Read only</span></div>
        <div className="manager-completeness">{rosters.map((roster) => <article key={roster.managerId}><strong>{roster.managerName}</strong><span>15/15</span><small>{POSITION_ORDER.map((position) => `${position} ${roster.positionCounts[position]}`).join(' · ')}</small></article>)}</div>
      </section>
      <section className="dashboard-card archive-table">
        <div className="card-heading"><div><p className="dashboard-kicker">Complete history</p><h2>Picks 1–90</h2></div><span>Draft Room code retained separately</span></div>
        <div className="directory-scroll"><table><thead><tr><th>Pick</th><th>Round</th><th>Manager</th><th>Player</th><th>Pos</th><th>Club</th><th>Official</th><th>Model</th><th>Draft MVP</th></tr></thead><tbody>{officialDraft202627.picks.map((pick) => <tr key={pick.overallPickNumber}><td><strong>#{pick.overallPickNumber}</strong></td><td>{pick.roundNumber}</td><td>{pick.managerName}</td><td><strong>{pick.playerName}</strong></td><td><span className={`player-position position-${pick.position.toLowerCase()}`}>{pick.position}</span></td><td>{pick.club.shortName}</td><td>{pick.officialDraftRankAtDraft ?? '—'}</td><td>{pick.modelRankAtDraft ?? '—'}</td><td>{pick.mvpConsensusRankAtDraft ?? '—'}</td></tr>)}</tbody></table></div>
      </section>
    </div>
  )
}

function LeagueDashboard() {
  const [view, setView] = useState<LeagueView>('league')
  const rosters = useMemo(
    () => deriveCurrentLeagueRosters(officialDraft202627, kileNOthersTransactions),
    [],
  )
  const vukRoster = rosters.find(({ managerId }) => managerId === officialDraft202627.leagueSettings.userManagerId) ?? rosters[0]
  const currentTitle = navigation.find(([id]) => id === view)?.[1] ?? 'League'

  return (
    <div className="league-dashboard-shell">
      <aside className="league-sidebar">
        <div className="league-brand"><span>2026/27</span><strong>Kile N Others</strong><small>FPL Draft League Dashboard</small></div>
        <nav aria-label="League dashboard">{navigation.map(([id, label]) => <button type="button" key={id} className={view === id ? 'active' : ''} aria-current={view === id ? 'page' : undefined} onClick={() => setView(id)}><i aria-hidden="true" />{label}</button>)}</nav>
        <div className="sidebar-status"><span>Official draft</span><strong>Frozen · 90/90</strong><small>Historical base state</small></div>
      </aside>
      <main className="league-main">
        <header className="league-topbar"><div><p className="dashboard-kicker">Kile N Others · 2026/27</p><h1>{currentTitle}</h1></div><div className="season-pill"><i /> Official draft archived</div></header>
        {view === 'league' && <LeagueHome rosters={rosters} onArchive={() => setView('draft-archive')} />}
        {view === 'my-team' && <SquadPitch roster={vukRoster} title="Vuk's squad" />}
        {view === 'teams' && <TeamsPage rosters={rosters} />}
        {view === 'matchday' && <MatchdayPage rosters={rosters} />}
        {view === 'players' && <PlayersPage rosters={rosters} />}
        {view === 'transactions' && <TransactionsPage />}
        {view === 'draft-archive' && <DraftArchivePage rosters={rosters} />}
      </main>
    </div>
  )
}

export default LeagueDashboard
