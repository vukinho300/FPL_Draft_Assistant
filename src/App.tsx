import { useState } from 'react'

import {
  DEFAULT_RESERVE_BUFFER,
  MAX_LEAGUE_SIZE,
  MIN_LEAGUE_SIZE,
  POSITION_ORDER,
  ROSTER_REQUIREMENTS,
  calculateCandidateTargets,
  calculateRosterDemand,
} from './domain/league.ts'
import { getPositionLabel } from './domain/player.ts'
import './App.css'

const leagueSizes = Array.from(
  { length: MAX_LEAGUE_SIZE - MIN_LEAGUE_SIZE + 1 },
  (_, index) => MIN_LEAGUE_SIZE + index,
)

function App() {
  const [managerCount, setManagerCount] = useState(6)
  const rosterDemand = calculateRosterDemand(managerCount)
  const candidateTargets = calculateCandidateTargets(managerCount)

  return (
    <main className="app-shell">
      <header className="intro">
        <p className="eyebrow">Phase 3 · Draft Board Domain</p>
        <h1>FPL Draft Assistant</h1>
        <p className="description">
          Explore deterministic league demand and candidate-pool targets. This planning
          summary does not load or present player data.
        </p>
      </header>

      <section className="planner" aria-labelledby="planner-title">
        <div className="planner-heading">
          <div>
            <p className="section-label">League setup</p>
            <h2 id="planner-title">Candidate board sizing</h2>
          </div>
          <label className="league-size">
            <span>Managers</span>
            <select
              value={managerCount}
              onChange={(event) => setManagerCount(Number(event.target.value))}
            >
              {leagueSizes.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="summary" aria-label="League totals">
          <article>
            <strong>{managerCount}</strong>
            <span>managers</span>
          </article>
          <article>
            <strong>{rosterDemand.total}</strong>
            <span>required players</span>
          </article>
          <article>
            <strong>{candidateTargets.total}</strong>
            <span>candidate board</span>
          </article>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">Position</th>
                <th scope="col">Per manager</th>
                <th scope="col">League demand</th>
                <th scope="col">Candidate target</th>
              </tr>
            </thead>
            <tbody>
              {POSITION_ORDER.map((position) => (
                <tr key={position}>
                  <th scope="row">
                    <span className="position-code">{position}</span>
                    {getPositionLabel(position)}
                  </th>
                  <td>{ROSTER_REQUIREMENTS[position]}</td>
                  <td>{rosterDemand.positions[position]}</td>
                  <td>{candidateTargets.positions[position]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="heuristic-note">
          Candidate targets apply a {DEFAULT_RESERVE_BUFFER * 100}% project reserve
          buffer separately to each position. This is not an official FPL rule or a
          player-quality score.
        </p>
      </section>
    </main>
  )
}

export default App
