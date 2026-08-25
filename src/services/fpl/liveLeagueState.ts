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
  type FplDraftEvent,
  type FplDraftEventStatus,
} from './gameState.ts'
import { retrieveFplDraftLeagueDetails } from './leagueDetails.ts'
import {
  retrieveFplDraftLeagueElementStatuses,
  type FplDraftLeagueElementStatuses,
} from './leagueElementStatus.ts'
import { verifyFplDraftLeagueState } from './leagueState.ts'
import { retrieveFplDraftLiveEvent } from './liveEvent.ts'
import { normalizeFplBootstrap } from './normalize.ts'
import { retrieveOfficialJson } from './requestJson.ts'
import {
  BROWSER_FPL_REQUEST_TIMEOUT_MS,
  fetchWithTimeout,
  FplRequestTimeoutError,
  resolveWithTimeout,
} from './requestTimeout.ts'

export interface RetrievedLiveLeagueState {
  readonly snapshot: LiveLeagueStandingsSnapshot
  /** The next scheduled round, when official game state exposes one. */
  readonly nextEvent: FplDraftEvent | null
  /** Current official Draft ownership. This is current-roster authority, not draft history. */
  readonly ownership: FplDraftLeagueElementStatuses
  /** Kept separate because these upstream facts do not yet prove final reconciliation. */
  readonly eventStatus: FplDraftEventStatus
}

export interface RetrieveLiveLeagueStateOptions {
  readonly fetchImplementation?: FetchImplementation
  readonly now?: () => Date
}

function isNormalizedOwnership(value: unknown): value is FplDraftLeagueElementStatuses {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const candidate = value as Partial<FplDraftLeagueElementStatuses>
  if (candidate.leagueId !== officialLeagueIdentity202627.leagueId || !Array.isArray(candidate.elements)) {
    return false
  }
  const ids = new Set<string>()
  return candidate.elements.every((element) => {
    if (typeof element !== 'object' || element === null || Array.isArray(element)) return false
    const status = element as Partial<FplDraftLeagueElementStatuses['elements'][number]>
    if (
      typeof status.elementId !== 'string'
      || ids.has(status.elementId)
      || !['AVAILABLE', 'OWNED', 'LOCKED'].includes(status.availability ?? '')
      || typeof status.upstreamStatusCode !== 'string'
      || typeof status.inAcceptedTrade !== 'boolean'
      || !(
        status.officialOwnerEntryId === null
        || (Number.isSafeInteger(status.officialOwnerEntryId) && (status.officialOwnerEntryId ?? 0) > 0)
      )
      || (status.availability === 'OWNED' && status.officialOwnerEntryId === null)
      || (status.availability === 'AVAILABLE' && status.officialOwnerEntryId !== null)
    ) return false
    ids.add(status.elementId)
    return true
  })
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
    && isNormalizedOwnership(candidate.ownership)
    && (candidate.nextEvent === null || (
      typeof candidate.nextEvent === 'object'
      && Number.isSafeInteger(candidate.nextEvent.eventId)
      && typeof candidate.nextEvent.deadlineTime === 'string'
      && !Number.isNaN(Date.parse(candidate.nextEvent.deadlineTime))
    ))
    && typeof candidate.eventStatus === 'object'
    && candidate.eventStatus !== null
    && Array.isArray(candidate.eventStatus.days)
  )
}

/** Browser-safe project boundary. Raw official endpoint shapes never reach React. */
export async function loadKileNOthersLiveLeagueState(
  fetchImplementation: FetchImplementation = fetch,
  timeoutMs: number = BROWSER_FPL_REQUEST_TIMEOUT_MS,
): Promise<RetrievedLiveLeagueState> {
  let response: Response
  try {
    response = await fetchWithTimeout(
      fetchImplementation,
      '/api/fpl-league-live',
      { headers: { accept: 'application/json' } },
      timeoutMs,
      'Official Gameweek request timed out',
    )
  } catch (error) {
    if (error instanceof FplRequestTimeoutError) {
      throw new Error('Official Gameweek data took too long to load. Try again.', { cause: error })
    }
    throw new Error('Official Gameweek data is unavailable. Try again.', { cause: error })
  }
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
  const [rawBootstrap, game, eventStatus, leagueDetails, ownership] = await Promise.all([
    retrieveOfficialJson(
      FPL_DRAFT_BOOTSTRAP_STATIC_ENDPOINT,
      'FPL Draft bootstrap',
      fetchImplementation,
    ),
    retrieveFplDraftGame(fetchImplementation),
    retrieveFplDraftEventStatus(fetchImplementation),
    retrieveFplDraftLeagueDetails(officialLeagueIdentity202627.leagueId, { fetchImplementation }),
    retrieveFplDraftLeagueElementStatuses(
      officialLeagueIdentity202627.leagueId,
      fetchImplementation,
    ),
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
  const nextEvent = game.nextEventId === null
    ? null
    : schedule.events.find((event) => event.eventId === game.nextEventId) ?? null
  if (game.nextEventId !== null && nextEvent === null) {
    throw new FplDataError(
      'MISSING_REQUIRED_MAPPING',
      `Next Gameweek ${game.nextEventId} is missing from the schedule`,
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
  verifyFplDraftLeagueState(
    officialLeagueIdentity202627,
    players,
    lineups,
    liveEvent,
    ownership,
  )
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
    nextEvent,
    ownership,
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
  readonly requestTimeoutMs?: number
}

export class LiveLeagueStateController {
  readonly #load: () => Promise<RetrievedLiveLeagueState>
  readonly #now: () => Date
  readonly #startTimer: TimerStarter
  readonly #stopTimer: TimerStopper
  readonly #requestTimeoutMs: number
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
    this.#requestTimeoutMs = options.requestTimeoutMs ?? BROWSER_FPL_REQUEST_TIMEOUT_MS
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
      const data = await resolveWithTimeout(
        this.#load(),
        this.#requestTimeoutMs,
        'Official Gameweek data took too long to load. Try again.',
      )
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
