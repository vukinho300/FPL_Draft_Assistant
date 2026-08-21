import type { ReactNode } from 'react'

import type { Position } from '../domain/player.ts'
import type { PlayerOwnershipEntry } from '../domain/transactions.ts'
import {
  getPlayerDirectoryName,
  PLAYER_DIRECTORY_SORTS,
  PLAYER_OWNERSHIP_FILTERS,
  type PlayerDirectorySort,
  type PlayerOwnershipFilter,
} from './playerDirectory.ts'
import type { LeagueDashboardModel } from './useLeagueDashboardModel.ts'

function MobilePageIntro({ eyebrow, title, children }: {
  readonly eyebrow: string
  readonly title: string
  readonly children: ReactNode
}) {
  return (
    <section className="mobile-page-intro">
      <p className="mobile-eyebrow">{eyebrow}</p>
      <h2>{title}</h2>
      <p>{children}</p>
    </section>
  )
}

function MobileCard({ children, className = '' }: { readonly children: ReactNode; readonly className?: string }) {
  return <section className={`mobile-card ${className}`.trim()}>{children}</section>
}

export function MobilePlayersPage({ model }: { readonly model: LeagueDashboardModel }) {
  const directory = model.playerDirectory
  return (
    <div className="mobile-page-stack">
      <MobilePageIntro eyebrow="League directory" title="Players & ownership">
        Ownership is derived from the official draft plus processed project transactions.
      </MobilePageIntro>
      <MobileCard className="mobile-player-directory">
        <div className="mobile-player-tools">
          <input
            type="search"
            aria-label="Search players or owners"
            placeholder="Search players or owners"
            value={directory.search}
            onChange={(event) => directory.setSearch(event.target.value)}
          />
          <div className="mobile-position-filters" aria-label="Filter players by position">
            {(['ALL', ...model.positions] as const).map((position: Position | 'ALL') => (
              <button
                type="button"
                key={position}
                className={directory.position === position ? 'active' : ''}
                aria-pressed={directory.position === position}
                onClick={() => directory.setPosition(position)}
              >
                {position}
              </button>
            ))}
          </div>
          <div className="mobile-ownership-filters" aria-label="Filter players by ownership">
            {PLAYER_OWNERSHIP_FILTERS.map((ownership: PlayerOwnershipFilter) => (
              <button
                type="button"
                key={ownership}
                className={directory.ownership === ownership ? 'active' : ''}
                aria-pressed={directory.ownership === ownership}
                onClick={() => directory.setOwnership(ownership)}
              >
                {ownership === 'FREE_AGENTS' ? 'Free Agents' : ownership}
              </button>
            ))}
          </div>
          <label className="mobile-player-sort">
            <span>Sort by</span>
            <select
              aria-label="Sort players"
              value={directory.sort}
              onChange={(event) => directory.setSort(event.target.value as PlayerDirectorySort)}
            >
              {PLAYER_DIRECTORY_SORTS.map((sort) => (
                <option key={sort} value={sort}>
                  {sort === 'OFFICIAL' ? 'Official Draft rank' : sort === 'MVP' ? 'Draft MVP rank' : 'Model rank at draft'}
                </option>
              ))}
            </select>
          </label>
        </div>
        {directory.error !== null
          ? <div className="mobile-empty-state"><strong>Live player directory unavailable</strong><p>{directory.error}</p></div>
          : directory.players.length === 0
            ? <div className="mobile-empty-state"><strong>Loading verified FPL players…</strong><p>Player data is requested from the project FPL boundary.</p></div>
            : <div className="mobile-directory-list">{directory.filtered.map((entry: PlayerOwnershipEntry) => <MobilePlayerCard entry={entry} key={entry.player.id} />)}</div>}
      </MobileCard>
    </div>
  )
}

function MobilePlayerCard({ entry }: { readonly entry: PlayerOwnershipEntry }) {
  return (
    <article className="mobile-directory-player">
      <header>
        <div><h3>{getPlayerDirectoryName(entry)}</h3><span>{entry.player.club.shortName}</span></div>
        <span className={`mobile-position-badge position-${entry.player.position.toLowerCase()}`}>{entry.player.position}</span>
      </header>
      <dl>
        <div><dt>Owner</dt><dd>{entry.ownerName}</dd></div>
        <div><dt>Official rank</dt><dd>{entry.player.officialDraftRank ?? '—'}</dd></div>
        <div><dt>Original pick</dt><dd>{entry.originalDraftPick ?? '—'}</dd></div>
        <div><dt>Draft MVP</dt><dd>{entry.draftDayMvpRank ?? '—'}</dd></div>
        <div><dt>Model at draft</dt><dd>{entry.modelRankAtDraft ?? '—'}</dd></div>
      </dl>
    </article>
  )
}

