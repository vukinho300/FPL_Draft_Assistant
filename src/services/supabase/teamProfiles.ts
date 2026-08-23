import type { SupabaseClient } from '@supabase/supabase-js'

import {
  KILE_N_OTHERS_ACCOUNT_ROSTER_IDENTITIES,
  resolveLeagueAccountRosterManagerId,
} from '../../data/leagues/kile-n-others/accountRosterIdentity.ts'
import type { ManagerId } from '../../domain/manager.ts'
import type { Database, Tables } from './database.types.ts'
import { getSupabaseBrowserClient } from './client.ts'

export const TEAM_AVATAR_BUCKET = 'team-avatars'
export const TEAM_AVATAR_MAX_BYTES = 2 * 1024 * 1024
export const TEAM_AVATAR_ACCEPTED_TYPES = Object.freeze([
  'image/jpeg',
  'image/png',
  'image/webp',
] as const)

type LeagueAccountRole = Database['public']['Enums']['league_account_role']
type LeagueAccountRow = Pick<
  Tables<'league_accounts'>,
  'id' | 'team_name' | 'manager_name' | 'role'
>
type TeamProfileRow = Pick<Tables<'team_profiles'>, 'account_id' | 'avatar_path'>

export interface LeagueTeamProfile {
  readonly accountId: string | null
  readonly teamName: string
  readonly managerName: string
  readonly role: LeagueAccountRole | null
  readonly rosterManagerId: ManagerId
  readonly avatarPath: string | null
  readonly avatarUrl: string | null
}

export interface TeamProfileService {
  loadProfiles(): Promise<readonly LeagueTeamProfile[]>
  uploadAvatar(
    accountId: string,
    file: File,
    previousAvatarPath: string | null,
  ): Promise<readonly LeagueTeamProfile[]>
}

export function getTeamAvatarInitial(teamName: string): string {
  return teamName.trim().charAt(0).toLocaleUpperCase('en-US') || '?'
}

export function validateTeamAvatarFile(file: Pick<File, 'size' | 'type'>): string | null {
  if (!TEAM_AVATAR_ACCEPTED_TYPES.includes(file.type as typeof TEAM_AVATAR_ACCEPTED_TYPES[number])) {
    return 'Choose a JPEG, PNG or WebP image.'
  }
  if (file.size <= 0) return 'The selected image is empty.'
  if (file.size > TEAM_AVATAR_MAX_BYTES) return 'Choose an image smaller than 2 MB.'
  return null
}

export function createFallbackLeagueTeamProfiles(): readonly LeagueTeamProfile[] {
  return KILE_N_OTHERS_ACCOUNT_ROSTER_IDENTITIES.map((identity) => Object.freeze({
    accountId: null,
    teamName: identity.teamName,
    managerName: identity.accountManagerName,
    role: null,
    rosterManagerId: identity.rosterManagerId,
    avatarPath: null,
    avatarUrl: null,
  }))
}

export function assembleLeagueTeamProfiles(
  accounts: readonly LeagueAccountRow[],
  profileRows: readonly TeamProfileRow[],
  signedAvatarUrls: ReadonlyMap<string, string>,
): readonly LeagueTeamProfile[] {
  if (accounts.length !== KILE_N_OTHERS_ACCOUNT_ROSTER_IDENTITIES.length) {
    throw new Error('Expected all six league accounts when loading team profiles')
  }

  const rowsByAccountId = new Map(profileRows.map((profile) => [profile.account_id, profile]))
  const profiles = accounts.map((account) => {
    const rosterManagerId = resolveLeagueAccountRosterManagerId(
      account.team_name,
      account.manager_name,
    )
    if (rosterManagerId === null) {
      throw new Error(`League profile identity is inconsistent for ${account.team_name}`)
    }

    const profile = rowsByAccountId.get(account.id)
    if (profile === undefined) {
      throw new Error(`League profile is missing for ${account.team_name}`)
    }

    return Object.freeze({
      accountId: account.id,
      teamName: account.team_name,
      managerName: account.manager_name,
      role: account.role,
      rosterManagerId,
      avatarPath: profile.avatar_path,
      avatarUrl: profile.avatar_path === null
        ? null
        : signedAvatarUrls.get(profile.avatar_path) ?? null,
    })
  })

  const rosterIds = new Set(profiles.map(({ rosterManagerId }) => rosterManagerId))
  if (rosterIds.size !== profiles.length) {
    throw new Error('League profiles do not map uniquely to the six rosters')
  }
  return profiles
}

export class SupabaseTeamProfileService implements TeamProfileService {
  private readonly client: SupabaseClient<Database>
  private readonly createObjectId: () => string

  public constructor(
    client: SupabaseClient<Database>,
    createObjectId: () => string = () => crypto.randomUUID(),
  ) {
    this.client = client
    this.createObjectId = createObjectId
  }

  public async loadProfiles(): Promise<readonly LeagueTeamProfile[]> {
    const [accountsResult, profilesResult] = await Promise.all([
      this.client
        .from('league_accounts')
        .select('id, team_name, manager_name, role')
        .order('team_name'),
      this.client
        .from('team_profiles')
        .select('account_id, avatar_path'),
    ])

    if (accountsResult.error !== null || accountsResult.data === null) {
      throw new Error('Unable to load league profile identities')
    }
    if (profilesResult.error !== null || profilesResult.data === null) {
      throw new Error('Unable to load team profiles')
    }

    const avatarPaths = profilesResult.data.flatMap(({ avatar_path }) => (
      avatar_path === null ? [] : [avatar_path]
    ))
    const signedAvatarUrls = new Map<string, string>()
    if (avatarPaths.length > 0) {
      const { data, error } = await this.client.storage
        .from(TEAM_AVATAR_BUCKET)
        .createSignedUrls(avatarPaths, 60 * 60)
      if (error !== null || data === null) {
        throw new Error('Unable to load team avatar images')
      }
      data.forEach((result) => {
        if (result.error === null && result.path !== null && result.signedUrl !== null) {
          signedAvatarUrls.set(result.path, result.signedUrl)
        }
      })
    }

    return assembleLeagueTeamProfiles(
      accountsResult.data,
      profilesResult.data,
      signedAvatarUrls,
    )
  }

  public async uploadAvatar(
    accountId: string,
    file: File,
    previousAvatarPath: string | null,
  ): Promise<readonly LeagueTeamProfile[]> {
    const validationError = validateTeamAvatarFile(file)
    if (validationError !== null) throw new Error(validationError)

    const avatarPath = `${accountId}/${this.createObjectId()}`
    const bucket = this.client.storage.from(TEAM_AVATAR_BUCKET)
    const uploadResult = await bucket.upload(avatarPath, file, {
      cacheControl: '3600',
      contentType: file.type,
      upsert: false,
    })
    if (uploadResult.error !== null) {
      throw new Error('Unable to upload the team avatar')
    }

    const profileResult = await this.client
      .from('team_profiles')
      .update({ avatar_path: avatarPath })
      .eq('account_id', accountId)
      .select('account_id')
      .single()
    if (profileResult.error !== null) {
      await bucket.remove([avatarPath])
      throw new Error('Unable to save the team avatar')
    }

    if (previousAvatarPath !== null && previousAvatarPath !== avatarPath) {
      await bucket.remove([previousAvatarPath])
    }
    return this.loadProfiles()
  }
}

let profileService: TeamProfileService | undefined

export function getSupabaseTeamProfileService(): TeamProfileService {
  profileService ??= new SupabaseTeamProfileService(getSupabaseBrowserClient())
  return profileService
}
