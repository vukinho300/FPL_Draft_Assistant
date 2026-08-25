import { DesktopLeagueDashboard } from './dashboard/DesktopLeagueDashboard.tsx'
import { MobileLeagueDashboard } from './dashboard/MobileLeagueDashboard.tsx'
import {
  useLeagueDashboardModel,
  type PlayerLoader,
} from './dashboard/useLeagueDashboardModel.ts'
import {
  useLeagueTeamProfiles,
  type AuthenticatedDashboardAccount,
} from './dashboard/useLeagueTeamProfiles.ts'
import { usePresentationMode } from './dashboard/usePresentationMode.ts'
import type { TeamProfileService } from './services/supabase/teamProfiles.ts'
import type { LiveLeagueStateController } from './services/fpl/liveLeagueState.ts'

interface LeagueDashboardProps {
  readonly playerLoader?: PlayerLoader
  readonly currentManagerId?: string
  readonly account?: AuthenticatedDashboardAccount
  readonly profileService?: TeamProfileService
  readonly liveLeagueController?: LiveLeagueStateController
  readonly onLogout?: () => void
}

function LeagueDashboard({ playerLoader, currentManagerId, account, profileService, liveLeagueController, onLogout }: LeagueDashboardProps) {
  const model = useLeagueDashboardModel(playerLoader, currentManagerId, liveLeagueController)
  const profiles = useLeagueTeamProfiles(
    model.currentManagerRoster.managerId,
    model.selectedManagerId,
    account,
    profileService,
  )
  const presentation = usePresentationMode()

  return presentation === 'mobile'
    ? <MobileLeagueDashboard model={model} profiles={profiles} account={account} onLogout={onLogout} />
    : <DesktopLeagueDashboard model={model} profiles={profiles} />
}

export default LeagueDashboard
