import { useState, type CSSProperties } from 'react'

import type {
  EnrichedGameweekPlayer,
  EnrichedGameweekTeam,
  LeagueGameweekExperience,
  PlannerLineup,
} from '../domain/gameweekExperience.ts'
import type { LeagueDashboardModel } from './useLeagueDashboardModel.ts'
import './GameweekTeamExperience.css'

type LineupPresentation = 'PITCH' | 'LIST'

interface GameweekTeamExperienceProps {
  readonly model: LeagueDashboardModel
  readonly team: EnrichedGameweekTeam | null
  readonly privatePlanner: boolean
}

function formatNullableNumber(value: number | null, suffix = ''): string {
  return value === null ? '—' : `${value}${suffix}`
}

function playerInitial(player: EnrichedGameweekPlayer): string {
  return player.name.trim().charAt(0).toLocaleUpperCase()
}

function formatFreshness(experience: LeagueGameweekExperience): string {
  const ageMs = experience.freshness?.ageMs ?? 0
  const age = ageMs < 60_000
    ? `${Math.floor(ageMs / 1000)}s ago`
    : `${Math.floor(ageMs / 60_000)}m ago`
  const label = experience.freshness?.status === 'STALE'
    ? 'STALE'
    : experience.phase === 'ACTIVE'
      ? 'LIVE'
      : 'FRESH'
  return `${label} · updated ${age}`
}

function PlayerTile({
  player,
  selected,
  interactive,
  onSelect,
}: {
  readonly player: EnrichedGameweekPlayer
  readonly selected: boolean
  readonly interactive: boolean
  readonly onSelect?: (playerId: string) => void
}) {
  const content = (
    <>
      <span className="gameweek-player-avatar" aria-hidden="true">{playerInitial(player)}</span>
      <span className="gameweek-player-name">{player.name}</span>
      <small>{player.clubShortName} · {player.position}</small>
      {player.liveGameweekPoints !== null && (
        <strong className="gameweek-player-points">{player.liveGameweekPoints} pts</strong>
      )}
    </>
  )
  return interactive
    ? (
        <button
          type="button"
          className={`gameweek-player-tile${selected ? ' selected' : ''}`}
          aria-pressed={selected}
          aria-label={`${selected ? 'Selected' : 'Select'} ${player.name} for planner swap`}
          onClick={() => onSelect?.(player.id)}
        >
          {content}
        </button>
      )
    : <article className="gameweek-player-tile">{content}</article>
}

function PitchLine({
  position,
  players,
  planner,
  selectedPlayerId,
  onSelect,
}: {
  readonly position: EnrichedGameweekPlayer['position']
  readonly players: readonly EnrichedGameweekPlayer[]
  readonly planner: boolean
  readonly selectedPlayerId: string | null
  readonly onSelect?: (playerId: string) => void
}) {
  return (
    <section className="gameweek-pitch-line" aria-label={`${position} players`}>
      <span className="gameweek-line-label">{position}</span>
      <div style={{ '--line-count': players.length } as CSSProperties}>
        {players.map((player) => (
          <PlayerTile
            key={player.id}
            player={player}
            interactive={planner}
            selected={selectedPlayerId === player.id}
            onSelect={onSelect}
          />
        ))}
      </div>
    </section>
  )
}

function PitchView({
  starters,
  planner,
  selectedPlayerId,
  onSelect,
}: {
  readonly starters: readonly EnrichedGameweekPlayer[]
  readonly planner: boolean
  readonly selectedPlayerId: string | null
  readonly onSelect?: (playerId: string) => void
}) {
  return (
    <div className="gameweek-pitch" data-gameweek-presentation="pitch">
      <div className="gameweek-pitch-markings" aria-hidden="true" />
      {(['FWD', 'MID', 'DEF', 'GK'] as const).map((position) => (
        <PitchLine
          key={position}
          position={position}
          players={starters.filter((player) => player.position === position)}
          planner={planner}
          selectedPlayerId={selectedPlayerId}
          onSelect={onSelect}
        />
      ))}
    </div>
  )
}

