import { officialLeagueIdentity202627 } from '../../data/leagues/kile-n-others/officialLeagueIdentity2026-27.ts'
import {
  buildLiveLeagueStandings,
  deriveLiveLeagueFreshness,
  type LiveLeagueFreshness,
  type LiveLeagueStandingsSnapshot,
} from '../../domain/liveLeagueStandings.ts'
import type { FetchImplementation } from './client.ts'
import { retrieveFplDraftEntryEventLineup } from './entryEvent.ts'
import { FplDataError } from './errors.ts'
import {
  deriveFplDraftGameweekState,
  FPL_DRAFT_BOOTSTRAP_STATIC_ENDPOINT,
  normalizeFplDraftEventSchedule,
  retrieveFplDraftEventStatus,
  retrieveFplDraftGame,
  type FplDraftEventStatus,
} from './gameState.ts'
import { retrieveFplDraftLeagueDetails } from './leagueDetails.ts'
import { retrieveFplDraftLiveEvent } from './liveEvent.ts'
import { normalizeFplBootstrap } from './normalize.ts'
import { retrieveOfficialJson } from './requestJson.ts'

export interface RetrievedLiveLeagueState {
  readonly snapshot: LiveLeagueStandingsSnapshot
  /** Kept separate because these upstream facts do not yet prove final reconciliation. */
  readonly eventStatus: FplDraftEventStatus
}

export interface RetrieveLiveLeagueStateOptions {
  readonly fetchImplementation?: FetchImplementation
  readonly now?: () => Date
}

function isRetrievedLiveLeagueState(value: unknown): value is RetrievedLiveLeagueState {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const candidate = value as Partial<RetrievedLiveLeagueState>
  return (
    typeof candidate.snapshot === 'object'
    && candidate.snapshot !== null
    && candidate.snapshot.leagueId === officialLeagueIdentity202627.leagueId
    && Number.isSafeInteger(candidate.snapshot.eventId)
    && Array.isArray(candidate.snapshot.teamScores)
    && candidate.snapshot.teamScores.length === 6
    && (candidate.snapshot.standings?.status === 'AVAILABLE'
      || candidate.snapshot.standings?.status === 'UNAVAILABLE')
    && candidate.snapshot.calculationStatus === 'PROVISIONAL'
    && candidate.snapshot.reconciliationStatus === 'NOT_PROVEN'
    && typeof candidate.snapshot.freshness?.retrievedAt === 'string'
    && !Number.isNaN(Date.parse(candidate.snapshot.freshness?.retrievedAt ?? ''))
    && Number.isFinite(candidate.snapshot.freshness?.staleAfterMs)
    && (candidate.snapshot.freshness?.staleAfterMs ?? 0) > 0
    && typeof candidate.eventStatus === 'object'
    && candidate.eventStatus !== null
    && Array.isArray(candidate.eventStatus.days)
  )
}

/** Browser-safe project boundary. Raw official endpoint shapes never reach React. */
export async function loadKileNOthersLiveLeagueState(
  fetchImplementation: FetchImplementation = fetch,
): Promise<RetrievedLiveLeagueState> {
  const response = await fetchImplementation('/api/fpl-league-live', {
    headers: { accept: 'application/json' },
  })
  if (!response.ok) {
    let message = 'Current live league data is unavailable'
    try {
      const body = (await response.json()) as { error?: { message?: unknown } }
      if (typeof body.error?.message === 'string') message = body.error.message
    } catch {
      // Preserve the controlled project error when the response is malformed.
    }
    throw new Error(message)
  }
  const body: unknown = await response.json()
  if (!isRetrievedLiveLeagueState(body)) {
    throw new Error('The live league response did not match the project contract')
  }
  return Object.freeze({
    ...body,
    snapshot: Object.freeze({
      ...body.snapshot,
      freshness: Object.freeze({
        retrievedAt: body.snapshot.freshness.retrievedAt,
        staleAfterMs: body.snapshot.freshness.staleAfterMs,
      }),
    }),
  })
}

export async function retrieveKileNOthersLiveLeagueState(
  options: RetrieveLiveLeagueStateOptions = {},
): Promise<RetrievedLiveLeagueState> {
  const fetchImplementation = options.fetchImplementation ?? fetch
  const now = options.now ?? (() => new Date())
  const [rawBootstrap, game, eventStatus, leagueDetails] = await Promise.all([
    retrieveOfficialJson(
      FPL_DRAFT_BOOTSTRAP_STATIC_ENDPOINT,
      'FPL Draft bootstrap',
      fetchImplementation,
    ),
    retrieveFplDraftGame(fetchImplementation),
    retrieveFplDraftEventStatus(fetchImplementation),
    retrieveFplDraftLeagueDetails(officialLeagueIdentity202627.leagueId, { fetchImplementation }),
  ])
  const schedule = normalizeFplDraftEventSchedule(rawBootstrap)
  const players = normalizeFplBootstrap(rawBootstrap)
  if (game.currentEventId === null || schedule.currentEventId !== game.currentEventId) {
    throw new FplDataError(
      'MISSING_REQUIRED_MAPPING',
      'Official game and schedule do not expose one matching current Gameweek',
    )
  }
  const eventId = game.currentEventId
  const currentEvent = schedule.events.find((event) => event.eventId === eventId)
  if (currentEvent === undefined) {
    throw new FplDataError(
      'MISSING_REQUIRED_MAPPING',
      `Current Gameweek ${eventId} is missing from the schedule`,
    )
  }

  const [liveEvent, lineups] = await Promise.all([
    retrieveFplDraftLiveEvent(eventId, fetchImplementation),
    Promise.all(officialLeagueIdentity202627.participants.map(({ officialEntryId }) => (
      retrieveFplDraftEntryEventLineup(officialEntryId, eventId, fetchImplementation)
    ))),
  ])
  const retrievedAt = now().toISOString()
  const gameweekState = deriveFplDraftGameweekState(game, currentEvent, liveEvent.fixtures)
  return Object.freeze({
    snapshot: buildLiveLeagueStandings({
      identity: officialLeagueIdentity202627,
      gameweekState,
      knownPlayerIds: players.map(({ id }) => id),
      lineups,
      liveEvent,
      leagueDetails,
      retrievedAt,
      staleAfterMs: getLiveLeagueRefreshIntervalForState(gameweekState) * 2,
    }),
    eventStatus,
  })
}

