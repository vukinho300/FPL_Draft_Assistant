import type { Player, PlayerId, Position } from './player.ts'

/** Project MVP heuristic weights. These are not official FPL values or historically optimized. */
export const OFFICIAL_RANK_WEIGHT = 0.7
export const MODEL_RANK_WEIGHT = 0.3

export interface DraftRankingSignal {
  readonly draftPlayerId: PlayerId
  readonly modelPredictedSeasonPoints: number | null
  readonly modelRank: number | null
  readonly modelPositionRank: number | null
  readonly modelSignalAvailable: boolean
  readonly unavailableReason: string | null
}

export interface RankedDraftPlayer {
  readonly player: Player
  readonly consensusRank: number
  readonly consensusScore: number
  readonly officialRankPercentileScore: number | null
  readonly modelRankPercentileScore: number | null
  readonly modelSignal: DraftRankingSignal | null
}

function percentileScore(rank: number, population: number): number {
  if (!Number.isInteger(rank) || rank < 1) return 0
  if (population <= 1) return 1
  return Math.max(0, Math.min(1, 1 - (rank - 1) / (population - 1)))
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}

function compareRankedEvidence(
  left: Omit<RankedDraftPlayer, 'consensusRank'>,
  right: Omit<RankedDraftPlayer, 'consensusRank'>,
): number {
  const leftOfficial = left.player.officialDraftRank
  const rightOfficial = right.player.officialDraftRank
  if (leftOfficial !== null && rightOfficial === null) return -1
  if (leftOfficial === null && rightOfficial !== null) return 1
  if (left.consensusScore !== right.consensusScore) {
    return right.consensusScore - left.consensusScore
  }
  if (
    leftOfficial !== null &&
    rightOfficial !== null &&
    leftOfficial !== rightOfficial
  ) {
    return leftOfficial - rightOfficial
  }
  return (
    compareText(left.player.displayName, right.player.displayName) ||
    compareText(left.player.id, right.player.id)
  )
}

export function rankPlayersByMvpConsensus(
  players: readonly Player[],
  signals: readonly DraftRankingSignal[],
): readonly RankedDraftPlayer[] {
  const signalByPlayer = new Map(signals.map((signal) => [signal.draftPlayerId, signal]))
  const officialPopulation = players.filter(
    (player) => player.officialDraftRank !== null,
  ).length
  const modelPopulation = signals.filter(
    (signal) => signal.modelSignalAvailable && signal.modelRank !== null,
  ).length

  const evidence = players.map((player) => {
    const rawSignal = signalByPlayer.get(player.id) ?? null
    const modelSignal =
      rawSignal?.modelSignalAvailable === true && rawSignal.modelRank !== null
        ? rawSignal
        : null
    const officialScore =
      player.officialDraftRank === null
        ? null
        : percentileScore(player.officialDraftRank, officialPopulation)
    const modelScore =
      modelSignal === null
        ? null
        : percentileScore(modelSignal.modelRank as number, modelPopulation)
    const consensusScore =
      officialScore === null
        ? modelScore === null
          ? 0
          : MODEL_RANK_WEIGHT * modelScore
        : modelScore === null
          ? officialScore
          : OFFICIAL_RANK_WEIGHT * officialScore + MODEL_RANK_WEIGHT * modelScore

    return {
      player,
      consensusScore,
      officialRankPercentileScore: officialScore,
      modelRankPercentileScore: modelScore,
      modelSignal: rawSignal,
    }
  })

  return Object.freeze(
    evidence.sort(compareRankedEvidence).map((entry, index) =>
      Object.freeze({
        ...entry,
        consensusRank: index + 1,
      }),
    ),
  )
}

export function filterAvailableRankedPlayers(
  rankedPlayers: readonly RankedDraftPlayer[],
  draftedPlayerIds: ReadonlySet<PlayerId>,
  search: string,
  position: Position | 'ALL',
): readonly RankedDraftPlayer[] {
  const normalizedSearch = search.trim().toLocaleLowerCase()
  return rankedPlayers.filter(
    ({ player }) =>
      !draftedPlayerIds.has(player.id) &&
      (position === 'ALL' || player.position === position) &&
      (normalizedSearch === '' ||
        player.displayName.toLocaleLowerCase().includes(normalizedSearch)),
  )
}
