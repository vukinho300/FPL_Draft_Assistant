/**
 * Tiny fictional fixture shaped from the schema observed on 2026-08-17.
 * Names and values are test-only and are not current FPL data.
 */
export function createBootstrapFixture(): {
  elements: Array<Record<string, unknown>>
  teams: Array<Record<string, unknown>>
  element_types: Array<Record<string, unknown>>
} {
  return {
    teams: [
      { id: 10, name: 'Fixture City', short_name: 'FIX' },
      { id: 20, name: 'Example Athletic', short_name: 'EXA' },
    ],
    element_types: [
      { id: 1, singular_name_short: 'GKP' },
      { id: 2, singular_name_short: 'DEF' },
      { id: 3, singular_name_short: 'MID' },
      { id: 4, singular_name_short: 'FWD' },
    ],
    elements: [
      {
        id: 104,
        first_name: 'Fixture',
        second_name: 'Forward',
        web_name: 'Fixture Forward',
        team: 20,
        element_type: 4,
        form: '3.2',
        total_points: 9,
      },
      {
        id: 102,
        first_name: 'Fixture',
        second_name: 'Defender',
        web_name: 'Fixture Defender',
        team: 10,
        element_type: 2,
        draft_rank: 2,
        form: '2.0',
        total_points: 4,
      },
      {
        id: 101,
        first_name: 'Fixture',
        second_name: 'Keeper',
        web_name: 'Fixture Keeper',
        team: 10,
        element_type: 1,
        draft_rank: 1,
        form: '4.5',
        total_points: 12,
      },
      {
        id: 103,
        first_name: 'Fixture',
        second_name: 'Midfielder',
        web_name: 'Fixture Midfielder',
        team: 20,
        element_type: 3,
        draft_rank: null,
        form: '0.0',
        total_points: 0,
      },
    ],
  }
}
