import { useId, type ChangeEvent } from 'react'

import {
  getTeamAvatarInitial,
  TEAM_AVATAR_ACCEPTED_TYPES,
  type LeagueTeamProfile,
} from '../services/supabase/teamProfiles.ts'
import './TeamProfile.css'

export function TeamAvatar({
  profile,
  size = 'medium',
  decorative = false,
}: {
  readonly profile: Pick<LeagueTeamProfile, 'avatarUrl' | 'teamName'>
  readonly size?: 'small' | 'medium' | 'large'
  readonly decorative?: boolean
}) {
  const label = `${profile.teamName} avatar`
  return (
    <span className={`team-avatar team-avatar-${size}`} aria-hidden={decorative || undefined}>
      {profile.avatarUrl === null
        ? <span className="team-avatar-fallback" aria-label={decorative ? undefined : label}>{getTeamAvatarInitial(profile.teamName)}</span>
        : <img src={profile.avatarUrl} alt={decorative ? '' : label} />}
    </span>
  )
}

export function TeamProfileHeader({
  profile,
  editable = false,
  uploading = false,
  loading = false,
  error = null,
  onAvatarSelected,
}: {
  readonly profile: LeagueTeamProfile
  readonly editable?: boolean
  readonly uploading?: boolean
  readonly loading?: boolean
  readonly error?: string | null
  readonly onAvatarSelected?: (file: File) => void
}) {
  const inputId = useId()
  const onChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (file !== undefined) onAvatarSelected?.(file)
  }

  return (
    <section className="team-profile-header" aria-label={`${profile.teamName} team profile`}>
      <div className="team-profile-avatar-area">
        {editable
          ? (
              <label className="team-avatar-upload" htmlFor={inputId} aria-label={`Change ${profile.teamName} avatar`}>
                <TeamAvatar profile={profile} size="large" />
                <span>{uploading ? 'Uploading…' : profile.avatarPath === null ? 'Add photo' : 'Change photo'}</span>
              </label>
            )
          : <TeamAvatar profile={profile} size="large" />}
        {editable && (
          <input
            className="team-avatar-input"
            id={inputId}
            type="file"
            accept={TEAM_AVATAR_ACCEPTED_TYPES.join(',')}
            disabled={uploading || loading || profile.accountId === null}
            onChange={onChange}
          />
        )}
      </div>
      <div className="team-profile-identity">
        <p className="team-profile-kicker">Team profile</p>
        <div className="team-profile-title-row">
          <h2>{profile.teamName}</h2>
          {profile.role === 'LEAGUE_OWNER' && <span className="commissioner-badge">Commissioner</span>}
        </div>
        <p>Managed by <strong>{profile.managerName}</strong></p>
        {error !== null && <p className="team-profile-error" role="alert">{error}</p>}
      </div>
    </section>
  )
}
