import { describe, expect, it } from 'vitest'

import type { FplDraftChoices } from '../../../services/fpl/draftChoices.ts'
import type { FplDraftLeagueDetails } from '../../../services/fpl/leagueDetails.ts'
import { KILE_N_OTHERS_ACCOUNT_ROSTER_IDENTITIES } from './accountRosterIdentity.ts'
import { officialDraft202627 } from './officialDraft2026-27.ts'
import { officialLeagueIdentity202627 } from './officialLeagueIdentity2026-27.ts'
import {
  validateOfficialLeagueIdentityEvidence,
  verifyOfficialLeagueIdentity,
  type OfficialLeagueIdentityEvidence,
} from './officialLeagueIdentity.ts'

function evidence(): OfficialLeagueIdentityEvidence {
  return {
    schemaVersion: 1,
    season: '2026/27',
    leagueId: 12345,
    leagueName: 'Kile n Others',
    verifiedAt: '2026-08-24T12:00:00.000Z',
    detailsSourceEndpoint: 'https://draft.premierleague.com/api/league/12345/details',
    draftChoicesSourceEndpoint: 'https://draft.premierleague.com/api/draft/12345/choices',
    mappingBasis: 'EXACT_IMMUTABLE_DRAFT_ROSTER_PLAYER_IDS',
    participants: KILE_N_OTHERS_ACCOUNT_ROSTER_IDENTITIES.map((identity, index) => ({
      ...identity,
      officialEntryId: 1001 + index,
      officialLeagueEntryId: 2001 + index,
      officialEntryName: index === 4 ? 'Rod Wave Elite' : identity.teamName,
      officialPlayerFirstName: index === 2 ? 'diego' : identity.accountManagerName,
    })),
  }
}

function choices(source = evidence()): FplDraftChoices {
  let overallIndex = 0
  return {
    leagueId: source.leagueId,
    choices: source.participants.flatMap((identity) => {
      const roster = officialDraft202627.finalRosters.find(
        ({ managerId }) => managerId === identity.rosterManagerId,
      )!
      return roster.players.map((player, index) => ({
        leagueId: source.leagueId,
        officialEntryId: identity.officialEntryId,
        elementId: player.draftPlayerId,
        overallIndex: ++overallIndex,
        round: index + 1,
        pickInRound: index + 1,
        entryName: identity.officialEntryName,
        playerFirstName: identity.officialPlayerFirstName,
      }))
    }),
  }
}

function details(source = evidence()): FplDraftLeagueDetails {
  return {
    leagueId: source.leagueId,
    leagueName: source.leagueName,
    scoring: 'c',
    startEvent: 1,
    stopEvent: 38,
    draftStatus: 'post',
    participants: [...source.participants].reverse().map((identity) => ({
      officialEntryId: identity.officialEntryId,
      officialLeagueEntryId: identity.officialLeagueEntryId,
      entryName: identity.officialEntryName,
      playerFirstName: identity.officialPlayerFirstName,
    })),
    standings: [...source.participants].reverse().map((identity, index) => ({
      officialLeagueEntryId: identity.officialLeagueEntryId,
      rank: index + 1,
      lastRank: null,
      rankSort: index + 1,
      eventTotal: 0,
      total: 0,
    })),
  }
}

