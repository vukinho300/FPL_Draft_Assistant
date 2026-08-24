import type { ManagerId } from '../../../domain/manager.ts'
import type { FplDraftChoices } from '../../../services/fpl/draftChoices.ts'
import { getFplDraftChoicesEndpoint } from '../../../services/fpl/draftChoices.ts'
import { FplDataError } from '../../../services/fpl/errors.ts'
import type {
  FplDraftLeagueDetails,
  FplDraftLeagueParticipant,
} from '../../../services/fpl/leagueDetails.ts'
import { getFplDraftLeagueDetailsEndpoint } from '../../../services/fpl/leagueDetails.ts'
import { KILE_N_OTHERS_ACCOUNT_ROSTER_IDENTITIES } from './accountRosterIdentity.ts'
import { officialDraft202627 } from './officialDraft2026-27.ts'

export interface OfficialLeagueParticipantIdentity {
  readonly teamName: string
  readonly accountManagerName: string
  readonly rosterManagerId: ManagerId
  readonly officialEntryId: number
  readonly officialLeagueEntryId: number
  readonly officialEntryName: string
  readonly officialPlayerFirstName: string
}

export interface OfficialLeagueIdentityEvidence {
  readonly schemaVersion: 1
  readonly season: '2026/27'
  readonly leagueId: number
  readonly leagueName: string
  readonly verifiedAt: string
  readonly detailsSourceEndpoint: string
  readonly draftChoicesSourceEndpoint: string
  readonly mappingBasis: 'EXACT_IMMUTABLE_DRAFT_ROSTER_PLAYER_IDS'
  readonly participants: readonly OfficialLeagueParticipantIdentity[]
}

function fail(message: string): never {
  throw new FplDataError('MISSING_REQUIRED_MAPPING', message)
}

function requirePositiveInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) fail(`${label} must be a positive integer`)
}

function requireExactText(value: string, label: string): void {
  if (value.trim() === '' || value !== value.trim()) fail(`${label} must be exact non-empty text`)
}

function compareOfficialParticipant(
  evidence: OfficialLeagueParticipantIdentity,
  participant: FplDraftLeagueParticipant,
): void {
  const comparisons = [
    ['league-entry ID', evidence.officialLeagueEntryId, participant.officialLeagueEntryId],
    ['entry name', evidence.officialEntryName, participant.entryName],
    ['player first name', evidence.officialPlayerFirstName, participant.playerFirstName],
  ] as const

  comparisons.forEach(([label, expected, actual]) => {
    if (expected !== actual) {
      fail(`Official entry ${evidence.officialEntryId} ${label} mismatch: expected ${expected}, received ${actual}`)
    }
  })
}

export function validateOfficialLeagueIdentityEvidence(
  evidence: OfficialLeagueIdentityEvidence,
): OfficialLeagueIdentityEvidence {
  if (evidence.schemaVersion !== 1 || evidence.season !== '2026/27') {
    fail('Unsupported official league identity evidence version or season')
  }
  requirePositiveInteger(evidence.leagueId, 'Official league ID')
  requireExactText(evidence.verifiedAt, 'Verification timestamp')
  requireExactText(evidence.leagueName, 'Official league name')
  requireExactText(evidence.detailsSourceEndpoint, 'League-details source endpoint')
  requireExactText(evidence.draftChoicesSourceEndpoint, 'Draft-choices source endpoint')
  if (Number.isNaN(Date.parse(evidence.verifiedAt))) fail('Verification timestamp must be ISO-compatible')
  if (evidence.detailsSourceEndpoint !== getFplDraftLeagueDetailsEndpoint(evidence.leagueId)) {
    fail('Details source endpoint does not match the official league-details endpoint')
  }
  if (evidence.draftChoicesSourceEndpoint !== getFplDraftChoicesEndpoint(evidence.leagueId)) {
    fail('Choices source endpoint does not match the official draft-choices endpoint')
  }
  if (evidence.mappingBasis !== 'EXACT_IMMUTABLE_DRAFT_ROSTER_PLAYER_IDS') {
    fail('Unsupported official league identity mapping basis')
  }
  if (evidence.participants.length !== 6) fail('Kile N Others must contain exactly six official participants')

  const entryIds = new Set<number>()
  const leagueEntryIds = new Set<number>()
  const productKeys = new Set<string>()

  evidence.participants.forEach((identity) => {
    requirePositiveInteger(identity.officialEntryId, `${identity.teamName} official entry ID`)
    requirePositiveInteger(identity.officialLeagueEntryId, `${identity.teamName} official league-entry ID`)
    requireExactText(identity.officialEntryName, `${identity.teamName} official entry name`)
    requireExactText(identity.officialPlayerFirstName, `${identity.teamName} official player first name`)

    const approved = KILE_N_OTHERS_ACCOUNT_ROSTER_IDENTITIES.find((candidate) => (
      candidate.teamName === identity.teamName
      && candidate.accountManagerName === identity.accountManagerName
      && candidate.rosterManagerId === identity.rosterManagerId
    ))
    if (approved === undefined) fail(`Unknown or inconsistent product identity for ${identity.teamName}`)
    const productKey = `${identity.teamName}\u0000${identity.accountManagerName}\u0000${identity.rosterManagerId}`
    if (productKeys.has(productKey)) fail(`Duplicate product identity for ${identity.teamName}`)
    if (entryIds.has(identity.officialEntryId)) fail(`Duplicate official entry ID ${identity.officialEntryId}`)
    if (leagueEntryIds.has(identity.officialLeagueEntryId)) {
      fail(`Duplicate official league-entry ID ${identity.officialLeagueEntryId}`)
    }
    productKeys.add(productKey)
    entryIds.add(identity.officialEntryId)
    leagueEntryIds.add(identity.officialLeagueEntryId)
  })

  KILE_N_OTHERS_ACCOUNT_ROSTER_IDENTITIES.forEach((approved) => {
    if (!productKeys.has(`${approved.teamName}\u0000${approved.accountManagerName}\u0000${approved.rosterManagerId}`)) {
      fail(`Approved product identity ${approved.teamName} is missing from official league evidence`)
    }
  })

  return Object.freeze({
    ...evidence,
    participants: Object.freeze(evidence.participants.map((identity) => Object.freeze({ ...identity }))),
  })
}