function ListView({
  starters,
  bench,
  planner,
  selectedPlayerId,
  onSelect,
}: {
  readonly starters: readonly EnrichedGameweekPlayer[]
  readonly bench: readonly EnrichedGameweekPlayer[]
  readonly planner: boolean
  readonly selectedPlayerId: string | null
  readonly onSelect?: (playerId: string) => void
}) {
  return (
    <div className="gameweek-lineup-list" data-gameweek-presentation="list">
      {[...starters, ...bench].map((player) => {
        const row = (
          <>
            <span className={`player-position position-${player.position.toLowerCase()}`}>{player.position}</span>
            <span className="gameweek-list-identity"><strong>{player.name}</strong><small>{player.clubShortName} · {player.role === 'BENCH' ? `Bench ${player.benchOrder}` : 'Starter'}</small></span>
            <span className="gameweek-list-season gameweek-list-form"><small>Form</small><b>{formatNullableNumber(player.form)}</b></span>
            <span className="gameweek-list-season gameweek-list-total"><small>Season</small><b>{formatNullableNumber(player.totalPoints)}</b></span>
            <span className="gameweek-list-points"><small>GW</small><strong>{formatNullableNumber(player.liveGameweekPoints)}</strong></span>
          </>
        )
        return planner
          ? (
              <button
                type="button"
                key={player.id}
                className={`gameweek-list-row${selectedPlayerId === player.id ? ' selected' : ''}`}
                aria-pressed={selectedPlayerId === player.id}
                onClick={() => onSelect?.(player.id)}
              >{row}</button>
            )
          : <article className="gameweek-list-row" key={player.id}>{row}</article>
      })}
    </div>
  )
}

function Bench({
  players,
  planner,
  selectedPlayerId,
  onSelect,
}: {
  readonly players: readonly EnrichedGameweekPlayer[]
  readonly planner: boolean
  readonly selectedPlayerId: string | null
  readonly onSelect?: (playerId: string) => void
}) {
  return (
    <section className="gameweek-bench" aria-label="Ordered bench">
      <div className="gameweek-section-heading"><div><p>Ordered bench</p><h3>GK · 1 · 2 · 3</h3></div></div>
      <div className="gameweek-bench-grid">
        {players.map((player, index) => (
          <div className="gameweek-bench-slot" key={player.id}>
            <span>{index === 0 ? 'GK' : index}</span>
            <PlayerTile
              player={player}
              interactive={planner}
              selected={selectedPlayerId === player.id}
              onSelect={onSelect}
            />
          </div>
        ))}
      </div>
    </section>
  )
}

function CurrentRoster({ players }: { readonly players: readonly EnrichedGameweekPlayer[] }) {
  return (
    <section className="gameweek-current-roster" aria-label="Current official roster">
      <div className="gameweek-section-heading"><div><p>Official ownership</p><h3>Current 15-player roster</h3></div><span>Read only</span></div>
      <div className="gameweek-lineup-list">
        {players.map((player) => (
          <article className="gameweek-list-row" key={player.id}>
            <span className={`player-position position-${player.position.toLowerCase()}`}>{player.position}</span>
            <span className="gameweek-list-identity"><strong>{player.name}</strong><small>{player.clubShortName}</small></span>
            <span className="gameweek-list-season gameweek-list-form"><small>Form</small><b>{formatNullableNumber(player.form)}</b></span>
            <span className="gameweek-list-season gameweek-list-total"><small>Season</small><b>{formatNullableNumber(player.totalPoints)}</b></span>
            <span className="gameweek-list-points"><small>Draft</small><strong>{formatNullableNumber(player.officialDraftRank)}</strong></span>
          </article>
        ))}
      </div>
    </section>
  )
}

function ExperienceUnavailable({ model }: { readonly model: LeagueDashboardModel }) {
  const loading = model.playerDirectory.players.length === 0
    || model.gameweek.refresh.status === 'IDLE'
    || model.gameweek.refresh.status === 'LOADING'
  return (
    <section className="gameweek-experience-state" data-gameweek-state={loading ? 'loading' : 'unavailable'}>
      <p>{loading ? 'Loading official Gameweek data…' : 'Official Gameweek experience unavailable'}</p>
      {!loading && <span>{model.gameweek.error ?? model.playerDirectory.error ?? 'The official sources could not be verified.'}</span>}
      {!loading && <button type="button" onClick={model.gameweek.refreshNow}>Try again</button>}
    </section>
  )
}

