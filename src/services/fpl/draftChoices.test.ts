import { describe, expect, it, vi } from 'vitest'

import { FplDataError } from './errors.ts'
import {
  normalizeFplDraftChoices,
  retrieveFplDraftChoices,
} from './draftChoices.ts'

function responseBody() {
  return {
    choices: [{
      element: 411,
      entry: 240560,
      entry_name: 'Jakin Goff',
      index: 2,
      league: 45938,
      pick: 2,
      player_first_name: 'Vuk',
      player_last_name: 'Andrijašević',
      round: 1,
    }],
  }
}

describe('FPL Draft choices adapter', () => {
  it('normalizes the observed public draft-choice identity fields', () => {
    expect(normalizeFplDraftChoices(responseBody(), 45938)).toEqual({
      leagueId: 45938,
      choices: [{
        leagueId: 45938,
        officialEntryId: 240560,
        elementId: '411',
        overallIndex: 2,
        round: 1,
        pickInRound: 2,
        entryName: 'Jakin Goff',
        playerFirstName: 'Vuk',
      }],
    })
  })

  it('rejects contradictory league IDs and duplicate choice indexes', () => {
    const wrongLeague = responseBody()
    wrongLeague.choices[0].league = 99999
    expect(() => normalizeFplDraftChoices(wrongLeague, 45938)).toThrow(/instead of 45938/)

    const duplicate = responseBody()
    duplicate.choices.push({ ...duplicate.choices[0] })
    expect(() => normalizeFplDraftChoices(duplicate, 45938)).toThrow(
      new FplDataError('MISSING_REQUIRED_MAPPING', 'Duplicate official draft index 2'),
    )
  })

  it('retrieves the exact read-only public choices route', async () => {
    const fetchImplementation = vi.fn(async () => new Response(
      JSON.stringify(responseBody()),
      { status: 200, headers: { 'content-type': 'application/json' } },
    ))
    const result = await retrieveFplDraftChoices(45938, fetchImplementation)

    expect(fetchImplementation).toHaveBeenCalledWith(
      'https://draft.premierleague.com/api/draft/45938/choices',
      { headers: { accept: 'application/json' } },
    )
    expect(result.choices).toHaveLength(1)
  })
})
