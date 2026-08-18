import { POSITION_ORDER, ROSTER_REQUIREMENTS, type PositionCounts } from './league.ts'
import type { Club, Player, Position } from './player.ts'
import type {
  OfficialDraftRosterPlayer,
  OfficialDraftSnapshot,
} from './officialDraft.ts'

export const TRANSACTION_STATUSES = [
  'PROPOSED',
  'ACCEPTED',
  'REJECTED',
  'WITHDRAWN',
  'INVALID',
  'VETOED',
  'EXPIRED',
  'PROCESSED',
] as const

export type TransactionStatus = (typeof TRANSACTION_STATUSES)[number]

export interface TransactionPlayerReference {
  readonly playerId: string
  readonly position: Position
}

interface TransactionBase {
  readonly id: string
  readonly gameweek: number
  readonly createdAt: string
  readonly status: TransactionStatus
  readonly notes: string
}

export interface TradeRecord extends TransactionBase {
  readonly kind: 'TRADE'
  readonly fromManagerId: string
  readonly toManagerId: string
  readonly playersFrom: readonly TransactionPlayerReference[]
  readonly playersTo: readonly TransactionPlayerReference[]
}

export interface LeaguePlayerIdentity {
  readonly playerId: string
  readonly displayName: string
  readonly position: Position
  readonly club: Club
}

export interface WaiverTransaction extends TransactionBase {
  readonly kind: 'WAIVER'
  readonly managerId: string
  readonly waivedPlayer: TransactionPlayerReference
  readonly claimedPlayer: LeaguePlayerIdentity
}

export interface FreeAgentTransaction extends TransactionBase {
  readonly kind: 'FREE_AGENT'
  readonly managerId: string
  readonly releasedPlayer: TransactionPlayerReference
  readonly addedPlayer: LeaguePlayerIdentity
}

export type LeagueTransaction = TradeRecord | WaiverTransaction | FreeAgentTransaction

export interface CurrentLeagueRosterPlayer extends LeaguePlayerIdentity {
  readonly originalDraftPick: number | null
  readonly draftDayMvpRank: number | null
  readonly officialDraftRankAtDraft: number | null
}

export interface CurrentLeagueRoster {
  readonly managerId: string
  readonly managerName: string
  readonly players: readonly CurrentLeagueRosterPlayer[]
  readonly positionCounts: PositionCounts
}

export interface PlayerOwnershipEntry {
  readonly player: Player
  readonly ownerManagerId: string | null
  readonly ownerName: string | 'FREE AGENT'
  readonly originalDraftPick: number | null
  readonly draftDayMvpRank: number | null
}

export interface LeagueActivityEvent {
  readonly id: string
  readonly kind: 'DRAFT' | 'TRADE' | 'WAIVER' | 'FREE_AGENT'
  readonly gameweek: number | null
  readonly occurredAt: string
  readonly description: string
}

export class LeagueTransactionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'LeagueTransactionError'
  }
}

function countPositions(players: readonly { position: Position }[]): PositionCounts {
  return Object.freeze({
    GK: players.filter(({ position }) => position === 'GK').length,
    DEF: players.filter(({ position }) => position === 'DEF').length,
    MID: players.filter(({ position }) => position === 'MID').length,
    FWD: players.filter(({ position }) => position === 'FWD').length,
  })
}

function archivedPlayer(player: OfficialDraftRosterPlayer): CurrentLeagueRosterPlayer {
  return Object.freeze({
    playerId: player.draftPlayerId,
    displayName: player.playerName,
    position: player.position,
    club: player.club,
    originalDraftPick: player.draftPickNumber,
    draftDayMvpRank: player.mvpConsensusRankAtDraft,
    officialDraftRankAtDraft: player.officialDraftRankAtDraft,
  })
}

function acquiredPlayer(player: LeaguePlayerIdentity): CurrentLeagueRosterPlayer {
  return Object.freeze({
    ...player,
    originalDraftPick: null,
    draftDayMvpRank: null,
    officialDraftRankAtDraft: null,
  })
}

function positionSignature(players: readonly TransactionPlayerReference[]): string {
  return [...players].map(({ position }) => position).sort().join('|')
}

