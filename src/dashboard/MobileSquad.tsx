import type { CurrentLeagueRoster } from '../domain/transactions.ts'
import type { LeagueDashboardModel } from './useLeagueDashboardModel.ts'

interface MobileSquadProps {
  readonly model: LeagueDashboardModel
  readonly roster: CurrentLeagueRoster
  readonly title: string
  readonly showRosterCapacity?: boolean
}

export function MobileSquad({
  model,
  roster,
  title,
  showRosterCapacity = false,
}: MobileSquadProps) {
  return (
    <section className="mobile-squad" data-mobile-squad aria-label={`${roster.managerName} squad`}>
      <header className="mobile-squad-heading">
        <div>
          <p className="mobile-eyebrow">Current roster · not a Gameweek XI</p>
          <h2>{title}</h2>
          <small>Availability and fixtures are not connected.</small>
        </div>
        {showRosterCapacity && <strong>{roster.players.length}/15</strong>}
      </header>

      {showRosterCapacity && (
        <div className="mobile-squad-counts" aria-label="Squad position counts">
          {model.positions.map((position) => (
            <div key={position}>
              <span>{position}</span>
              <strong>{roster.positionCounts[position]}/{model.rosterRequirements[position]}</strong>
            </div>
          ))}
        </div>
      )}

      <div className="mobile-position-sections">
        {model.positions.map((position) => (
          <section className="mobile-position-section" key={position} aria-labelledby={`position-${roster.managerId}-${position}`}>
            <h3 id={`position-${roster.managerId}-${position}`}>{position}</h3>
            <div className="mobile-player-grid">
              {roster.players.filter((player) => player.position === position).map((player) => (
                <article className="mobile-player-card" key={player.playerId}>
                  <div className="mobile-player-identity">
                    <span className={`mobile-position-badge position-${player.position.toLowerCase()}`}>{player.position}</span>
                    <div>
                      <h4>{player.displayName}</h4>
                      <p>{player.club.shortName}</p>
                    </div>
                  </div>
                  <dl>
                    <div><dt>Pick</dt><dd>#{player.originalDraftPick ?? '—'}</dd></div>
                    <div><dt>MVP</dt><dd>#{player.draftDayMvpRank ?? '—'}</dd></div>
                  </dl>
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>

      <aside className="mobile-lineup-note" data-lineup-preview="unavailable">
        <strong>No submitted Gameweek XI connected</strong>
        <p>Position groups show the current roster only, not starters, formation or bench order.</p>
      </aside>
    </section>
  )
}
