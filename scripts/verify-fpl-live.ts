import {
  FPL_DRAFT_BOOTSTRAP_ENDPOINT,
  FplDataError,
  retrieveFplPlayerData,
} from '../src/services/fpl/index.ts'

try {
  const result = await retrieveFplPlayerData()
  const positionCounts = Object.fromEntries(
    ['GK', 'DEF', 'MID', 'FWD'].map((position) => [
      position,
      result.players.filter((player) => player.position === position).length,
    ]),
  )

  console.log(
    JSON.stringify(
      {
        endpoint: FPL_DRAFT_BOOTSTRAP_ENDPOINT,
        retrievedAt: result.retrievedAt,
        normalizedPlayerCount: result.playerCount,
        clubCount: new Set(result.players.map((player) => player.club.id)).size,
        positionCounts,
        playersWithOfficialDraftRank: result.players.filter(
          (player) => player.officialDraftRank !== null,
        ).length,
        rejectedOrSkippedRecords: 0,
      },
      null,
      2,
    ),
  )
} catch (error) {
  if (error instanceof FplDataError) {
    console.error(`${error.code}: ${error.message}`)
  } else {
    console.error(error)
  }
  process.exitCode = 1
}