export function validateTradePositionComposition(trade: TradeRecord): void {
  if (trade.fromManagerId === trade.toManagerId) {
    throw new LeagueTransactionError('A trade requires two different managers')
  }
  if (trade.playersFrom.length === 0 || trade.playersTo.length === 0) {
    throw new LeagueTransactionError('A trade must include players in both directions')
  }
  if (positionSignature(trade.playersFrom) !== positionSignature(trade.playersTo)) {
    throw new LeagueTransactionError('Trade positions must match in both directions')
  }
  const playerIds = [...trade.playersFrom, ...trade.playersTo].map(({ playerId }) => playerId)
  if (new Set(playerIds).size !== playerIds.length) {
    throw new LeagueTransactionError('A trade cannot reference a player more than once')
  }
}

export function validateWaiverPosition(transaction: WaiverTransaction): void {
  if (transaction.waivedPlayer.position !== transaction.claimedPlayer.position) {
    throw new LeagueTransactionError('Waiver additions and releases must use the same position')
  }
}

function validateFreeAgentPosition(transaction: FreeAgentTransaction): void {
  if (transaction.releasedPlayer.position !== transaction.addedPlayer.position) {
    throw new LeagueTransactionError('Free-agent additions and releases must use the same position')
  }
}

export function validateUniqueRosterOwnership(
  rosters: readonly Pick<CurrentLeagueRoster, 'managerId' | 'players'>[],
): void {
  const ownerByPlayerId = new Map<string, string>()
  rosters.forEach((roster) => {
    roster.players.forEach((player) => {
      const existingOwner = ownerByPlayerId.get(player.playerId)
      if (existingOwner !== undefined) {
        throw new LeagueTransactionError(
          `${player.displayName} belongs to both ${existingOwner} and ${roster.managerId}`,
        )
      }
      ownerByPlayerId.set(player.playerId, roster.managerId)
    })
  })
}

function assertLegalRosters(rosters: readonly CurrentLeagueRoster[]): void {
  validateUniqueRosterOwnership(rosters)
  rosters.forEach((roster) => {
    if (roster.players.length !== 15) {
      throw new LeagueTransactionError(`${roster.managerName} must retain 15 players`)
    }
    const counts = countPositions(roster.players)
    if (!POSITION_ORDER.every((position) => counts[position] === ROSTER_REQUIREMENTS[position])) {
      throw new LeagueTransactionError(`${roster.managerName} has an illegal positional roster`)
    }
  })
}

function removeOwnedPlayer(
  players: readonly CurrentLeagueRosterPlayer[],
  reference: TransactionPlayerReference,
  managerName: string,
): { remaining: CurrentLeagueRosterPlayer[]; removed: CurrentLeagueRosterPlayer } {
  const removed = players.find(({ playerId }) => playerId === reference.playerId)
  if (removed === undefined) {
    throw new LeagueTransactionError(`${managerName} does not own player ${reference.playerId}`)
  }
  if (removed.position !== reference.position) {
    throw new LeagueTransactionError(`Transaction position does not match ${removed.displayName}`)
  }
  return {
    remaining: players.filter(({ playerId }) => playerId !== reference.playerId),
    removed,
  }
}

export function deriveCurrentLeagueRosters(
  snapshot: OfficialDraftSnapshot,
  transactions: readonly LeagueTransaction[],
): readonly CurrentLeagueRoster[] {
  const mutable = new Map(
    snapshot.finalRosters.map((roster) => [
      roster.managerId,
      {
        managerId: roster.managerId,
        managerName: roster.managerName,
        players: roster.players.map(archivedPlayer),
      },
    ]),
  )
  const seenTransactionIds = new Set<string>()
  const ordered = [...transactions].sort(
    (left, right) => left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id),
  )

  ordered.forEach((transaction) => {
    if (seenTransactionIds.has(transaction.id)) {
      throw new LeagueTransactionError(`Duplicate transaction id ${transaction.id}`)
    }
    seenTransactionIds.add(transaction.id)

    if (transaction.kind === 'TRADE') {
      validateTradePositionComposition(transaction)
      if (transaction.status !== 'PROCESSED') return
      const fromRoster = mutable.get(transaction.fromManagerId)
      const toRoster = mutable.get(transaction.toManagerId)
      if (fromRoster === undefined || toRoster === undefined) {
        throw new LeagueTransactionError('Trade references an unknown manager')
      }
      let fromPlayers = [...fromRoster.players]
      let toPlayers = [...toRoster.players]
      const movingFrom: CurrentLeagueRosterPlayer[] = []
      const movingTo: CurrentLeagueRosterPlayer[] = []
      transaction.playersFrom.forEach((reference) => {
        const result = removeOwnedPlayer(fromPlayers, reference, fromRoster.managerName)
        fromPlayers = result.remaining
        movingFrom.push(result.removed)
      })
      transaction.playersTo.forEach((reference) => {
        const result = removeOwnedPlayer(toPlayers, reference, toRoster.managerName)
        toPlayers = result.remaining
        movingTo.push(result.removed)
      })
      fromRoster.players = [...fromPlayers, ...movingTo]
      toRoster.players = [...toPlayers, ...movingFrom]
      return
    }

    const roster = mutable.get(transaction.managerId)
    if (roster === undefined) throw new LeagueTransactionError('Transaction references an unknown manager')
    if (transaction.kind === 'WAIVER') {
      validateWaiverPosition(transaction)
      if (transaction.status !== 'PROCESSED') return
      const result = removeOwnedPlayer(roster.players, transaction.waivedPlayer, roster.managerName)
      roster.players = [...result.remaining, acquiredPlayer(transaction.claimedPlayer)]
      return
    }
    validateFreeAgentPosition(transaction)
    if (transaction.status !== 'PROCESSED') return
    const result = removeOwnedPlayer(roster.players, transaction.releasedPlayer, roster.managerName)
    roster.players = [...result.remaining, acquiredPlayer(transaction.addedPlayer)]
  })

  const rosters = snapshot.managers.map((manager) => {
    const roster = mutable.get(manager.id)
    if (roster === undefined) throw new LeagueTransactionError(`Missing roster for ${manager.displayName}`)
    return Object.freeze({
      managerId: roster.managerId,
      managerName: roster.managerName,
      players: Object.freeze([...roster.players]),
      positionCounts: countPositions(roster.players),
    })
  })
  assertLegalRosters(rosters)
  return Object.freeze(rosters)
}

