import { describe, expect, it } from 'vitest'

import { createBootstrapFixture } from './__fixtures__/bootstrap.ts'
import { normalizeFplBootstrap } from './normalize.ts'

describe('normalizeFplBootstrap', () => {
  it('normalizes live official FPL Draft rank from draft_rank with stable string IDs', () => {
    expect(normalizeFplBootstrap(createBootstrapFixture())).toEqual([
      {
        id: '101',
        displayName: 'Fixture Keeper',
        fullName: 'Fixture Keeper',
        position: 'GK',
        club: { id: '10', name: 'Fixture City', shortName: 'FIX' },
        officialDraftRank: 1,
        form: 4.5,
        totalPoints: 12,
      },
      {
        id: '102',
        displayName: 'Fixture Defender',
        fullName: 'Fixture Defender',
        position: 'DEF',
        club: { id: '10', name: 'Fixture City', shortName: 'FIX' },
        officialDraftRank: 2,
        form: 2,
        totalPoints: 4,
      },
      {
        id: '103',
        displayName: 'Fixture Midfielder',
        fullName: 'Fixture Midfielder',
        position: 'MID',
        club: { id: '20', name: 'Example Athletic', shortName: 'EXA' },
        officialDraftRank: null,
        form: 0,
        totalPoints: 0,
      },
      {
        id: '104',
        displayName: 'Fixture Forward',
        fullName: 'Fixture Forward',
        position: 'FWD',
        club: { id: '20', name: 'Example Athletic', shortName: 'EXA' },
        officialDraftRank: null,
        form: 3.2,
        totalPoints: 9,
      },
    ])
  })

  it('produces the same ID-sorted output for the same records in another order', () => {
    const fixture = createBootstrapFixture()
    const expected = normalizeFplBootstrap(fixture)
    fixture.elements.reverse()

    expect(normalizeFplBootstrap(fixture)).toEqual(expected)
  })

  it('falls back to the verified display name when structured full-name fields are absent', () => {
    const fixture = createBootstrapFixture()
    fixture.elements[0] = {
      id: 104,
      web_name: 'Verified Display',
      team: 20,
      element_type: 4,
    }

    expect(normalizeFplBootstrap(fixture).find(({ id }) => id === '104')).toMatchObject({
      displayName: 'Verified Display',
    })
    expect(normalizeFplBootstrap(fixture).find(({ id }) => id === '104')).not.toHaveProperty('fullName')
  })

  it('rejects a changed top-level schema', () => {
    expect(() => normalizeFplBootstrap({ teams: [], element_types: [] })).toThrowError(
      expect.objectContaining({ code: 'UNEXPECTED_SCHEMA' }),
    )
  })

  it('rejects malformed required player data', () => {
    const fixture = createBootstrapFixture()
    fixture.elements[0] = { ...fixture.elements[0], web_name: null }

    expect(() => normalizeFplBootstrap(fixture)).toThrowError(
      expect.objectContaining({ code: 'INVALID_PLAYER' }),
    )
  })

  it('rejects an unknown upstream position label', () => {
    const fixture = createBootstrapFixture()
    fixture.element_types[0] = { id: 1, singular_name_short: 'WNG' }

    expect(() => normalizeFplBootstrap(fixture)).toThrowError(
      expect.objectContaining({ code: 'MISSING_REQUIRED_MAPPING' }),
    )
  })

  it('rejects an unknown player position reference', () => {
    const fixture = createBootstrapFixture()
    fixture.elements[0] = { ...fixture.elements[0], element_type: 99 }

    expect(() => normalizeFplBootstrap(fixture)).toThrowError(
      expect.objectContaining({ code: 'INVALID_PLAYER' }),
    )
  })

  it('rejects an unknown club reference', () => {
    const fixture = createBootstrapFixture()
    fixture.elements[0] = { ...fixture.elements[0], team: 99 }

    expect(() => normalizeFplBootstrap(fixture)).toThrowError(
      expect.objectContaining({ code: 'INVALID_PLAYER' }),
    )
  })

  it('rejects an invalid official draft rank instead of inventing a value', () => {
    const fixture = createBootstrapFixture()
    fixture.elements[0] = { ...fixture.elements[0], draft_rank: 0 }

    expect(() => normalizeFplBootstrap(fixture)).toThrowError(
      expect.objectContaining({ code: 'INVALID_PLAYER' }),
    )
  })

  it('normalizes official form decimal strings and total points integers', () => {
    const player = normalizeFplBootstrap(createBootstrapFixture()).find(({ id }) => id === '101')
    expect(player).toMatchObject({ form: 4.5, totalPoints: 12 })
  })

  it('rejects invalid official form and total points instead of inventing values', () => {
    const invalidForm = createBootstrapFixture()
    invalidForm.elements[0] = { ...invalidForm.elements[0], form: 'not-a-number' }
    expect(() => normalizeFplBootstrap(invalidForm)).toThrowError(
      expect.objectContaining({ code: 'INVALID_PLAYER' }),
    )

    const invalidPoints = createBootstrapFixture()
    invalidPoints.elements[0] = { ...invalidPoints.elements[0], total_points: -1 }
    expect(() => normalizeFplBootstrap(invalidPoints)).toThrowError(
      expect.objectContaining({ code: 'INVALID_PLAYER' }),
    )
  })

  it('rejects duplicate player IDs', () => {
    const fixture = createBootstrapFixture()
    fixture.elements[1] = { ...fixture.elements[1], id: 104 }

    expect(() => normalizeFplBootstrap(fixture)).toThrowError(
      expect.objectContaining({ code: 'INVALID_PLAYER' }),
    )
  })
})
