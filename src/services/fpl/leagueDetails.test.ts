import { describe, expect, it, vi } from 'vitest'

import { FplDataError } from './errors.ts'
import {
  getFplDraftLeagueDetailsEndpoint,
  normalizeFplDraftLeagueDetails,
  retrieveFplDraftLeagueDetails,
} from './leagueDetails.ts'

function rawLeagueDetails() {
  return {
    league: {
      id: 12345,
      name: 'Kile N Others',
      scoring: 'c',
      start_event: 1,
      stop_event: 38,
      draft_status: 'post',
    },
    league_entries: [
      {
        entry_id: 101,
        id: 201,
        entry_name: 'Jakin Goff',
        player_first_name: 'Vuk',
        player_last_name: 'Example',
      },
    ],
    standings: [
      { league_entry: 201, rank: 1, last_rank: null, rank_sort: 1, event_total: 55, total: 55 },
    ],
  }
}

describe('FPL Draft league-details adapter', () => {
  it('normalizes the observed public league, participant and standings fields', () => {
    expect(normalizeFplDraftLeagueDetails(rawLeagueDetails())).toEqual({
      leagueId: 12345,
      leagueName: 'Kile N Others',
      scoring: 'c',
      startEvent: 1,
      stopEvent: 38,
      draftStatus: 'post',
      participants: [{
        officialEntryId: 101,
        officialLeagueEntryId: 201,
        entryName: 'Jakin Goff',
        playerFirstName: 'Vuk',
      }],
      standings: [{
        officialLeagueEntryId: 201,
        rank: 1,
        lastRank: null,
        rankSort: 1,
        eventTotal: 55,
        total: 55,
      }],
    })
  })

  it('rejects duplicate official entry and league-entry identifiers', () => {
    const raw = rawLeagueDetails()
    raw.league_entries.push({
      entry_id: 101,
      id: 202,
      entry_name: 'Dindi',
      player_first_name: 'Kristian',
      player_last_name: 'Example',
    })

    expect(() => normalizeFplDraftLeagueDetails(raw)).toThrowError(
      new FplDataError('MISSING_REQUIRED_MAPPING', 'Duplicate official entry ID 101'),
    )
  })

  it('fetches only the exact public league-details endpoint', async () => {
    const fetchImplementation = vi.fn(async () => new Response(
      JSON.stringify(rawLeagueDetails()),
      { status: 200, headers: { 'content-type': 'application/json' } },
    ))

    const result = await retrieveFplDraftLeagueDetails(12345, { fetchImplementation })

    expect(fetchImplementation).toHaveBeenCalledWith(
      'https://draft.premierleague.com/api/league/12345/details',
      expect.objectContaining({
        headers: { accept: 'application/json' },
        signal: expect.any(AbortSignal),
      }),
    )
    expect(result.leagueId).toBe(12345)
    expect(getFplDraftLeagueDetailsEndpoint(12345)).toContain('/league/12345/details')
  })

  it('fails predictably on invalid IDs and upstream responses', async () => {
    expect(() => getFplDraftLeagueDetailsEndpoint(0)).toThrowError(FplDataError)
    await expect(retrieveFplDraftLeagueDetails(12345, {
      fetchImplementation: async () => new Response('{}', {
        status: 404,
        headers: { 'content-type': 'application/json' },
      }),
    })).rejects.toMatchObject({ code: 'UPSTREAM_HTTP_ERROR' })
  })
})