export function buildPlayerOwnershipDirectory(
  players: readonly Player[],
  rosters: readonly CurrentLeagueRoster[],
  snapshot: OfficialDraftSnapshot,
): readonly PlayerOwnershipEntry[] {
  validateUniqueRosterOwnership(rosters)
  const ownerByPlayerId = new Map<string, CurrentLeagueRoster>()
  rosters.forEach((roster) => roster.players.forEach((player) => ownerByPlayerId.set(player.playerId, roster)))
  const originalPickByPlayerId = new Map(snapshot.picks.map((pick) => [pick.draftPlayerId, pick]))
  return Object.freeze(players.map((player) => {
    const owner = ownerByPlayerId.get(player.id)
    const originalPick = originalPickByPlayerId.get(player.id)
    return Object.freeze({
      player,
      ownerManagerId: owner?.managerId ?? null,
      ownerName: owner?.managerName ?? 'FREE AGENT',
      originalDraftPick: originalPick?.overallPickNumber ?? null,
      draftDayMvpRank: originalPick?.mvpConsensusRankAtDraft ?? null,
    })
  }))
}

export function buildLeagueActivity(
  snapshot: OfficialDraftSnapshot,
  transactions: readonly LeagueTransaction[],
): readonly LeagueActivityEvent[] {
  const managerById = new Map(snapshot.managers.map((manager) => [manager.id, manager.displayName]))
  const draftEvents: LeagueActivityEvent[] = snapshot.picks.map((pick) => ({
    id: `draft-${pick.overallPickNumber}`,
    kind: 'DRAFT',
    gameweek: null,
    occurredAt: snapshot.completedAt,
    description: `Pick #${pick.overallPickNumber}: ${pick.managerName} drafted ${pick.playerName}`,
  }))
  const transactionEvents: LeagueActivityEvent[] = transactions.map((transaction) => {
    if (transaction.kind === 'TRADE') {
      return {
        id: transaction.id,
        kind: transaction.kind,
        gameweek: transaction.gameweek,
        occurredAt: transaction.createdAt,
        description: `${managerById.get(transaction.fromManagerId) ?? transaction.fromManagerId} ↔ ${managerById.get(transaction.toManagerId) ?? transaction.toManagerId} trade ${transaction.status.toLowerCase()}`,
      }
    }
    const added = transaction.kind === 'WAIVER'
      ? transaction.claimedPlayer.displayName
      : transaction.addedPlayer.displayName
    return {
      id: transaction.id,
      kind: transaction.kind,
      gameweek: transaction.gameweek,
      occurredAt: transaction.createdAt,
      description: `${managerById.get(transaction.managerId) ?? transaction.managerId} added ${added}`,
    }
  })
  return Object.freeze([...transactionEvents, ...draftEvents].sort(
    (left, right) => right.occurredAt.localeCompare(left.occurredAt) || right.id.localeCompare(left.id),
  ))
}
