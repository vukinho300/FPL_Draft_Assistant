import { describe, expect, it } from 'vitest'

import {
  CurrentDraftRankingArtifactError,
  currentDraftRankingArtifact,
  validateCurrentDraftRankingArtifact,
  type CurrentDraftRankingArtifact,
} from './currentDraftRanking.ts'

describe('committed current draft ranking provenance', () => {
  it('retains the complete 2026/27 identity universe and contiguous trusted model ranks', () => {
    validateCurrentDraftRankingArtifact(currentDraftRankingArtifact)

    const playerIds = currentDraftRankingArtifact.players.map(({ draftPlayerId }) => draftPlayerId)
    const modelRanks = currentDraftRankingArtifact.players
      .flatMap(({ modelRank }) => modelRank === null ? [] : [modelRank])
      .sort((left, right) => left - right)

    expect(currentDraftRankingArtifact.playerCount).toBe(590)
    expect(currentDraftRankingArtifact.modelSignalCount).toBe(460)
    expect(new Set(playerIds).size).toBe(590)
    expect(modelRanks).toEqual(Array.from({ length: 460 }, (_, index) => index + 1))
  })

  it('rejects duplicate identity or model-rank assignments', () => {
    const duplicateIdentity = {
      ...currentDraftRankingArtifact,
      players: currentDraftRankingArtifact.players.map((signal, index) => index === 1
        ? { ...signal, draftPlayerId: currentDraftRankingArtifact.players[0].draftPlayerId }
        : signal),
    } as CurrentDraftRankingArtifact
    expect(() => validateCurrentDraftRankingArtifact(duplicateIdentity)).toThrowError(
      CurrentDraftRankingArtifactError,
    )

    const ranked = currentDraftRankingArtifact.players.filter(({ modelRank }) => modelRank !== null)
    const duplicateRank = {
      ...currentDraftRankingArtifact,
      players: currentDraftRankingArtifact.players.map((signal) => signal.draftPlayerId === ranked[1].draftPlayerId
        ? { ...signal, modelRank: ranked[0].modelRank }
        : signal),
    } as CurrentDraftRankingArtifact
    expect(() => validateCurrentDraftRankingArtifact(duplicateRank)).toThrowError(
      CurrentDraftRankingArtifactError,
    )
  })
})
