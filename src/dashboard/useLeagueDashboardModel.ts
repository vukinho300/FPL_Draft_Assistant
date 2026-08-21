import { useEffect, useMemo, useRef, useState } from 'react'

import { officialDraft202627 } from '../data/leagues/kile-n-others/officialDraft2026-27.ts'
import { kileNOthersTransactions } from '../data/leagues/kile-n-others/transactions.ts'
import { currentDraftRankingArtifact } from '../data/currentDraftRanking.ts'
import { POSITION_ORDER, ROSTER_REQUIREMENTS } from '../domain/league.ts'
import type { Player, Position } from '../domain/player.ts'
import {
  buildLeagueActivity,
  buildPlayerOwnershipDirectory,
  deriveCurrentLeagueRosters,
} from '../domain/transactions.ts'
import {
  loadFplPlayerData,
} from '../services/fpl/browserClient.ts'
import type { FplPlayerDataResponse } from '../services/fpl/contract.ts'
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

export function useLeagueDashboardModel(playerLoader: PlayerLoader = loadFplPlayerData) {
  const [view, setView] = useState<LeagueView>('league')
  const [selectedManagerId, setSelectedManagerId] = useState(
    officialDraft202627.managers[0].id,
  )
  const [transactionTab, setTransactionTab] = useState<TransactionTab>('TRADES')
  const [players, setPlayers] = useState<readonly Player[]>([])
  const [playerError, setPlayerError] = useState<string | null>(null)
  const [playerSearch, setPlayerSearch] = useState('')
  const [playerPosition, setPlayerPosition] = useState<Position | 'ALL'>('ALL')
  const [playerOwnership, setPlayerOwnership] = useState<PlayerOwnershipFilter>('ALL')
  const [playerSort, setPlayerSort] = useState<PlayerDirectorySort>('OFFICIAL')
  const playerRequestStarted = useRef(false)
  const controllerMounted = useRef(false)

  const rosters = useMemo(
    () => deriveCurrentLeagueRosters(officialDraft202627, kileNOthersTransactions),
    [],
  )
  const activity = useMemo(
    () => buildLeagueActivity(officialDraft202627, kileNOthersTransactions),
    [],
  )
  const vukRoster = rosters.find(
    ({ managerId }) => managerId === officialDraft202627.leagueSettings.userManagerId,
  ) ?? rosters[0]
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
    if (view !== 'players' || playerRequestStarted.current) return

    playerRequestStarted.current = true
    playerLoader().then((response) => {
      if (controllerMounted.current) setPlayers(response.players)
    }).catch((reason: unknown) => {
      if (controllerMounted.current) {
        setPlayerError(
          reason instanceof Error ? reason.message : 'Player directory is unavailable',
        )
      }
    })
  }, [playerLoader, view])

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
    vukRoster,
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
    archive: {
      completedAt: officialDraft202627.completedAt,
      sourceCommit: officialDraft202627.sourceCommit,
      metadata: officialDraft202627.rankingSnapshotMetadata,
      picks: officialDraft202627.picks,
    },
  } as const
}

export type LeagueDashboardModel = ReturnType<typeof useLeagueDashboardModel>