export function GameweekTeamExperience({ model, team, privatePlanner }: GameweekTeamExperienceProps) {
  const [presentation, setPresentation] = useState<LineupPresentation>('PITCH')
  const experience = model.gameweek.experience
  if (experience === null || team === null) return <ExperienceUnavailable model={model} />

  const isPlanner = experience.mode === 'PLANNER' && privatePlanner
  const showRosterOnly = experience.mode === 'PLANNER' && !privatePlanner
  const planner: PlannerLineup | null = isPlanner ? model.gameweek.planner : null
  const starters = planner?.starters ?? team.officialLineup.starters
  const bench = planner?.bench ?? team.officialLineup.bench
  const formation = planner?.formation ?? team.officialLineup.formation

  if (experience.mode === 'UNAVAILABLE') {
    return (
      <section className="gameweek-experience-state" data-gameweek-state="unavailable">
        <p>Gameweek {experience.eventId} official lineup is not available yet.</p>
        <span>The deadline has passed, but the verified official entry endpoint has not moved to this Gameweek. No older lineup is substituted.</span>
      </section>
    )
  }

  return (
    <section className="gameweek-experience" data-gameweek-mode={isPlanner ? 'planner' : showRosterOnly ? 'roster' : 'official'}>
      <header className="gameweek-experience-header">
        <div>
          <p>{isPlanner ? 'Private decision workspace' : showRosterOnly ? 'League-visible current roster' : 'Official FPL Draft lineup'}</p>
          <h2>Gameweek {experience.eventId}</h2>
          <span className={`gameweek-freshness freshness-${experience.freshness?.status.toLowerCase()}`}>
            {formatFreshness(experience)} · {isPlanner || showRosterOnly ? 'official ownership' : 'provisional scoring'}
          </span>
        </div>
        {!showRosterOnly && (
          <div className="gameweek-score-block">
            <span>{isPlanner ? 'Formation test' : 'LIVE GW points'}</span>
            <strong>{isPlanner ? formation : `${team.officialLineup.liveGameweekScore}`}</strong>
            {!isPlanner && <small>points</small>}
          </div>
        )}
      </header>

      {experience.refreshStatus === 'ERROR' && (
        <div className="gameweek-refresh-warning" role="status">
          Refresh failed. Showing the last verified {experience.freshness?.status === 'STALE' ? 'stale' : 'recent'} data.
        </div>
      )}

      {showRosterOnly
        ? <CurrentRoster players={team.currentRoster} />
        : planner === null && isPlanner
          ? <div className="gameweek-refresh-warning">{model.gameweek.plannerError ?? 'Decision workspace unavailable.'}</div>
          : (
              <>
                <div className="gameweek-view-toolbar">
                  <div>
                    <strong>{isPlanner ? `${formation} experiment` : `${formation} official formation`}</strong>
                    <small>{isPlanner ? 'Select two players to test a valid swap. Nothing is submitted to FPL.' : 'XI and bench come from the official entry/Gameweek read.'}</small>
                  </div>
                  <div className="gameweek-view-switch" aria-label="Lineup view">
                    {(['PITCH', 'LIST'] as const).map((view) => (
                      <button type="button" key={view} className={presentation === view ? 'active' : ''} aria-pressed={presentation === view} onClick={() => setPresentation(view)}>{view === 'PITCH' ? 'Pitch' : 'List'}</button>
                    ))}
                  </div>
                </div>
                {model.gameweek.plannerError !== null && isPlanner && (
                  <div className="gameweek-planner-error" role="alert">{model.gameweek.plannerError}</div>
                )}
                {presentation === 'PITCH'
                  ? <PitchView starters={starters} planner={isPlanner} selectedPlayerId={model.gameweek.plannerSelectedPlayerId} onSelect={model.gameweek.selectPlannerPlayer} />
                  : <ListView starters={starters} bench={bench} planner={isPlanner} selectedPlayerId={model.gameweek.plannerSelectedPlayerId} onSelect={model.gameweek.selectPlannerPlayer} />}
                {presentation === 'PITCH' && <Bench players={bench} planner={isPlanner} selectedPlayerId={model.gameweek.plannerSelectedPlayerId} onSelect={model.gameweek.selectPlannerPlayer} />}
              </>
            )}
    </section>
  )
}