function getLiveLeagueRefreshIntervalForState(
  gameweekState: LiveLeagueStandingsSnapshot['gameweekState'],
): number {
  if (gameweekState.hasLiveFixture) return 30_000
  if (gameweekState.phase === 'ACTIVE') return 120_000
  if (
    gameweekState.phase === 'FOOTBALL_COMPLETE'
    || gameweekState.phase === 'OFFICIAL_EVENT_MARKED_FINISHED'
  ) return 300_000
  return 900_000
}

export function getLiveLeagueRefreshIntervalMs(snapshot: LiveLeagueStandingsSnapshot): number {
  return getLiveLeagueRefreshIntervalForState(snapshot.gameweekState)
}

export type LiveLeagueRefreshStatus = 'IDLE' | 'LOADING' | 'REFRESHING' | 'READY' | 'ERROR'

export interface LiveLeagueRefreshState {
  readonly status: LiveLeagueRefreshStatus
  readonly data: RetrievedLiveLeagueState | null
  readonly lastSuccessfulAt: string | null
  readonly errorMessage: string | null
  /** Re-derived from the upstream retrieval timestamp whenever controller state is read. */
  readonly freshness: LiveLeagueFreshness | null
}

type StoredLiveLeagueRefreshState = Omit<LiveLeagueRefreshState, 'freshness'>

type TimerHandle = ReturnType<typeof setTimeout>
type TimerStarter = (callback: () => void, delayMs: number) => TimerHandle
type TimerStopper = (timer: TimerHandle) => void

export interface LiveLeagueStateControllerOptions {
  readonly load?: () => Promise<RetrievedLiveLeagueState>
  readonly now?: () => Date
  readonly startTimer?: TimerStarter
  readonly stopTimer?: TimerStopper
}

export class LiveLeagueStateController {
  readonly #load: () => Promise<RetrievedLiveLeagueState>
  readonly #now: () => Date
  readonly #startTimer: TimerStarter
  readonly #stopTimer: TimerStopper
  readonly #listeners = new Set<(state: LiveLeagueRefreshState) => void>()
  #state: StoredLiveLeagueRefreshState = Object.freeze({
    status: 'IDLE', data: null, lastSuccessfulAt: null, errorMessage: null,
  })
  #latestRequestId = 0
  #timer: TimerHandle | null = null
  #running = false

  constructor(options: LiveLeagueStateControllerOptions = {}) {
    this.#load = options.load ?? loadKileNOthersLiveLeagueState
    this.#now = options.now ?? (() => new Date())
    this.#startTimer = options.startTimer ?? setTimeout
    this.#stopTimer = options.stopTimer ?? clearTimeout
  }

  getState(): LiveLeagueRefreshState {
    return Object.freeze({
      ...this.#state,
      freshness: this.#state.data === null
        ? null
        : deriveLiveLeagueFreshness(
            this.#state.data.snapshot.freshness.retrievedAt,
            this.#now(),
            this.#state.data.snapshot.freshness.staleAfterMs,
          ),
    })
  }

  subscribe(listener: (state: LiveLeagueRefreshState) => void): () => void {
    this.#listeners.add(listener)
    listener(this.getState())
    return () => this.#listeners.delete(listener)
  }

  start(): void {
    if (this.#running) return
    this.#running = true
    void this.refresh()
  }

  stop(): void {
    this.#running = false
    this.#latestRequestId += 1
    if (this.#timer !== null) this.#stopTimer(this.#timer)
    this.#timer = null
  }

  async refresh(): Promise<void> {
    const requestId = ++this.#latestRequestId
    this.#setState({
      ...this.#state,
      status: this.#state.data === null ? 'LOADING' : 'REFRESHING',
      errorMessage: null,
    })
    try {
      const data = await this.#load()
      if (requestId !== this.#latestRequestId) return
      this.#setState({
        status: 'READY',
        data,
        lastSuccessfulAt: this.#now().toISOString(),
        errorMessage: null,
      })
      this.#schedule(getLiveLeagueRefreshIntervalMs(data.snapshot))
    } catch (error) {
      if (requestId !== this.#latestRequestId) return
      this.#setState({
        ...this.#state,
        status: 'ERROR',
        errorMessage: error instanceof Error ? error.message : 'Unable to refresh live league state',
      })
      this.#schedule(60_000)
    }
  }

  #setState(state: StoredLiveLeagueRefreshState): void {
    this.#state = Object.freeze(state)
    const current = this.getState()
    this.#listeners.forEach((listener) => listener(current))
  }

  #schedule(delayMs: number): void {
    if (!this.#running) return
    if (this.#timer !== null) this.#stopTimer(this.#timer)
    this.#timer = this.#startTimer(() => {
      this.#timer = null
      void this.refresh()
    }, delayMs)
  }
}