describe('Kile N Others official FPL Draft identity evidence', () => {
  it('commits the six verified official entry mappings in product identity order', () => {
    expect(officialLeagueIdentity202627.leagueId).toBe(45938)
    expect(officialLeagueIdentity202627.leagueName).toBe('Kile n Others')
    expect(officialLeagueIdentity202627.participants.map((identity) => ({
      teamName: identity.teamName,
      rosterManagerId: identity.rosterManagerId,
      officialEntryId: identity.officialEntryId,
      officialLeagueEntryId: identity.officialLeagueEntryId,
    }))).toEqual([
      { teamName: 'Jakin Goff', rosterManagerId: 'demo-manager-1', officialEntryId: 240560, officialLeagueEntryId: 242345 },
      { teamName: 'Dindi', rosterManagerId: 'demo-manager-3', officialEntryId: 240676, officialLeagueEntryId: 242463 },
      { teamName: '22nd oBlock', rosterManagerId: 'demo-manager-2', officialEntryId: 240707, officialLeagueEntryId: 242494 },
      { teamName: 'Miku007', rosterManagerId: 'demo-manager-4', officialEntryId: 240723, officialLeagueEntryId: 242510 },
      { teamName: 'Rod Wave Disciples', rosterManagerId: 'demo-manager-6', officialEntryId: 261369, officialLeagueEntryId: 263632 },
      { teamName: 'Tintilinic', rosterManagerId: 'demo-manager-5', officialEntryId: 261515, officialLeagueEntryId: 263779 },
    ])
  })

  it('validates the committed mapping independently of a live response', () => {
    expect(validateOfficialLeagueIdentityEvidence(evidence()).participants).toHaveLength(6)
  })

  it('maps all six product and roster identities by explicit IDs rather than response order', () => {
    const verified = verifyOfficialLeagueIdentity(evidence(), details(), choices())

    expect(verified.participants).toHaveLength(6)
    expect(new Set(verified.participants.map(({ officialEntryId }) => officialEntryId)).size).toBe(6)
    expect(new Set(verified.participants.map(({ officialLeagueEntryId }) => officialLeagueEntryId)).size).toBe(6)
    expect(verified.participants.map(({ rosterManagerId }) => rosterManagerId)).toEqual([
      'demo-manager-1',
      'demo-manager-3',
      'demo-manager-2',
      'demo-manager-4',
      'demo-manager-6',
      'demo-manager-5',
    ])
  })

  it('fails closed for duplicate, missing or contradictory entry evidence', () => {
    const duplicate = structuredClone(evidence()) as {
      participants: OfficialLeagueIdentityEvidence['participants'][number][]
    } & Omit<OfficialLeagueIdentityEvidence, 'participants'>
    duplicate.participants[1] = {
      ...duplicate.participants[1],
      officialEntryId: duplicate.participants[0].officialEntryId,
    }
    expect(() => verifyOfficialLeagueIdentity(duplicate, details(), choices())).toThrow(/Duplicate official entry ID/)

    const missing = structuredClone(details()) as {
      participants: FplDraftLeagueDetails['participants'][number][]
    } & Omit<FplDraftLeagueDetails, 'participants'>
    missing.participants.splice(0, 1)
    expect(() => verifyOfficialLeagueIdentity(evidence(), missing, choices())).toThrow(/exactly six official participants/)

    const contradictory = structuredClone(details()) as {
      participants: FplDraftLeagueDetails['participants'][number][]
    } & Omit<FplDraftLeagueDetails, 'participants'>
    contradictory.participants[0] = { ...contradictory.participants[0], entryName: 'Wrong team' }
    expect(() => verifyOfficialLeagueIdentity(evidence(), contradictory, choices())).toThrow(/entry name mismatch/)
  })

  it('rejects an account-to-roster mapping that contradicts the approved product authority', () => {
    const wrongRoster = structuredClone(evidence()) as {
      participants: OfficialLeagueIdentityEvidence['participants'][number][]
    } & Omit<OfficialLeagueIdentityEvidence, 'participants'>
    wrongRoster.participants[3] = {
      ...wrongRoster.participants[3],
      rosterManagerId: 'demo-manager-1',
    }

    expect(() => verifyOfficialLeagueIdentity(wrongRoster, details(), choices())).toThrow(
      /Unknown or inconsistent product identity for Miku007/,
    )
  })

  it('uses exact immutable roster player IDs even when official display names differ', () => {
    const verified = verifyOfficialLeagueIdentity(evidence(), details(), choices())
    expect(verified.participants.find(({ teamName }) => teamName === 'Rod Wave Disciples')).toMatchObject({
      officialEntryName: 'Rod Wave Elite',
      rosterManagerId: 'demo-manager-6',
    })
  })

  it('rejects choice evidence that belongs to another immutable roster', () => {
    const wrongChoices = structuredClone(choices()) as {
      choices: FplDraftChoices['choices'][number][]
    } & Omit<FplDraftChoices, 'choices'>
    const firstJakinChoice = wrongChoices.choices.findIndex(({ officialEntryId }) => officialEntryId === 1001)
    wrongChoices.choices[firstJakinChoice] = {
      ...wrongChoices.choices[firstJakinChoice],
      elementId: '999999',
    }

    expect(() => verifyOfficialLeagueIdentity(evidence(), details(), wrongChoices)).toThrow(
      /does not uniquely match demo-manager-1/,
    )
  })

  it('requires standings to reference exactly the same six league-entry IDs', () => {
    const wrongStandings = structuredClone(details()) as {
      standings: FplDraftLeagueDetails['standings'][number][]
    } & Omit<FplDraftLeagueDetails, 'standings'>
    wrongStandings.standings[0] = { ...wrongStandings.standings[0], officialLeagueEntryId: 9999 }

    expect(() => verifyOfficialLeagueIdentity(evidence(), wrongStandings, choices())).toThrow(
      /standings do not contain exactly the six verified league-entry IDs/,
    )
  })
})
