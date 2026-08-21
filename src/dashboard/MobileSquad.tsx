import type { CurrentLeagueRoster } from '../domain/transactions.ts'
import type { LeagueDashboardModel } from './useLeagueDashboardModel.ts'

interface MobileSquadProps {
  readonly model: LeagueDashboardModel
  readonly roster: CurrentLeagueRoster
  readonly title: string
}

export function MobileSquad({ model, roster, title }: MobileSquadProps) {
  return (
    <section className="mobile-squad" data-mobile-squad aria-label={`${roster.managerName} squad`}>
      <header className="mobile-squad-heading">
        <div>
          <p className="mobile-eyebrow">Squad · not a Gameweek XI</p>
          <h2>{title}</h2>
        </div>
        <strong>{roster.players.length}/15</strong>
      </header>

      <div className="mobile-squad-counts" aria-label="Squad position counts">
        {model.positions.map((position) => (
          <div key={position}>
            <span>{position}</span>
            <strong>{roster.positionCounts[position]}/{model.rosterRequirements[position]}</strong>
          </div>
        ))}
      </div>

      <div className="mobile-position-sections">
        {model.positions.map((position) => (
          <section className="mobile-position-section" key={position} aria-labelledby={`position-${roster.managerId}-${position}`}>
            <h3 id={`position-${roster.managerId}-${position}`}>{position}</h3>
            <div className="mobile-player-grid">
              {roster.players.filter((player) => player.position === position).map((player) => (
                <article className="mobile-player-card" key={player.playerId}>
                  <span className={`mobile-position-badge position-${player.position.toLowerCase()}`}>{player.position}</span>
                  <h4>{player.displayName}</h4>
                  <p>{player.club.shortName}</p>
                  <dl>
                    <div><dt>Original pick</dt><dd>#{player.originalDraftPick ?? '—'}</dd></div>
                    <div><dt>Draft MVP</dt><dd>#{player.draftDayMvpRank ?? '—'}</dd></div>
                  </dl>
                  <div className="mobile-player-status">
                    <span>Availability not connected</span>
                    <span>Fixture not connected</span>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>

      <aside className="mobile-lineup-note">
        <p className="mobile-eyebrow">Gameweek lineup &amp; bench</p>
        <h3>Not connected</h3>
        <p>The role-grouped squad above does not imply starters or bench order. Official Gameweek lineup data must be verified first.</p>
      </aside>
    </section>
  )
}
