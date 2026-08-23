import type { Club, Player, Position } from '../../domain/player.ts'
import { FplDataError } from './errors.ts'

type UnknownRecord = Record<string, unknown>

const positionByUpstreamShortName: Readonly<Record<string, Position>> = {
  GKP: 'GK',
  DEF: 'DEF',
  MID: 'MID',
  FWD: 'FWD',
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readPositiveInteger(
  record: UnknownRecord,
  field: string,
  context: string,
  code: 'MISSING_REQUIRED_MAPPING' | 'INVALID_PLAYER',
): number {
  const value = record[field]

  if (!Number.isSafeInteger(value) || (value as number) <= 0) {
    throw new FplDataError(code, `${context}.${field} must be a positive integer`)
  }

  return value as number
}

function readNonEmptyString(
  record: UnknownRecord,
  field: string,
  context: string,
  code: 'MISSING_REQUIRED_MAPPING' | 'INVALID_PLAYER',
): string {
  const value = record[field]

  if (typeof value !== 'string' || value.trim() === '') {
    throw new FplDataError(code, `${context}.${field} must be a non-empty string`)
  }

  return value
}

function readOptionalNonEmptyString(record: UnknownRecord, field: string, context: string): string | null {
  const value = record[field]

  if (value === undefined || value === null) return null
  if (typeof value !== 'string') {
    throw new FplDataError('INVALID_PLAYER', `${context}.${field} must be a string when present`)
  }

  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

function readFullName(record: UnknownRecord, context: string): string | null {
  const firstName = readOptionalNonEmptyString(record, 'first_name', context)
  const secondName = readOptionalNonEmptyString(record, 'second_name', context)
  const nameParts = [firstName, secondName].filter((part): part is string => part !== null)

  return nameParts.length === 0 ? null : nameParts.join(' ')
}

function readOptionalDraftRank(record: UnknownRecord, context: string): number | null {
  const value = record.draft_rank

  if (value === undefined || value === null) {
    return null
  }

  if (!Number.isSafeInteger(value) || (value as number) <= 0) {
    throw new FplDataError(
      'INVALID_PLAYER',
      `${context}.draft_rank must be a positive integer, null, or absent`,
    )
  }

  return value as number
}

function readOptionalForm(record: UnknownRecord, context: string): number | null {
  const value = record.form

  if (value === undefined || value === null) return null
  if (typeof value !== 'string' || !/^-?\d+(?:\.\d+)?$/.test(value)) {
    throw new FplDataError(
      'INVALID_PLAYER',
      `${context}.form must be a signed decimal string, null, or absent`,
    )
  }

  const form = Number(value)
  if (!Number.isFinite(form)) {
    throw new FplDataError('INVALID_PLAYER', `${context}.form must be finite`)
  }

  return form
}

function readOptionalTotalPoints(record: UnknownRecord, context: string): number | null {
  const value = record.total_points

  if (value === undefined || value === null) return null
  if (!Number.isSafeInteger(value)) {
    throw new FplDataError(
      'INVALID_PLAYER',
      `${context}.total_points must be a signed integer, null, or absent`,
    )
  }

  return value as number
}

function readRequiredArray(root: UnknownRecord, field: string): unknown[] {
  const value = root[field]

  if (!Array.isArray(value)) {
    throw new FplDataError(
      'UNEXPECTED_SCHEMA',
      `FPL bootstrap field ${field} must be an array`,
    )
  }

  return value
}

function buildClubMap(rawTeams: unknown[]): Map<number, Club> {
  const clubs = new Map<number, Club>()

  rawTeams.forEach((rawTeam, index) => {
    const context = `teams[${index}]`
    if (!isRecord(rawTeam)) {
      throw new FplDataError('MISSING_REQUIRED_MAPPING', `${context} must be an object`)
    }

    const sourceId = readPositiveInteger(rawTeam, 'id', context, 'MISSING_REQUIRED_MAPPING')
    if (clubs.has(sourceId)) {
      throw new FplDataError(
        'MISSING_REQUIRED_MAPPING',
        `Duplicate team id ${sourceId}`,
      )
    }

    clubs.set(sourceId, {
      id: String(sourceId),
      name: readNonEmptyString(rawTeam, 'name', context, 'MISSING_REQUIRED_MAPPING'),
      shortName: readNonEmptyString(
        rawTeam,
        'short_name',
        context,
        'MISSING_REQUIRED_MAPPING',
      ),
    })
  })

  return clubs
}

function buildPositionMap(rawTypes: unknown[]): Map<number, Position> {
  const positions = new Map<number, Position>()

  rawTypes.forEach((rawType, index) => {
    const context = `element_types[${index}]`
    if (!isRecord(rawType)) {
      throw new FplDataError('MISSING_REQUIRED_MAPPING', `${context} must be an object`)
    }

    const sourceId = readPositiveInteger(rawType, 'id', context, 'MISSING_REQUIRED_MAPPING')
    const shortName = readNonEmptyString(
      rawType,
      'singular_name_short',
      context,
      'MISSING_REQUIRED_MAPPING',
    )
    const position = positionByUpstreamShortName[shortName]

    if (position === undefined) {
      throw new FplDataError(
        'MISSING_REQUIRED_MAPPING',
        `Unknown upstream position ${shortName}`,
      )
    }
    if (positions.has(sourceId)) {
      throw new FplDataError(
        'MISSING_REQUIRED_MAPPING',
        `Duplicate position id ${sourceId}`,
      )
    }

    positions.set(sourceId, position)
  })

  return positions
}

export function normalizeFplBootstrap(rawBootstrap: unknown): Player[] {
  if (!isRecord(rawBootstrap)) {
    throw new FplDataError('UNEXPECTED_SCHEMA', 'FPL bootstrap response must be an object')
  }

  const rawPlayers = readRequiredArray(rawBootstrap, 'elements')
  const clubs = buildClubMap(readRequiredArray(rawBootstrap, 'teams'))
  const positions = buildPositionMap(readRequiredArray(rawBootstrap, 'element_types'))
  const playerIds = new Set<number>()

  const normalized = rawPlayers.map((rawPlayer, index) => {
    const context = `elements[${index}]`
    if (!isRecord(rawPlayer)) {
      throw new FplDataError('INVALID_PLAYER', `${context} must be an object`)
    }

    const sourceId = readPositiveInteger(rawPlayer, 'id', context, 'INVALID_PLAYER')
    if (playerIds.has(sourceId)) {
      throw new FplDataError('INVALID_PLAYER', `Duplicate player id ${sourceId}`)
    }
    playerIds.add(sourceId)

    const sourceClubId = readPositiveInteger(rawPlayer, 'team', context, 'INVALID_PLAYER')
    const club = clubs.get(sourceClubId)
    if (club === undefined) {
      throw new FplDataError(
        'INVALID_PLAYER',
        `${context} references unknown team id ${sourceClubId}`,
      )
    }

    const sourcePositionId = readPositiveInteger(
      rawPlayer,
      'element_type',
      context,
      'INVALID_PLAYER',
    )
    const position = positions.get(sourcePositionId)
    if (position === undefined) {
      throw new FplDataError(
        'INVALID_PLAYER',
        `${context} references unknown position id ${sourcePositionId}`,
      )
    }

    const displayName = readNonEmptyString(rawPlayer, 'web_name', context, 'INVALID_PLAYER')
    const fullName = readFullName(rawPlayer, context)
    const player: Player = {
      id: String(sourceId),
      displayName,
      ...(fullName === null ? {} : { fullName }),
      position,
      club,
      officialDraftRank: readOptionalDraftRank(rawPlayer, context),
      form: readOptionalForm(rawPlayer, context),
      totalPoints: readOptionalTotalPoints(rawPlayer, context),
    }

    return { sourceId, player }
  })

  return normalized
    .sort((left, right) => left.sourceId - right.sourceId)
    .map(({ player }) => player)
}
