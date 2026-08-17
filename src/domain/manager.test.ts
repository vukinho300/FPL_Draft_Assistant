import { describe, expect, it } from 'vitest'

import {
  createDraftConfiguration,
  getManagerDraftPosition,
  validateManagerConfiguration,
  type Manager,
} from './manager.ts'

function managers(count: number): Manager[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `manager-${index + 1}`,
    displayName: `Manager ${index + 1}`,
  }))
}

describe('manager configuration validation', () => {
  it('rejects an empty manager ID', () => {
    const configured = managers(2)
    configured[0] = { ...configured[0], id: '   ' }

    expect(() => validateManagerConfiguration(configured, 'manager-2')).toThrowError(
      expect.objectContaining({ code: 'EMPTY_MANAGER_ID' }),
    )
  })

  it('rejects a duplicate manager ID', () => {
    const configured = managers(2)
    configured[1] = { ...configured[1], id: configured[0].id }

    expect(() => validateManagerConfiguration(configured, configured[0].id)).toThrowError(
      expect.objectContaining({ code: 'DUPLICATE_MANAGER_ID' }),
    )
  })

  it.each(['', '   '])('rejects the empty visible name %j', (displayName) => {
    const configured = managers(2)
    configured[0] = { ...configured[0], displayName }

    expect(() => validateManagerConfiguration(configured, 'manager-1')).toThrowError(
      expect.objectContaining({ code: 'EMPTY_DISPLAY_NAME' }),
    )
  })

  it('rejects duplicate visible names after project trimming and case normalization', () => {
    const configured = managers(2)
    configured[0] = { ...configured[0], displayName: ' Vuk ' }
    configured[1] = { ...configured[1], displayName: 'vUK' }

    expect(() => validateManagerConfiguration(configured, 'manager-1')).toThrowError(
      expect.objectContaining({ code: 'DUPLICATE_DISPLAY_NAME' }),
    )
  })

  it('rejects a user manager that is not configured', () => {
    expect(() => validateManagerConfiguration(managers(2), 'missing')).toThrowError(
      expect.objectContaining({ code: 'UNKNOWN_USER_MANAGER' }),
    )
  })

  it.each([2, 6, 16])('accepts a supported %i-manager league', (managerCount) => {
    const configured = managers(managerCount)
    expect(() => validateManagerConfiguration(configured, configured[0].id)).not.toThrow()
  })
})

describe('project-owned manager identity', () => {
  it('trims copied labels without mutating supplied managers or deriving their IDs', () => {
    const supplied: Manager[] = [
      { id: 'stable-vuk-id', displayName: '  Vuk  ' },
      { id: 'stable-diego-id', displayName: 'Diego' },
    ]
    const original = structuredClone(supplied)

    const configuration = createDraftConfiguration(supplied, 'stable-vuk-id')

    expect(configuration).toEqual({
      managers: [
        { id: 'stable-vuk-id', displayName: 'Vuk' },
        { id: 'stable-diego-id', displayName: 'Diego' },
      ],
      userManagerId: 'stable-vuk-id',
      rounds: 15,
    })
    expect(supplied).toEqual(original)
    expect(Object.isFrozen(configuration)).toBe(true)
    expect(Object.isFrozen(configuration.managers)).toBe(true)
  })

  it('returns one-based first-round draft positions', () => {
    const configured = managers(6)
    expect(configured.map(({ id }) => getManagerDraftPosition(configured, id))).toEqual([
      1, 2, 3, 4, 5, 6,
    ])
  })

  it('rejects a draft-position lookup for an unknown manager', () => {
    expect(() => getManagerDraftPosition(managers(2), 'missing')).toThrowError(
      expect.objectContaining({ name: 'UnknownManagerError', managerId: 'missing' }),
    )
  })
})
