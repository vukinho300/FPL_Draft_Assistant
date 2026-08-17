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

export const currentDraftRankingArtifact =
  rawArtifact as CurrentDraftRankingArtifact
