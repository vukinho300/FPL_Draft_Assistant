import { DesktopLeagueDashboard } from './dashboard/DesktopLeagueDashboard.tsx'
import { MobileLeagueDashboard } from './dashboard/MobileLeagueDashboard.tsx'
import {
  useLeagueDashboardModel,
  type PlayerLoader,
} from './dashboard/useLeagueDashboardModel.ts'
import { usePresentationMode } from './dashboard/usePresentationMode.ts'

interface LeagueDashboardProps {
  readonly playerLoader?: PlayerLoader
  readonly currentManagerName?: string
  readonly account?: { readonly teamName: string; readonly isCommissioner: boolean }
  readonly onLogout?: () => void
}

function LeagueDashboard({ playerLoader, currentManagerName, account, onLogout }: LeagueDashboardProps) {
  const model = useLeagueDashboardModel(playerLoader, currentManagerName)
  const presentation = usePresentationMode()

  return presentation === 'mobile'
    ? <MobileLeagueDashboard model={model} account={account} onLogout={onLogout} />
    : <DesktopLeagueDashboard model={model} />
}

export default LeagueDashboard
