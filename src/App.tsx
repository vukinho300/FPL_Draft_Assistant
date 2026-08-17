import { useEffect, useMemo, useState } from 'react'

import './App.css'
import { currentDraftRankingArtifact } from './data/currentDraftRanking.ts'
import { calculateBestFit } from './domain/bestFit.ts'
import { calculateBestPair } from './domain/bestPair.ts'
import {
  deriveDraftState,
  DraftPickError,
  recordDraftPick,
  undoLastDraftPick,
  validatePickHistory,
  type DraftPick,
} from './domain/draftState.ts'
import {
  filterAvailableRankedPlayers,
  rankPlayersByMvpConsensus,
} from './domain/draftRanking.ts'
import {
  generateSnakeDraftSchedule,
  getCurrentDraftSlot,
  getManagerPickNumbers,
  getTurnHorizon,
} from './domain/draftSchedule.ts'
import {
  MAX_LEAGUE_SIZE,
  MIN_LEAGUE_SIZE,
  POSITION_ORDER,
  ROSTER_REQUIREMENTS,
} from './domain/league.ts'
import {
  createDraftConfiguration,
  getManagerDraftPosition,
  type DraftConfiguration,
  type Manager,
} from './domain/manager.ts'
import type { Position } from './domain/player.ts'
import { loadFplPlayerData } from './services/fpl/browserClient.ts'
import type { FplPlayerDataResponse } from './services/fpl/contract.ts'
import {
  clearDraftSession,
  loadDraftSession,
  saveDraftSession,
} from './storage/draftSessionStorage.ts'

const defaultManagerNames = ['Vuk', 'Diego', 'Kristian', 'Miku', 'Tin', 'Deni']
const leagueSizes = Array.from(
  { length: MAX_LEAGUE_SIZE - MIN_LEAGUE_SIZE + 1 },
  (_, index) => MIN_LEAGUE_SIZE + index,
)

interface InitialSession {
  managers: Manager[]
  userManagerId: string
  pickHistory: readonly DraftPick[]
  persistenceError: string | null
}

function createDefaultManagers(count = 6): Manager[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `demo-manager-${index + 1}`,
    displayName: defaultManagerNames[index] ?? `Manager ${index + 1}`,
  }))
}

function initialSession(): InitialSession {
  if (typeof window === 'undefined') {
    return {
      managers: createDefaultManagers(),
      userManagerId: 'demo-manager-1',
      pickHistory: [],
      persistenceError: null,
    }
  }
  const loaded = loadDraftSession(window.localStorage)
  if (loaded?.snapshot !== undefined && loaded.snapshot !== null) {
    return {
      managers: [...loaded.snapshot.managers],
      userManagerId: loaded.snapshot.userManagerId,
      pickHistory: loaded.snapshot.pickHistory,
      persistenceError: null,
    }
  }
  return {
    managers: createDefaultManagers(),
    userManagerId: 'demo-manager-1',
    pickHistory: [],
    persistenceError: loaded?.error ?? null,
  }
}

function displayName(configuration: DraftConfiguration, managerId: string): string {
  return (
    configuration.managers.find((manager) => manager.id === managerId)?.displayName ??
    managerId
  )
}

function resizeManagers(current: readonly Manager[], count: number): Manager[] {
  if (count <= current.length) return current.slice(0, count)
  const next = [...current]
  const usedIds = new Set(next.map(({ id }) => id))
  while (next.length < count) {
    const slot = next.length + 1
    let id = `demo-manager-${slot}`
    while (usedIds.has(id)) id = `${id}-new`
    usedIds.add(id)
    next.push({ id, displayName: defaultManagerNames[slot - 1] ?? `Manager ${slot}` })
  }
  return next
}

