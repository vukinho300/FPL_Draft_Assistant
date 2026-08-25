import { useEffect, useMemo, useRef, useState } from 'react'

import { officialDraft202627 } from '../data/leagues/kile-n-others/officialDraft2026-27.ts'
import { kileNOthersTransactions } from '../data/leagues/kile-n-others/transactions.ts'
import { currentDraftRankingArtifact } from '../data/currentDraftRanking.ts'
import { POSITION_ORDER, ROSTER_REQUIREMENTS } from '../domain/league.ts'
import type { Player, Position } from '../domain/player.ts'
import {
  buildLeagueGameweekExperience,
  createDefaultPlannerLineup,
  getGameweekTeam,
  swapPlannerPlayers,
  type LeagueGameweekExperience,
  type PlannerLineup,
} from '../domain/gameweekExperience.ts'
import {
  buildLeagueActivity,
  buildPlayerOwnershipDirectory,
  deriveCurrentLeagueRosters,
} from '../domain/transactions.ts'
import {
  loadFplPlayerData,
} from '../services/fpl/browserClient.ts'
import type { FplPlayerDataResponse } from '../services/fpl/contract.ts'
import {
  BROWSER_FPL_REQUEST_TIMEOUT_MS,
  resolveWithTimeout,
} from '../services/fpl/requestTimeout.ts'
import {
  LiveLeagueStateController,
  type LiveLeagueRefreshState,
} from '../services/fpl/liveLeagueState.ts'
import { getLeagueViewLabel, LEAGUE_NAVIGATION, type LeagueView } from './navigation.ts'
import {
  buildRankedPlayerDirectory,
  getPlayerDirectoryLeaders,
  selectPlayerDirectory,
  type PlayerDirectorySort,
  type PlayerOwnershipFilter,
} from './playerDirectory.ts'

export type TransactionTab = 'TRADES' | 'WAIVERS' | 'FREE AGENTS' | 'ACTIVITY'
export const TRANSACTION_TABS = ['TRADES', 'WAIVERS', 'FREE AGENTS', 'ACTIVITY'] as const

export type PlayerLoader = () => Promise<FplPlayerDataResponse>

