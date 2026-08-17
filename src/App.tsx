import { useMemo, useState } from 'react'

import {
  generateSnakeDraftSchedule,
  getCurrentDraftSlot,
  getManagerPickNumbers,
  getTurnHorizon,
  validateCompletedPickCount,
} from './domain/draftSchedule.ts'
import {
  calculateCandidateTargets,
  calculateRosterDemand,
  MAX_LEAGUE_SIZE,
  MIN_LEAGUE_SIZE,
} from './domain/league.ts'
import {
  createDraftConfiguration,
  getManagerDraftPosition,
  type DraftConfiguration,
  type Manager,
} from './domain/manager.ts'
import './App.css'

const defaultManagerNames = ['Vuk', 'Diego', 'Kristian', 'Miku', 'Tin', 'Deni']

const leagueSizes = Array.from(
  { length: MAX_LEAGUE_SIZE - MIN_LEAGUE_SIZE + 1 },
  (_, index) => MIN_LEAGUE_SIZE + index,
)

function createDemoManagerPool(): Manager[] {
  return Array.from({ length: MAX_LEAGUE_SIZE }, (_, index) => ({
    id: `demo-manager-${index + 1}`,
    displayName: defaultManagerNames[index] ?? `Manager ${index + 1}`,
  }))
}

function getDisplayName(
  configuration: DraftConfiguration,
  managerId: string,
): string {
  return (
    configuration.managers.find((manager) => manager.id === managerId)?.displayName ??
    managerId
  )
}