function App() {
  const initial = useMemo(initialSession, [])
  const [managers, setManagers] = useState<Manager[]>(initial.managers)
  const [userManagerId, setUserManagerId] = useState(initial.userManagerId)
  const [pickHistory, setPickHistory] = useState<readonly DraftPick[]>(initial.pickHistory)
  const [persistenceError, setPersistenceError] = useState<string | null>(initial.persistenceError)
  const [persistenceEnabled, setPersistenceEnabled] = useState(initial.persistenceError === null)
  const [playerData, setPlayerData] = useState<FplPlayerDataResponse | null>(null)
  const [playerLoadError, setPlayerLoadError] = useState<string | null>(null)
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [search, setSearch] = useState('')
  const [positionFilter, setPositionFilter] = useState<Position | 'ALL'>('ALL')
  const [actionError, setActionError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setPlayerLoadError(null)
    loadFplPlayerData()
      .then((response) => {
        if (active) setPlayerData(response)
      })
      .catch((error: unknown) => {
        if (active) {
          setPlayerData(null)
          setPlayerLoadError(error instanceof Error ? error.message : 'Current player data is unavailable')
        }
      })
    return () => {
      active = false
    }
  }, [loadAttempt])

  const draftModel = useMemo(() => {
    try {
      const configuration = createDraftConfiguration(managers, userManagerId)
      const schedule = generateSnakeDraftSchedule(configuration)
      const currentSlot = getCurrentDraftSlot(schedule, pickHistory.length)
      const turnHorizon = getTurnHorizon(schedule, userManagerId, pickHistory.length)
      const rankedPlayers = playerData === null
        ? []
        : rankPlayersByMvpConsensus(playerData.players, currentDraftRankingArtifact.players)
      const draftState = playerData === null
        ? null
        : deriveDraftState(schedule, pickHistory, playerData.players)
      const availableRanked = draftState === null
        ? []
        : filterAvailableRankedPlayers(rankedPlayers, draftState.draftedPlayerIds, '', 'ALL')
      const userRoster = draftState?.rosters[userManagerId]?.players ?? []
      const bestFit = draftState === null
        ? null
        : calculateBestFit(availableRanked, userRoster, schedule, userManagerId, pickHistory.length)
      const bestPair = draftState === null
        ? null
        : calculateBestPair(availableRanked, userRoster, schedule, userManagerId, pickHistory.length)
      return {
        configuration,
        schedule,
        currentSlot,
        turnHorizon,
        rankedPlayers,
        draftState,
        bestFit,
        bestPair,
        draftPosition: getManagerDraftPosition(managers, userManagerId),
        userPickNumbers: getManagerPickNumbers(schedule, userManagerId),
        error: null,
      }
    } catch (error) {
      return {
        configuration: null,
        schedule: null,
        currentSlot: null,
        turnHorizon: null,
        rankedPlayers: [],
        draftState: null,
        bestFit: null,
        bestPair: null,
        draftPosition: null,
        userPickNumbers: [],
        error: error instanceof Error ? error.message : 'Draft configuration is invalid',
      }
    }
  }, [managers, pickHistory, playerData, userManagerId])

  useEffect(() => {
    if (!persistenceEnabled || typeof window === 'undefined') return
    try {
      const configuration = createDraftConfiguration(managers, userManagerId)
      if (playerData !== null) {
        validatePickHistory(generateSnakeDraftSchedule(configuration), pickHistory, playerData.players)
      }
      saveDraftSession(window.localStorage, {
        managers: configuration.managers,
        userManagerId,
        pickHistory,
      })
    } catch {
      // Invalid in-progress manager labels are shown by the domain and are not persisted.
    }
  }, [managers, persistenceEnabled, pickHistory, playerData, userManagerId])

  useEffect(() => {
    if (playerData === null || initial.pickHistory.length === 0) return
    try {
      const configuration = createDraftConfiguration(managers, userManagerId)
      validatePickHistory(generateSnakeDraftSchedule(configuration), pickHistory, playerData.players)
    } catch (error) {
      setPersistenceEnabled(false)
      setPersistenceError(`Saved session cannot be resumed safely: ${error instanceof Error ? error.message : 'invalid history'}`)
    }
  }, [initial.pickHistory.length, managers, pickHistory, playerData, userManagerId])

  const visibleBoard = useMemo(
    () => draftModel.draftState === null
      ? []
      : filterAvailableRankedPlayers(
          draftModel.rankedPlayers,
          draftModel.draftState.draftedPlayerIds,
          search,
          positionFilter,
        ),
    [draftModel, positionFilter, search],
  )

  function resetPicks(): void {
    setPickHistory([])
    setActionError(null)
  }

  function changeManagerCount(count: number): void {
    const next = resizeManagers(managers, count)
    setManagers(next)
    if (!next.some(({ id }) => id === userManagerId)) setUserManagerId(next[0].id)
    resetPicks()
  }

  function moveManager(index: number, direction: -1 | 1): void {
    const destination = index + direction
    if (destination < 0 || destination >= managers.length) return
    const next = [...managers]
    ;[next[index], next[destination]] = [next[destination], next[index]]
    setManagers(next)
    resetPicks()
  }

  function recordPlayer(playerId: string): void {
    if (draftModel.schedule === null || playerData === null) return
    try {
      setPickHistory(recordDraftPick(draftModel.schedule, pickHistory, playerData.players, playerId))
      setActionError(null)
    } catch (error) {
      setActionError(error instanceof DraftPickError ? error.message : 'Unable to record this pick')
    }
  }

  function undo(): void {
    setPickHistory(undoLastDraftPick(pickHistory))
    setActionError(null)
  }

  function resetSession(): void {
    if (typeof window !== 'undefined') clearDraftSession(window.localStorage)
    setManagers(createDefaultManagers())
    setUserManagerId('demo-manager-1')
    setPickHistory([])
    setPersistenceError(null)
    setPersistenceEnabled(true)
    setActionError(null)
  }

  const currentManagerName = draftModel.configuration !== null && draftModel.currentSlot !== null
    ? displayName(draftModel.configuration, draftModel.currentSlot.managerId)
    : null
  const userName = draftModel.configuration === null
    ? 'My manager'
    : displayName(draftModel.configuration, userManagerId)
  const userRoster = draftModel.draftState?.rosters[userManagerId]
  const modelJoinCount = playerData?.players.filter((player) =>
    currentDraftRankingArtifact.players.some(
      (signal) => signal.draftPlayerId === player.id && signal.modelSignalAvailable,
    ),
  ).length ?? 0

  return (
    <main className="draft-room-shell">
      <header className="draft-header">
        <div>
          <p className="eyebrow">Phase 6.1 · Draft-night MVP</p>
          <h1>Draft Room</h1>
          <p className="header-note">
            Official Draft rank leads. Best Fit and Best Pair are deterministic depth stress tests, not survival predictions.
          </p>
        </div>
        <div className="live-status" aria-live="polite">
          <span className={playerData === null ? 'status-dot pending' : 'status-dot'} />
          {playerData === null
            ? playerLoadError === null ? 'Loading live FPL players…' : 'Live data unavailable'
            : `${playerData.playerCount} live players · ${modelJoinCount} model signals`}
        </div>
      </header>

      {persistenceError !== null && (
        <section className="alert error-alert" role="alert">
          <div><strong>Saved session was rejected.</strong><p>{persistenceError}</p></div>
          <button type="button" onClick={resetSession}>Reset to a fresh session</button>
        </section>
      )}
      {playerLoadError !== null && (
        <section className="alert error-alert" role="alert">
          <div><strong>Player board could not load.</strong><p>{playerLoadError}</p></div>
          <button type="button" onClick={() => setLoadAttempt((value) => value + 1)}>Retry</button>
        </section>
      )}
      {draftModel.error !== null && <section className="alert error-alert" role="alert">{draftModel.error}</section>}

      {draftModel.configuration !== null && draftModel.schedule !== null && (
        <>
          <section className="draft-command-bar" aria-label="Current draft state">
            <article className="command-primary">
              <span>Current pick</span>
              <strong>{draftModel.currentSlot === null ? 'Draft complete' : `#${draftModel.currentSlot.overallPickNumber} · ${currentManagerName}`}</strong>
              <small>{draftModel.currentSlot === null ? `${pickHistory.length} selections recorded` : `Round ${draftModel.currentSlot.roundNumber}, pick ${draftModel.currentSlot.pickInRound}`}</small>
            </article>
            <article>
              <span>Next {userName} turn</span>
              <strong>{draftModel.turnHorizon?.upcomingUserTurnPickNumbers.join(' + ') || 'None'}</strong>
              <small>{draftModel.bestFit?.scenario.followingUserPickNumber === null ? 'Final user turn' : `${draftModel.bestFit?.scenario.opponentSelections ?? 0} opponents before pick ${draftModel.bestFit?.scenario.followingUserPickNumber ?? '—'}`}</small>
            </article>
            <article>
              <span>Draft position</span>
              <strong>{draftModel.draftPosition}</strong>
              <small>{draftModel.userPickNumbers.join(', ')}</small>
            </article>
            <button className="undo-button" type="button" onClick={undo} disabled={pickHistory.length === 0}>Undo last pick</button>
          </section>

          <div className="draft-layout">
            <section className="board-panel" aria-labelledby="board-title">
              <div className="section-heading">
                <div><p className="section-label">Available players</p><h2 id="board-title">Ranked board</h2></div>
                <span>{visibleBoard.length} shown</span>
              </div>
              <div className="board-tools">
                <label className="search-control">
                  <span className="sr-only">Search player name</span>
                  <input type="search" placeholder="Search player" value={search} onChange={(event) => setSearch(event.target.value)} />
                </label>
                <div className="position-filters" aria-label="Position filter">
                  {(['ALL', ...POSITION_ORDER] as const).map((position) => (
                    <button type="button" key={position} className={positionFilter === position ? 'active' : ''} onClick={() => setPositionFilter(position)}>{position}</button>
                  ))}
                </div>
              </div>
              {playerData === null ? (
                <div className="board-placeholder">Waiting for the live player board…</div>
              ) : (
                <div className="table-scroll">
                  <table>
                    <thead><tr><th>MVP</th><th>Player</th><th>Pos</th><th>Club</th><th>Official</th><th>Model</th><th><span className="sr-only">Record pick</span></th></tr></thead>
                    <tbody>
                      {visibleBoard.map((entry) => (
                        <tr key={entry.player.id}>
                          <td className="rank-cell">{entry.consensusRank}</td>
                          <td><strong>{entry.player.displayName}</strong></td>
                          <td><span className={`position-chip ${entry.player.position.toLowerCase()}`}>{entry.player.position}</span></td>
                          <td>{entry.player.club.shortName}</td>
                          <td>{entry.player.officialDraftRank ?? '—'}</td>
                          <td className="model-cell">{entry.modelSignal?.modelSignalAvailable ? entry.modelSignal.modelRank : '—'}</td>
                          <td><button className="draft-button" type="button" onClick={() => recordPlayer(entry.player.id)} disabled={draftModel.currentSlot === null} aria-label={`Draft ${entry.player.displayName} for ${currentManagerName ?? 'current manager'}`}>Draft</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {actionError !== null && <p className="inline-error" role="alert">{actionError}</p>}
            </section>

            <aside className="decision-rail">
              <section className="rail-card best-available-card">
                <p className="section-label">Best Available</p>
                {draftModel.bestFit?.bestAvailable === null || draftModel.bestFit === null ? <p>No legal available player.</p> : (
                  <>
                    <h2>{draftModel.bestFit.bestAvailable.player.displayName}</h2>
                    <p>{draftModel.bestFit.bestAvailable.player.position} · {draftModel.bestFit.bestAvailable.player.club.shortName}</p>
                    <div className="evidence-line"><span>MVP #{draftModel.bestFit.bestAvailable.consensusRank}</span><span>Official #{draftModel.bestFit.bestAvailable.player.officialDraftRank ?? '—'}</span></div>
                  </>
                )}
              </section>

              <section className="rail-card best-fit-card">
                <p className="section-label">Best Fit</p>
                <h2>Top 5 for {userName}</h2>
                <p className="scenario-copy">Top-of-board depletion stress test: {draftModel.bestFit?.scenario.opponentSelections ?? 0} opponent selections before the following turn.</p>
                <ol className="recommendation-list">
                  {draftModel.bestFit?.recommendations.map((recommendation, index) => (
                    <li key={recommendation.rankedPlayer.player.id}>
                      <div className="recommendation-title"><strong>{recommendation.rankedPlayer.player.displayName}</strong><span>{recommendation.rankedPlayer.player.position}</span>{index === 0 && <b>Recommended</b>}</div>
                      <div className="evidence-line"><span>MVP #{recommendation.rankedPlayer.consensusRank}</span><span>Official #{recommendation.rankedPlayer.player.officialDraftRank ?? '—'}</span><span>Model #{recommendation.rankedPlayer.modelSignal?.modelRank ?? '—'}</span></div>
                      <ul>{recommendation.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>
                    </li>
                  ))}
                </ol>
              </section>

              {draftModel.bestPair?.active === true && (
                <section className="rail-card best-pair-card">
                  <p className="section-label">Consecutive-turn optimizer</p>
                  <h2>BEST PAIR — PICKS {draftModel.bestPair.scenario.currentUserTurnPickNumbers.join(' + ')}</h2>
                  <p className="scenario-copy">
                    Joint depletion stress test: {draftModel.bestPair.scenario.opponentSelections} opponent selections before Pick {draftModel.bestPair.scenario.followingUserPickNumber ?? '—'}.
                  </p>
                  <ol className="recommendation-list pair-recommendation-list">
                    {draftModel.bestPair.recommendations.slice(0, 3).map((recommendation, index) => (
                      <li key={recommendation.rankedPlayers.map(({ player }) => player.id).join(':')}>
                        <div className="pair-player-line">
                          {recommendation.rankedPlayers.map(({ player, consensusRank }) => (
                            <span key={player.id}><strong>{player.displayName}</strong><small>{player.position} · MVP #{consensusRank}</small></span>
                          ))}
                          {index === 0 && <b>Recommended</b>}
                        </div>
                        <div className="evidence-line">
                          <span>Pair {recommendation.bestPairScore.toFixed(3)}</span>
                          <span>Quality {recommendation.pairQuality.toFixed(3)}</span>
                          <span>Scarcity {recommendation.pairScarcity.toFixed(3)}</span>
                        </div>
                        <ul>{recommendation.reasons.slice(1, 3).map((reason) => <li key={reason}>{reason}</li>)}</ul>
                      </li>
                    ))}
                  </ol>
                </section>
              )}

              <section className="rail-card roster-card">
                <p className="section-label">My roster</p><h2>{userName}</h2>
                <div className="roster-counts">
                  {POSITION_ORDER.map((position) => <span key={position}>{position} {userRoster?.positionCounts[position] ?? 0}/{ROSTER_REQUIREMENTS[position]}</span>)}
                </div>
                <ul className="roster-players">
                  {userRoster?.players.map((player) => <li key={player.id}><span>{player.position}</span>{player.displayName}</li>)}
                  {userRoster?.players.length === 0 && <li>No selections yet.</li>}
                </ul>
              </section>
            </aside>
          </div>

          <section className="secondary-grid">
            <section className="secondary-card">
              <div className="section-heading"><div><p className="section-label">Recent picks</p><h2>History</h2></div><button type="button" className="text-button" onClick={resetPicks} disabled={pickHistory.length === 0}>Clear picks</button></div>
              <ol className="history-list" reversed>
                {[...pickHistory].reverse().slice(0, 10).map((pick) => {
                  const player = playerData?.players.find(({ id }) => id === pick.playerId)
                  return <li key={pick.overallPickNumber}><span>#{pick.overallPickNumber}</span><strong>{player?.displayName ?? pick.playerId}</strong><small>{displayName(draftModel.configuration, pick.managerId)}</small></li>
                })}
                {pickHistory.length === 0 && <li>No picks recorded.</li>}
              </ol>
            </section>

            <section className="secondary-card">
              <p className="section-label">Manager rosters</p><h2>League counts</h2>
              <div className="manager-roster-grid">
                {draftModel.configuration.managers.map((manager) => {
                  const roster = draftModel.draftState?.rosters[manager.id]
                  return <article key={manager.id}><strong>{manager.displayName}</strong><span>{roster?.players.length ?? 0}/15</span><small>{POSITION_ORDER.map((position) => `${position} ${roster?.positionCounts[position] ?? 0}`).join(' · ')}</small></article>
                })}
              </div>
            </section>
          </section>

          <details className="setup-drawer">
            <summary>Manager setup &amp; session controls</summary>
            <div className="setup-content">
              <label><span>Manager count</span><select value={managers.length} onChange={(event) => changeManagerCount(Number(event.target.value))}>{leagueSizes.map((size) => <option key={size} value={size}>{size}</option>)}</select></label>
              <ol className="manager-list">
                {managers.map((manager, index) => (
                  <li key={manager.id}>
                    <span>{index + 1}</span>
                    <input aria-label={`Manager ${index + 1} name`} value={manager.displayName} onChange={(event) => setManagers((current) => current.map((item) => item.id === manager.id ? { ...item, displayName: event.target.value } : item))} />
                    <button type="button" onClick={() => moveManager(index, -1)} disabled={index === 0}>Move up</button>
                    <button type="button" onClick={() => moveManager(index, 1)} disabled={index === managers.length - 1}>Move down</button>
                  </li>
                ))}
              </ol>
              <label><span>My manager</span><select value={userManagerId} onChange={(event) => setUserManagerId(event.target.value)}>{managers.map((manager) => <option key={manager.id} value={manager.id}>{manager.displayName || 'Unnamed manager'}</option>)}</select></label>
              <button type="button" className="danger-button" onClick={resetSession}>Reset saved session</button>
              <p>Changing manager count or order clears pick history. Renaming preserves manager identity.</p>
            </div>
          </details>

          <footer><p>Model artifact: {currentDraftRankingArtifact.targetSeason} · {currentDraftRankingArtifact.modelSignalCount} exact historical signals · quality {currentDraftRankingArtifact.qualityStatus.toLowerCase()} · leakage {currentDraftRankingArtifact.leakageStatus.toLowerCase()} · sanity {currentDraftRankingArtifact.modelSanityStatus.toLowerCase()}.</p></footer>
        </>
      )}
    </main>
  )
}

export default App