export function MobileTransactionsPage({ model }: { readonly model: LeagueDashboardModel }) {
  return (
    <div className="mobile-page-stack">
      <MobilePageIntro eyebrow="Project tracker" title="Transactions">
        Only a transaction marked PROCESSED changes current rosters. The official draft remains unchanged.
      </MobilePageIntro>
      <div className="mobile-transaction-tabs" aria-label="Transaction category">
        {model.transactionTabs.map((tab) => (
          <button
            type="button"
            key={tab}
            className={model.transactionTab === tab ? 'active' : ''}
            aria-pressed={model.transactionTab === tab}
            onClick={() => model.setTransactionTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>
      <MobileCard className="mobile-transaction-panel">
        {model.transactionTab === 'ACTIVITY'
          ? model.recentTransactions.length === 0
            ? <MobileEmptyState title="No recorded league transactions" detail="Processed trades, waivers and free-agent moves will appear here." />
            : <ol className="mobile-transaction-list">{model.recentTransactions.map((event) => <li key={event.id}><span>{event.gameweek === null ? 'League' : `GW${event.gameweek}`}</span><strong>{event.description}</strong></li>)}</ol>
          : <MobileEmptyState title={`No ${model.transactionTab.toLocaleLowerCase()} recorded`} detail="This companion never submits or automates an official FPL transaction." />}
      </MobileCard>
    </div>
  )
}

function MobileEmptyState({ title, detail }: { readonly title: string; readonly detail: string }) {
  return <div className="mobile-empty-state"><strong>{title}</strong><p>{detail}</p></div>
}

export function MobileDraftArchivePage({ model }: { readonly model: LeagueDashboardModel }) {
  const picksByRound = new Map<number, (typeof model.archive.picks)[number][]>()
  model.archive.picks.forEach((pick) => {
    const picks = picksByRound.get(pick.roundNumber) ?? []
    picksByRound.set(pick.roundNumber, [...picks, pick])
  })
  const metadata = model.archive.metadata
  return (
    <div className="mobile-page-stack">
      <section className="mobile-archive-hero">
        <p className="mobile-eyebrow">Official draft</p>
        <h2>Immutable historical record</h2>
        <p>90 picks · six complete squads · captured {new Date(model.archive.completedAt).toLocaleString()}</p>
      </section>
      <section className="mobile-archive-summary" aria-label="Draft summary">
        <MobileCard><span>Draft status</span><strong>Frozen</strong></MobileCard>
        <MobileCard><span>Source commit</span><strong>{model.archive.sourceCommit.slice(0, 12)}</strong></MobileCard>
        <MobileCard><span>Ranking heuristic</span><strong>{metadata.heuristicVersion}</strong></MobileCard>
        <MobileCard><span>Evidence</span><strong>{metadata.liveSnapshot.playerCount} players</strong></MobileCard>
      </section>
      <section className="mobile-archive-picks" aria-label="Draft picks 1 to 90">
        <div className="mobile-section-heading"><p className="mobile-eyebrow">Complete history</p><h2>Picks 1–90</h2></div>
        {[...picksByRound.entries()].map(([round, picks], index) => (
          <details key={round} open={index === 0}>
            <summary>Round {round}<span>{picks.length} picks</span></summary>
            <div>{picks.map((pick) => (
              <article className="mobile-draft-pick" key={pick.overallPickNumber}>
                <header><span>Pick #{pick.overallPickNumber}</span><strong>{pick.playerName}</strong><i className={`position-${pick.position.toLowerCase()}`}>{pick.position}</i></header>
                <dl><div><dt>Manager</dt><dd>{pick.managerName}</dd></div><div><dt>Club</dt><dd>{pick.club.shortName}</dd></div><div><dt>Official</dt><dd>{pick.officialDraftRankAtDraft ?? '—'}</dd></div><div><dt>Model</dt><dd>{pick.modelRankAtDraft ?? '—'}</dd></div><div><dt>Draft MVP</dt><dd>{pick.mvpConsensusRankAtDraft ?? '—'}</dd></div></dl>
              </article>
            ))}</div>
          </details>
        ))}
      </section>
    </div>
  )
}
