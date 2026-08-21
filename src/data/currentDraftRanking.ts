import type { DraftRankingSignal } from '../domain/draftRanking.ts'
import rawArtifact from './currentDraftRankingSignals.json' with { type: 'json' }

export interface CurrentDraftRankingArtifact {
  readonly schemaVersion: number
  readonly generatedAt: string
  readonly targetSeason: string
  readonly priorSeason: string
  readonly trainingSeasons: readonly string[]
  readonly model: string
  readonly featureGroups: readonly string[]
  readonly alpha: number
  readonly source: string
  readonly qualityStatus: string
  readonly leakageStatus: string
  readonly modelSanityStatus: string
  readonly playerCount: number
  readonly historicalMatchCount: number
  readonly unmatchedCount: number
  readonly ambiguousCount: number
  readonly conflictCount: number
  readonly modelSignalCount: number
  readonly modelSignalAvailable: boolean
  readonly players: readonly DraftRankingSignal[]
}

export class CurrentDraftRankingArtifactError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CurrentDraftRankingArtifactError'
  }
}

function invariant(condition: boolean, message: string): asserts condition {
  if (!condition) throw new CurrentDraftRankingArtifactError(message)
}

/** Fail closed if the committed full-pool model evidence loses identity or rank integrity. */
export function validateCurrentDraftRankingArtifact(
  artifact: CurrentDraftRankingArtifact,
): void {
  invariant(artifact.schemaVersion === 1, 'Current draft ranking schemaVersion must be 1')
  invariant(
    artifact.players.length === artifact.playerCount,
    'Current draft ranking player count does not match its records',
  )

  const playerIds = artifact.players.map(({ draftPlayerId }) => draftPlayerId)
  invariant(
    playerIds.every((playerId) => /^\d+$/.test(playerId) && Number(playerId) > 0),
    'Current draft ranking player IDs must be positive numeric Draft IDs',
  )
  invariant(
    new Set(playerIds).size === playerIds.length,
    'Current draft ranking player IDs must be unique',
  )

  const availableSignals = artifact.players.filter(({ modelSignalAvailable }) => modelSignalAvailable)
  invariant(
    availableSignals.length === artifact.modelSignalCount,
    'Current draft ranking model-signal count does not match its records',
  )
  invariant(
    artifact.historicalMatchCount === artifact.modelSignalCount,
    'Exact historical matches must equal available model signals',
  )
  invariant(
    artifact.historicalMatchCount + artifact.unmatchedCount === artifact.playerCount,
    'Current draft ranking identity coverage is incomplete',
  )
  invariant(
    artifact.ambiguousCount === 0 && artifact.conflictCount === 0,
    'Current draft ranking contains ambiguous or conflicting identities',
  )

  artifact.players.forEach((signal) => {
    invariant(
      signal.modelSignalAvailable === (signal.modelRank !== null),
      `Model availability and rank disagree for player ${signal.draftPlayerId}`,
    )
    invariant(
      signal.modelSignalAvailable
        ? signal.modelPredictedSeasonPoints !== null
          && signal.modelPositionRank !== null
          && signal.unavailableReason === null
        : signal.modelPredictedSeasonPoints === null
          && signal.modelPositionRank === null
          && signal.unavailableReason !== null,
      `Model evidence fields disagree for player ${signal.draftPlayerId}`,
    )
  })
  const ranks = availableSignals.map(({ modelRank }) => modelRank as number).sort((a, b) => a - b)
  invariant(new Set(ranks).size === ranks.length, 'Current draft model ranks must be unique')
  invariant(
    ranks.every((rank, index) => rank === index + 1),
    'Current draft model ranks must be contiguous from 1 through the signal count',
  )
}

const artifact = rawArtifact as CurrentDraftRankingArtifact
validateCurrentDraftRankingArtifact(artifact)

export const currentDraftRankingArtifact = artifact