export function useLeagueDashboardModel(
  playerLoader: PlayerLoader = loadFplPlayerData,
  currentManagerId?: string,
  providedLiveController?: LiveLeagueStateController,
) {
  const [view, setView] = useState<LeagueView>('league')
  const [selectedManagerId, setSelectedManagerId] = useState(
    officialDraft202627.managers[0].id,
  )
  const [transactionTab, setTransactionTab] = useState<TransactionTab>('TRADES')
  const [players, setPlayers] = useState<readonly Player[]>([])
  const [playerError, setPlayerError] = useState<string | null>(null)
  const [playerLoading, setPlayerLoading] = useState(false)
  const [playerRequestVersion, setPlayerRequestVersion] = useState(0)
  const [playerSearch, setPlayerSearch] = useState('')
  const [playerPosition, setPlayerPosition] = useState<Position | 'ALL'>('ALL')
  const [playerOwnership, setPlayerOwnership] = useState<PlayerOwnershipFilter>('ALL')
  const [playerSort, setPlayerSort] = useState<PlayerDirectorySort>('OFFICIAL')
  const liveController = useMemo(
    () => providedLiveController ?? new LiveLeagueStateController(),
    [providedLiveController],
  )
  const [liveRefresh, setLiveRefresh] = useState<LiveLeagueRefreshState>(liveController.getState())
  const [currentTimeMs, setCurrentTimeMs] = useState(() => Date.now())
  const [planner, setPlanner] = useState<PlannerLineup | null>(null)
  const [plannerSelectedPlayerId, setPlannerSelectedPlayerId] = useState<string | null>(null)
  const [plannerError, setPlannerError] = useState<string | null>(null)
  const playerRequestStarted = useRef(false)
  const controllerMounted = useRef(false)
  const gameweekViewsActive = view === 'my-team' || view === 'teams'

  const rosters = useMemo(
    () => deriveCurrentLeagueRosters(officialDraft202627, kileNOthersTransactions),
    [],
  )
  const activity = useMemo(
    () => buildLeagueActivity(officialDraft202627, kileNOthersTransactions),
    [],
  )
  const currentManagerRoster = currentManagerId === undefined
    ? rosters[0]
    : rosters.find(({ managerId }) => managerId === currentManagerId)
  if (currentManagerRoster === undefined) {
    throw new Error('Authenticated account does not map to an official draft manager')
  }
  const selectedManagerRoster = rosters.find(
    ({ managerId }) => managerId === selectedManagerId,
  ) ?? rosters[0]
  const recentTransactions = useMemo(
    () => activity.filter(({ kind }) => kind !== 'DRAFT'),
    [activity],
  )

  useEffect(() => {
    controllerMounted.current = true
    return () => {
      controllerMounted.current = false
    }
  }, [])

  useEffect(() => {
    const unsubscribe = liveController.subscribe(setLiveRefresh)
    return () => {
      unsubscribe()
      liveController.stop()
    }
  }, [liveController])

  useEffect(() => {
    if (!gameweekViewsActive) {
      liveController.stop()
      return
    }
    liveController.start()
    const timer = window.setInterval(() => {
      setCurrentTimeMs(Date.now())
      setLiveRefresh(liveController.getState())
    }, 10_000)
    return () => window.clearInterval(timer)
  }, [gameweekViewsActive, liveController])

  useEffect(() => {
    if (
      !['players', 'my-team', 'teams'].includes(view)
      || playerRequestStarted.current
      || players.length > 0
    ) return

    playerRequestStarted.current = true
    setPlayerLoading(true)
    setPlayerError(null)
    resolveWithTimeout(
      playerLoader(),
      BROWSER_FPL_REQUEST_TIMEOUT_MS,
      'Player directory took too long to load. Try again.',
    ).then((response) => {
      if (controllerMounted.current) {
        setPlayers(response.players)
        setPlayerError(null)
      }
    }).catch((reason: unknown) => {
      if (controllerMounted.current) {
        setPlayerError(
          reason instanceof Error ? reason.message : 'Player directory is unavailable',
        )
      }
    }).finally(() => {
      playerRequestStarted.current = false
      if (controllerMounted.current) setPlayerLoading(false)
    })
  }, [playerLoader, playerRequestVersion, players.length, view])

  const retryPlayers = () => {
    if (playerRequestStarted.current) return
    setPlayerError(null)
    setPlayerRequestVersion((version) => version + 1)
  }

  const gameweekBuild = useMemo<{
    readonly experience: LeagueGameweekExperience | null
    readonly error: string | null
  }>(() => {
    if (players.length === 0) {
      return { experience: null, error: playerError }
    }
    if (liveRefresh.data === null || liveRefresh.freshness === null) {
      return {
        experience: null,
        error: liveRefresh.status === 'ERROR' ? liveRefresh.errorMessage : null,
      }
    }
    try {
      return {
        experience: buildLeagueGameweekExperience(players, liveRefresh, new Date(currentTimeMs)),
        error: null,
      }
    } catch (reason) {
      return {
        experience: null,
        error: reason instanceof Error ? reason.message : 'Gameweek data could not be verified',
      }
    }
  }, [currentTimeMs, liveRefresh, playerError, players])
  const gameweekExperience = gameweekBuild.experience
  const currentGameweekTeam = gameweekExperience === null
    ? null
    : getGameweekTeam(gameweekExperience, currentManagerRoster.managerId)
  const selectedGameweekTeam = gameweekExperience === null
    ? null
    : getGameweekTeam(gameweekExperience, selectedManagerRoster.managerId)

  useEffect(() => {
    if (gameweekExperience?.mode !== 'PLANNER' || currentGameweekTeam === null) {
      setPlanner(null)
      setPlannerSelectedPlayerId(null)
      setPlannerError(null)
      return
    }
    const fingerprint = currentGameweekTeam.currentRoster.map(({ id }) => id).sort().join(',')
    if (
      planner !== null
      && planner.eventId === gameweekExperience.eventId
      && planner.rosterFingerprint === fingerprint
    ) return
    try {
      setPlanner(createDefaultPlannerLineup(gameweekExperience.eventId, currentGameweekTeam.currentRoster))
      setPlannerError(null)
    } catch (reason) {
      setPlanner(null)
      setPlannerError(reason instanceof Error ? reason.message : 'Planner is unavailable')
    }
    setPlannerSelectedPlayerId(null)
  }, [currentGameweekTeam, gameweekExperience, planner])

  const selectPlannerPlayer = (playerId: string) => {
    if (planner === null) return
    if (plannerSelectedPlayerId === null) {
      setPlannerSelectedPlayerId(playerId)
      setPlannerError(null)
      return
    }
    try {
      setPlanner(swapPlannerPlayers(planner, plannerSelectedPlayerId, playerId))
      setPlannerError(null)
      setPlannerSelectedPlayerId(null)
    } catch (reason) {
      setPlannerError(reason instanceof Error ? reason.message : 'Those players cannot be swapped')
      setPlannerSelectedPlayerId(null)
    }
  }

  const playerOwnershipDirectory = useMemo(
    () => buildPlayerOwnershipDirectory(players, rosters, officialDraft202627),
    [players, rosters],
  )
  const playerDirectory = useMemo(
    () => buildRankedPlayerDirectory(
      playerOwnershipDirectory,
      currentDraftRankingArtifact.players,
    ),
    [playerOwnershipDirectory],
  )
  const filteredPlayers = useMemo(
    () => selectPlayerDirectory(playerDirectory, {
      search: playerSearch,
      position: playerPosition,
      ownership: playerOwnership,
      sort: playerSort,
    }),
    [playerDirectory, playerOwnership, playerPosition, playerSearch, playerSort],
  )
  const playerLeaders = useMemo(() => ({
    form: getPlayerDirectoryLeaders(filteredPlayers, 'FORM'),
    totalPoints: getPlayerDirectoryLeaders(filteredPlayers, 'TOTAL_POINTS'),
  }), [filteredPlayers])

  return {
    navigation: LEAGUE_NAVIGATION,
    view,
    currentTitle: getLeagueViewLabel(view),
    navigate: setView,
    rosters,
    currentManagerRoster,
    activity,
    recentTransactions,
    positions: POSITION_ORDER,
    rosterRequirements: ROSTER_REQUIREMENTS,
    selectedManagerId: selectedManagerRoster.managerId,
    selectedManagerRoster,
    selectManager: setSelectedManagerId,
    transactionTab,
    setTransactionTab,
    transactionTabs: TRANSACTION_TABS,
    playerDirectory: {
      players,
      error: playerError,
      loading: playerLoading,
      retry: retryPlayers,
      search: playerSearch,
      setSearch: setPlayerSearch,
      position: playerPosition,
      setPosition: setPlayerPosition,
      ownership: playerOwnership,
      setOwnership: setPlayerOwnership,
      sort: playerSort,
      setSort: setPlayerSort,
      filtered: filteredPlayers,
      leaders: playerLeaders,
    },
    gameweek: {
      refresh: liveRefresh,
      experience: gameweekExperience,
      error: gameweekBuild.error
        ?? (liveRefresh.data === null && liveRefresh.status === 'ERROR' ? liveRefresh.errorMessage : null),
      currentTeam: currentGameweekTeam,
      selectedTeam: selectedGameweekTeam,
      planner,
      plannerSelectedPlayerId,
      plannerError,
      selectPlannerPlayer,
      refreshNow: () => {
        if (players.length === 0) retryPlayers()
        void liveController.refresh()
      },
    },
    archive: {
      completedAt: officialDraft202627.completedAt,
      sourceCommit: officialDraft202627.sourceCommit,
      metadata: officialDraft202627.rankingSnapshotMetadata,
      picks: officialDraft202627.picks,
    },
  } as const
}

export type LeagueDashboardModel = ReturnType<typeof useLeagueDashboardModel>
