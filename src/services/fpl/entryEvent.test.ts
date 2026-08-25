import { describe, expect, it, vi } from 'vitest'

import { FplDataError } from './errors.ts'
import {
  normalizeFplDraftEntryEventLineup,
  normalizeFplDraftEntryHistory,
  retrieveFplDraftEntryEventLineup,
} from './entryEvent.ts'

function rawLineup() {
  return {
    picks: Array.from({ length: 15 }, (_, index) => ({
      element: 100 + index,
      position: index + 1,
      is_captain: false,
      is_vice_captain: false,
      multiplier: 1,
    })),
    entry_history: {},
    subs: [],
  }
}

describe('FPL Draft entry-event contract', () => {
  it('normalizes positions 1-11 as the XI and positions 12-15 as the ordered bench', () => {
    const lineup = normalizeFplDraftEntryEventLineup(rawLineup(), 240560, 1)

    expect(lineup.starters).toHaveLength(11)
    expect(lineup.starters.map(({ position }) => position)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])
    expect(lineup.bench.map(({ position }) => position)).toEqual([12, 13, 14, 15])
    expect(lineup.bench.map(({ elementId }) => elementId)).toEqual(['111', '112', '113', '114'])
    expect(lineup).toMatchObject({
      officialEntryId: 240560,
      eventId: 1,
      substitutions: [],
      substitutionCount: 0,
      entryHistoryAvailable: false,
    })
  })

  it('normalizes applied substitutions only when returned picks prove the effective XI and bench', () => {
    const raw = rawLineup() as Omit<ReturnType<typeof rawLineup>, 'subs'> & {
      subs: Array<{ element_in: number; element_out: number; event: number }>
    }
    raw.subs = [{ element_in: 100, element_out: 111, event: 1 }]
    const lineup = normalizeFplDraftEntryEventLineup(raw, 240560, 1)

    expect(lineup.substitutions).toEqual([{
      elementInId: '100',
      elementOutId: '111',
      eventId: 1,
    }])
    expect(lineup.substitutionCount).toBe(1)

    raw.subs = [{ element_in: 111, element_out: 100, event: 1 }]
    expect(() => normalizeFplDraftEntryEventLineup(raw, 240560, 1)).toThrow(/effective XI/)
  })

  it('normalizes historical official Gameweek and season totals by entry identity', () => {
    expect(normalizeFplDraftEntryHistory({
      history: [{
        entry: 240560,
        event: 1,
        points: 42,
        total_points: 42,
        points_on_bench: 4,
        event_transfers: 0,
        rank: null,
        rank_sort: null,
      }],
      entry: { id: 240560 },
    }, 240560)).toEqual({
      officialEntryId: 240560,
      records: [{
        eventId: 1,
        eventPoints: 42,
        seasonTotal: 42,
        pointsOnBench: 4,
        transfers: 0,
        rank: null,
        rankSort: null,
      }],
    })
  })

  it('rejects duplicate players, incomplete positions, and contradictory history identity', () => {
    const duplicate = rawLineup()
    duplicate.picks[1].element = duplicate.picks[0].element
    expect(() => normalizeFplDraftEntryEventLineup(duplicate, 240560, 1)).toThrow(/Duplicate lineup player/)

    const gap = rawLineup()
    gap.picks[14].position = 14
    expect(() => normalizeFplDraftEntryEventLineup(gap, 240560, 1)).toThrow(/Duplicate or invalid lineup position/)

    expect(() => normalizeFplDraftEntryHistory({
      history: [{
        entry: 999,
        event: 1,
        points: 1,
        total_points: 1,
        points_on_bench: 0,
        event_transfers: 0,
        rank: null,
        rank_sort: null,
      }],
    }, 240560)).toThrow(/instead of 240560/)
  })

  it('uses the exact read-only endpoint and reports not-yet-available responses predictably', async () => {
    const fetchImplementation = vi.fn(async () => new Response('"No pick history"', {
      status: 404,
      headers: { 'content-type': 'application/json' },
    }))

    await expect(retrieveFplDraftEntryEventLineup(240560, 2, fetchImplementation)).rejects.toEqual(
      new FplDataError(
        'UPSTREAM_HTTP_ERROR',
        'FPL Draft entry 240560 event 2 endpoint returned HTTP 404',
      ),
    )
    expect(fetchImplementation).toHaveBeenCalledWith(
      'https://draft.premierleague.com/api/entry/240560/event/2',
      expect.objectContaining({
        headers: { accept: 'application/json' },
        signal: expect.any(AbortSignal),
      }),
    )
  })
})