function App() {
  const [managerPool, setManagerPool] = useState(createDemoManagerPool)
  const [managerCount, setManagerCount] = useState(6)
  const [userManagerId, setUserManagerId] = useState('demo-manager-1')
  const [completedPickCount, setCompletedPickCount] = useState(0)
  const managers = managerPool.slice(0, managerCount)
  const rosterDemand = calculateRosterDemand(managerCount)
  const candidateTargets = calculateCandidateTargets(managerCount)

  const draftModel = useMemo(() => {
    try {
      const configuration = createDraftConfiguration(managers, userManagerId)
      const schedule = generateSnakeDraftSchedule(configuration)
      const currentSlot = getCurrentDraftSlot(schedule, completedPickCount)

      return {
        configuration,
        schedule,
        currentSlot,
        draftPosition: getManagerDraftPosition(
          configuration.managers,
          configuration.userManagerId,
        ),
        userPickNumbers: getManagerPickNumbers(schedule, configuration.userManagerId),
        turnHorizon: getTurnHorizon(
          schedule,
          configuration.userManagerId,
          completedPickCount,
        ),
        error: null,
      }
    } catch (error) {
      return {
        configuration: null,
        schedule: null,
        currentSlot: null,
        draftPosition: null,
        userPickNumbers: null,
        turnHorizon: null,
        error: error instanceof Error ? error.message : 'Invalid manager configuration',
      }
    }
  }, [completedPickCount, managers, userManagerId])

  function changeManagerCount(nextCount: number): void {
    const nextManagers = managerPool.slice(0, nextCount)
    setManagerCount(nextCount)
    setCompletedPickCount(0)

    if (!nextManagers.some((manager) => manager.id === userManagerId)) {
      setUserManagerId(nextManagers[0].id)
    }
  }

  function changeManagerName(managerId: string, displayName: string): void {
    setManagerPool((current) =>
      current.map((manager) =>
        manager.id === managerId ? { ...manager, displayName } : manager,
      ),
    )
  }

  function moveManager(index: number, direction: -1 | 1): void {
    const destination = index + direction
    if (destination < 0 || destination >= managerCount) return

    setManagerPool((current) => {
      const reordered = [...current]
      const selected = reordered[index]
      reordered[index] = reordered[destination]
      reordered[destination] = selected
      return reordered
    })
    setCompletedPickCount(0)
  }

  function changeCompletedPickCount(nextCount: number): void {
    if (draftModel.schedule === null) return

    try {
      validateCompletedPickCount(draftModel.schedule, nextCount)
      setCompletedPickCount(nextCount)
    } catch {
      // Native input constraints communicate the valid range; domain validation is authoritative.
    }
  }

  return (
    <main className="app-shell">
      <header className="intro">
        <p className="eyebrow">Phase 4 · Draft-order foundation</p>
        <h1>Know every turn before draft night.</h1>
        <p className="description">
          Enter the first-round order supplied to this companion, identify your manager,
          and inspect the complete 15-round snake schedule. No official FPL draft is
          changed here.
        </p>
      </header>

      <section className="panel setup-panel" aria-labelledby="setup-title">
        <div className="panel-heading">
          <div>
            <p className="section-label">Manager configuration</p>
            <h2 id="setup-title">First-round order</h2>
          </div>
          <label className="compact-control">
            <span>Manager count</span>
            <select
              aria-label="Manager count"
              value={managerCount}
              onChange={(event) => changeManagerCount(Number(event.target.value))}
            >
              {leagueSizes.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
        </div>

        <p className="helper-copy">
          Match the Wheel of Names result from top to bottom. IDs remain stable when a
          visible name changes.
        </p>

        <ol className="manager-list">
          {managers.map((manager, index) => (
            <li key={manager.id} className="manager-row">
              <span className="order-number" aria-hidden="true">
                {index + 1}
              </span>
              <label>
                <span className="sr-only">Manager {index + 1} name</span>
                <input
                  value={manager.displayName}
                  onChange={(event) => changeManagerName(manager.id, event.target.value)}
                />
              </label>
              <div className="order-actions" aria-label={`Reorder ${manager.displayName}`}>
                <button
                  type="button"
                  onClick={() => moveManager(index, -1)}
                  disabled={index === 0}
                  aria-label={`Move ${manager.displayName} up`}
                >
                  ↑ <span>Up</span>
                </button>
                <button
                  type="button"
                  onClick={() => moveManager(index, 1)}
                  disabled={index === managerCount - 1}
                  aria-label={`Move ${manager.displayName} down`}
                >
                  ↓ <span>Down</span>
                </button>
              </div>
            </li>
          ))}
        </ol>

        <label className="my-manager-control">
          <span>My manager</span>
          <select
            value={userManagerId}
            onChange={(event) => setUserManagerId(event.target.value)}
          >
            {managers.map((manager) => (
              <option key={manager.id} value={manager.id}>
                {manager.displayName || 'Unnamed manager'}
              </option>
            ))}
          </select>
        </label>

        {draftModel.error !== null && (
          <p className="validation-error" role="alert">
            {draftModel.error}
          </p>
        )}
      </section>

      {draftModel.configuration !== null &&
        draftModel.schedule !== null &&
        draftModel.userPickNumbers !== null &&
        draftModel.turnHorizon !== null && (
          <>
            <section className="summary-grid" aria-label="Draft summary">
              <article className="summary-card emphasis-card">
                <span>Draft position</span>
                <strong>{draftModel.draftPosition}</strong>
              </article>
              <article className="summary-card">
                <span>Scheduled selections</span>
                <strong>{draftModel.schedule.length}</strong>
              </article>
              <article className="summary-card">
                <span>Required players</span>
                <strong>{rosterDemand.total}</strong>
              </article>
              <article className="summary-card">
                <span>Phase 3 candidate target</span>
                <strong>{candidateTargets.total}</strong>
              </article>
            </section>

            <section className="panel picks-panel" aria-labelledby="picks-title">
              <div className="panel-heading">
                <div>
                  <p className="section-label">Your schedule</p>
                  <h2 id="picks-title">Your 15 picks</h2>
                </div>
              </div>
              <p className="pick-sequence">{draftModel.userPickNumbers.join(', ')}</p>
            </section>

            <section className="panel progress-panel" aria-labelledby="progress-title">
              <div className="panel-heading">
                <div>
                  <p className="section-label">Scheduling progress</p>
                  <h2 id="progress-title">Current picker &amp; Turn Horizon</h2>
                </div>
                <label className="compact-control">
                  <span>Completed picks</span>
                  <input
                    type="number"
                    min="0"
                    max={draftModel.schedule.length}
                    step="1"
                    value={completedPickCount}
                    onChange={(event) =>
                      changeCompletedPickCount(Number(event.target.value))
                    }
                  />
                </label>
              </div>

              <div className="horizon-grid">
                <article>
                  <span>Current picker</span>
                  <strong>
                    {draftModel.currentSlot === null
                      ? 'Draft complete'
                      : `${getDisplayName(draftModel.configuration, draftModel.currentSlot.managerId)} · Pick ${draftModel.currentSlot.overallPickNumber}`}
                  </strong>
                </article>
                <article>
                  <span>Next user pick</span>
                  <strong>{draftModel.turnHorizon.nextUserPickNumber ?? 'None'}</strong>
                </article>
                <article>
                  <span>Opponent picks before it</span>
                  <strong>{draftModel.turnHorizon.opponentPicksBeforeNextUserPick}</strong>
                </article>
                <article>
                  <span>Upcoming user turn</span>
                  <strong>
                    {draftModel.turnHorizon.upcomingUserTurnPickNumbers.length === 0
                      ? 'No future picks'
                      : draftModel.turnHorizon.upcomingUserTurnPickNumbers.join(', ')}
                  </strong>
                </article>
              </div>

              <p className="horizon-note">
                {draftModel.turnHorizon.nextUserPickIsFollowedByConsecutiveUserPick
                  ? 'The next user pick begins a consecutive snake-turn pair.'
                  : 'The next user pick is not immediately followed by another user pick.'}{' '}
                {draftModel.turnHorizon.firstPickAfterUpcomingUserTurn !== null &&
                  `Pick ${draftModel.turnHorizon.firstPickAfterUpcomingUserTurn.overallPickNumber} is first after that turn.`}
              </p>
            </section>

            <section className="panel schedule-panel" aria-labelledby="schedule-title">
              <div className="panel-heading">
                <div>
                  <p className="section-label">Snake preview</p>
                  <h2 id="schedule-title">Rounds 1–4</h2>
                </div>
                <span className="round-count">15 rounds total</span>
              </div>

              <div className="round-grid">
                {[1, 2, 3, 4].map((roundNumber) => (
                  <article key={roundNumber} className="round-card">
                    <h3>Round {roundNumber}</h3>
                    <ol>
                      {draftModel.schedule
                        .filter((slot) => slot.roundNumber === roundNumber)
                        .map((slot) => (
                          <li key={slot.overallPickNumber}>
                            <span>Pick {slot.overallPickNumber}</span>
                            <strong>
                              {getDisplayName(draftModel.configuration, slot.managerId)}
                            </strong>
                          </li>
                        ))}
                    </ol>
                  </article>
                ))}
              </div>
            </section>
          </>
        )}
    </main>
  )
}

export default App
