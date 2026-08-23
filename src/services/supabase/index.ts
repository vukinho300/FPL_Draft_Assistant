export {
  createSupabaseBrowserClient,
  getSupabaseBrowserClient,
  SUPABASE_BROWSER_AUTH_OPTIONS,
} from './client.ts'
export {
  getSupabaseAuthSessionService,
  SupabaseAuthSessionService,
  type AuthSessionClient,
  type AuthSessionListener,
  type AuthSessionState,
  type AuthSessionStatus,
} from './authSession.ts'
export {
  LEAGUE_TEAM_LOGIN_IDENTITIES,
  internalLoginEmail,
  resolveTeamLoginEmail,
} from './leagueIdentity.ts'
export {
  readSupabaseBrowserConfig,
  SUPABASE_BROWSER_ENVIRONMENT_KEYS,
  type SupabaseBrowserConfig,
  type SupabaseBrowserEnvironment,
} from './config.ts'
export {
  assembleLeagueTeamProfiles,
  createFallbackLeagueTeamProfiles,
  getSupabaseTeamProfileService,
  getTeamAvatarInitial,
  SupabaseTeamProfileService,
  TEAM_AVATAR_ACCEPTED_TYPES,
  TEAM_AVATAR_BUCKET,
  TEAM_AVATAR_MAX_BYTES,
  validateTeamAvatarFile,
  type LeagueTeamProfile,
  type TeamProfileService,
} from './teamProfiles.ts'
