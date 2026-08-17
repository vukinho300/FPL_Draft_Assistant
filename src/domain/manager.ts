import { FPL_DRAFT_SQUAD_SIZE, validateLeagueSize } from './league.ts'

/** Project-owned manager identity. Display names may change without changing this ID. */
export type ManagerId = string

export interface Manager {
  readonly id: ManagerId
  readonly displayName: string
}

export interface DraftConfiguration {
  readonly managers: readonly Manager[]
  readonly userManagerId: ManagerId
  readonly rounds: typeof FPL_DRAFT_SQUAD_SIZE
}

export type ManagerConfigurationErrorCode =
  | 'EMPTY_MANAGER_ID'
  | 'DUPLICATE_MANAGER_ID'
  | 'EMPTY_DISPLAY_NAME'
  | 'DUPLICATE_DISPLAY_NAME'
  | 'UNKNOWN_USER_MANAGER'

export class ManagerConfigurationError extends Error {
  public readonly code: ManagerConfigurationErrorCode

  constructor(code: ManagerConfigurationErrorCode, message: string) {
    super(message)
    this.name = 'ManagerConfigurationError'
    this.code = code
  }
}

export class UnknownManagerError extends Error {
  public readonly managerId: ManagerId

  constructor(managerId: ManagerId) {
    super(`Manager ${managerId} is not present in the draft configuration`)
    this.name = 'UnknownManagerError'
    this.managerId = managerId
  }
}

/** Project UX normalization for visible labels; this is not an official FPL rule. */
export function normalizeManagerDisplayName(displayName: string): string {
  return displayName.trim().toLowerCase()
}

export function validateManagerConfiguration(
  managers: readonly Manager[],
  userManagerId: ManagerId,
): void {
  validateLeagueSize(managers.length)

  const managerIds = new Set<ManagerId>()
  const visibleNames = new Set<string>()

  for (const manager of managers) {
    if (manager.id.trim() === '') {
      throw new ManagerConfigurationError(
        'EMPTY_MANAGER_ID',
        'Manager IDs must be non-empty',
      )
    }
    if (managerIds.has(manager.id)) {
      throw new ManagerConfigurationError(
        'DUPLICATE_MANAGER_ID',
        `Manager ID ${manager.id} is duplicated`,
      )
    }
    managerIds.add(manager.id)

    const normalizedDisplayName = normalizeManagerDisplayName(manager.displayName)
    if (normalizedDisplayName === '') {
      throw new ManagerConfigurationError(
        'EMPTY_DISPLAY_NAME',
        'Manager display names must be non-empty after trimming',
      )
    }
    if (visibleNames.has(normalizedDisplayName)) {
      throw new ManagerConfigurationError(
        'DUPLICATE_DISPLAY_NAME',
        `Manager display name ${manager.displayName.trim()} is duplicated`,
      )
    }
    visibleNames.add(normalizedDisplayName)
  }

  if (!managerIds.has(userManagerId)) {
    throw new ManagerConfigurationError(
      'UNKNOWN_USER_MANAGER',
      `User manager ${userManagerId} is not configured`,
    )
  }
}

export function createDraftConfiguration(
  managers: readonly Manager[],
  userManagerId: ManagerId,
): DraftConfiguration {
  validateManagerConfiguration(managers, userManagerId)

  const copiedManagers = managers.map((manager) =>
    Object.freeze({
      id: manager.id,
      displayName: manager.displayName.trim(),
    }),
  )

  return Object.freeze({
    managers: Object.freeze(copiedManagers),
    userManagerId,
    rounds: FPL_DRAFT_SQUAD_SIZE,
  })
}

export function getManagerDraftPosition(
  managers: readonly Manager[],
  managerId: ManagerId,
): number {
  const index = managers.findIndex((manager) => manager.id === managerId)
  if (index === -1) {
    throw new UnknownManagerError(managerId)
  }

  return index + 1
}
