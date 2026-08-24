import { FplDataError } from './errors.ts'

export type UnknownRecord = Record<string, unknown>

export function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function readRecord(record: UnknownRecord, field: string, context: string): UnknownRecord {
  const value = record[field]
  if (!isRecord(value)) {
    throw new FplDataError('UNEXPECTED_SCHEMA', `${context}.${field} must be an object`)
  }
  return value
}

export function readArray(record: UnknownRecord, field: string, context: string): unknown[] {
  const value = record[field]
  if (!Array.isArray(value)) {
    throw new FplDataError('UNEXPECTED_SCHEMA', `${context}.${field} must be an array`)
  }
  return value
}

export function readBoolean(record: UnknownRecord, field: string, context: string): boolean {
  const value = record[field]
  if (typeof value !== 'boolean') {
    throw new FplDataError('UNEXPECTED_SCHEMA', `${context}.${field} must be a boolean`)
  }
  return value
}

export function readInteger(record: UnknownRecord, field: string, context: string): number {
  const value = record[field]
  if (!Number.isSafeInteger(value)) {
    throw new FplDataError('UNEXPECTED_SCHEMA', `${context}.${field} must be an integer`)
  }
  return value as number
}

export function readPositiveInteger(record: UnknownRecord, field: string, context: string): number {
  const value = readInteger(record, field, context)
  if (value <= 0) {
    throw new FplDataError('UNEXPECTED_SCHEMA', `${context}.${field} must be a positive integer`)
  }
  return value
}

export function readNullableInteger(
  record: UnknownRecord,
  field: string,
  context: string,
): number | null {
  return record[field] === null ? null : readInteger(record, field, context)
}

export function readNullablePositiveInteger(
  record: UnknownRecord,
  field: string,
  context: string,
): number | null {
  return record[field] === null ? null : readPositiveInteger(record, field, context)
}

export function readString(record: UnknownRecord, field: string, context: string): string {
  const value = record[field]
  if (typeof value !== 'string') {
    throw new FplDataError('UNEXPECTED_SCHEMA', `${context}.${field} must be a string`)
  }
  return value
}

export function readNonEmptyString(record: UnknownRecord, field: string, context: string): string {
  const value = readString(record, field, context).trim()
  if (value === '') {
    throw new FplDataError('UNEXPECTED_SCHEMA', `${context}.${field} must be a non-empty string`)
  }
  return value
}

export function readIsoTimestamp(record: UnknownRecord, field: string, context: string): string {
  const value = readNonEmptyString(record, field, context)
  if (Number.isNaN(Date.parse(value))) {
    throw new FplDataError('UNEXPECTED_SCHEMA', `${context}.${field} must be an ISO timestamp`)
  }
  return value
}

export function readNullableIsoTimestamp(
  record: UnknownRecord,
  field: string,
  context: string,
): string | null {
  return record[field] === null ? null : readIsoTimestamp(record, field, context)
}