export function verifyOfficialLeagueIdentity(
  evidence: OfficialLeagueIdentityEvidence,
  details: FplDraftLeagueDetails,
  draftChoices: FplDraftChoices,
): OfficialLeagueIdentityEvidence {
  const validated = validateOfficialLeagueIdentityEvidence(evidence)
  if (validated.leagueId !== details.leagueId || validated.leagueName !== details.leagueName) {
    fail('Official league ID or name does not match the verified Kile N Others evidence')
  }
  if (details.participants.length !== 6) {
    fail('Kile N Others must contain exactly six official participants')
  }
  if (draftChoices.leagueId !== validated.leagueId || draftChoices.choices.length !== 90) {
    fail('Official draft choices must contain exactly 90 picks for the verified league')
  }

  const liveByEntryId = new Map(details.participants.map((participant) => [participant.officialEntryId, participant]))
  const entryIds = new Set(validated.participants.map(({ officialEntryId }) => officialEntryId))
  const leagueEntryIds = new Set(
    validated.participants.map(({ officialLeagueEntryId }) => officialLeagueEntryId),
  )

  validated.participants.forEach((identity) => {
    const liveParticipant = liveByEntryId.get(identity.officialEntryId)
    if (liveParticipant === undefined) fail(`Official entry ${identity.officialEntryId} is missing from the league`)
    compareOfficialParticipant(identity, liveParticipant)

    const entryChoices = draftChoices.choices.filter(
      ({ officialEntryId }) => officialEntryId === identity.officialEntryId,
    )
    if (entryChoices.length !== 15) {
      fail(`Official entry ${identity.officialEntryId} must have exactly 15 original draft choices`)
    }
    entryChoices.forEach((choice) => {
      if (
        choice.entryName !== identity.officialEntryName
        || choice.playerFirstName !== identity.officialPlayerFirstName
      ) {
        fail(`Official draft choice identity contradicts entry ${identity.officialEntryId}`)
      }
    })

    const choicePlayerIds = new Set(entryChoices.map(({ elementId }) => elementId))
    if (choicePlayerIds.size !== 15) {
      fail(`Official entry ${identity.officialEntryId} contains duplicate draft player IDs`)
    }
    const matchingRosterIds = officialDraft202627.finalRosters
      .filter((roster) => (
        roster.players.length === choicePlayerIds.size
        && roster.players.every(({ draftPlayerId }) => choicePlayerIds.has(draftPlayerId))
      ))
      .map(({ managerId }) => managerId)
    if (matchingRosterIds.length !== 1 || matchingRosterIds[0] !== identity.rosterManagerId) {
      fail(`Official entry ${identity.officialEntryId} does not uniquely match ${identity.rosterManagerId}`)
    }
  })

  details.participants.forEach(({ officialEntryId }) => {
    if (!entryIds.has(officialEntryId)) fail(`Unexpected official entry ${officialEntryId} is present in the league`)
  })
  draftChoices.choices.forEach(({ officialEntryId }) => {
    if (!entryIds.has(officialEntryId)) {
      fail(`Unexpected official draft-choice entry ${officialEntryId} is present in the league`)
    }
  })

  const standingIds = new Set(details.standings.map(({ officialLeagueEntryId }) => officialLeagueEntryId))
  if (standingIds.size !== 6 || [...leagueEntryIds].some((id) => !standingIds.has(id))) {
    fail('League standings do not contain exactly the six verified league-entry IDs')
  }

  return validated
}
