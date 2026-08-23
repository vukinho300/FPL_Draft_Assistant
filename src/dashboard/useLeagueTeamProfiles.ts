import { useEffect, useMemo, useState } from 'react'

import {
  createFallbackLeagueTeamProfiles,
  getSupabaseTeamProfileService,
  type LeagueTeamProfile,
  type TeamProfileService,
} from '../services/supabase/teamProfiles.ts'

export interface AuthenticatedDashboardAccount {
  readonly id: string
  readonly teamName: string
  readonly managerName: string
  readonly role: 'MEMBER' | 'LEAGUE_OWNER'
}

export interface LeagueTeamProfilesModel {
  readonly profiles: readonly LeagueTeamProfile[]
  readonly current: LeagueTeamProfile
  readonly selected: LeagueTeamProfile
  readonly loading: boolean
  readonly uploading: boolean
  readonly error: string | null
  readonly uploadCurrentAvatar: (file: File) => Promise<void>
  readonly profileForRoster: (rosterManagerId: string) => LeagueTeamProfile
}

const FALLBACK_PROFILES = createFallbackLeagueTeamProfiles()

export function useLeagueTeamProfiles(
  currentManagerId: string,
  selectedManagerId: string,
  account?: AuthenticatedDashboardAccount,
  service?: TeamProfileService,
): LeagueTeamProfilesModel {
  const [profiles, setProfiles] = useState(FALLBACK_PROFILES)
  const [loading, setLoading] = useState(account !== undefined)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const accountId = account?.id

  useEffect(() => {
    setProfiles(FALLBACK_PROFILES)
    setError(null)
    setLoading(accountId !== undefined)
    setUploading(false)
    if (accountId === undefined) return

    let active = true
    const profileService = service ?? getSupabaseTeamProfileService()
    void profileService.loadProfiles().then((loaded) => {
      if (!active) return
      setProfiles(loaded)
      setLoading(false)
    }).catch(() => {
      if (!active) return
      setError('Team profile images are temporarily unavailable.')
      setLoading(false)
    })
    return () => { active = false }
  }, [accountId, service])

  const profileForRoster = useMemo(() => (rosterManagerId: string) => (
    profiles.find((profile) => profile.rosterManagerId === rosterManagerId)
    ?? FALLBACK_PROFILES.find((profile) => profile.rosterManagerId === rosterManagerId)
    ?? (() => { throw new Error('Roster does not map to an approved team profile') })()
  ), [profiles])

  const current = profileForRoster(currentManagerId)
  const selected = profileForRoster(selectedManagerId)

  const uploadCurrentAvatar = async (file: File) => {
    if (account === undefined || current.accountId !== account.id) {
      setError('Your persistent team profile is not ready yet.')
      return
    }
    setUploading(true)
    setError(null)
    try {
      const profileService = service ?? getSupabaseTeamProfileService()
      const updated = await profileService.uploadAvatar(account.id, file, current.avatarPath)
      setProfiles(updated)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to update the team avatar.')
    } finally {
      setUploading(false)
    }
  }

  return {
    profiles,
    current,
    selected,
    loading,
    uploading,
    error,
    uploadCurrentAvatar,
    profileForRoster,
  }
}
