// @vitest-environment jsdom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { KILE_N_OTHERS_ACCOUNT_ROSTER_IDENTITIES } from '../data/leagues/kile-n-others/accountRosterIdentity.ts'
import {
  assembleLeagueTeamProfiles,
  type LeagueTeamProfile,
  type TeamProfileService,
} from '../services/supabase/teamProfiles.ts'
import {
  useLeagueTeamProfiles,
  type AuthenticatedDashboardAccount,
} from './useLeagueTeamProfiles.ts'

const roots: { readonly root: Root; readonly container: HTMLDivElement }[] = []

function deferred<T>() {
  let resolve: (value: T) => void = () => undefined
  const promise = new Promise<T>((complete) => { resolve = complete })
  return { promise, resolve }
}

function profilesWithAvatar(teamName: string): readonly LeagueTeamProfile[] {
  const accounts = KILE_N_OTHERS_ACCOUNT_ROSTER_IDENTITIES.map((identity, index) => ({
    id: `account-${index + 1}`,
    team_name: identity.teamName,
    manager_name: identity.accountManagerName,
    role: identity.teamName === 'Jakin Goff' ? 'LEAGUE_OWNER' as const : 'MEMBER' as const,
  }))
  const target = accounts.find(({ team_name }) => team_name === teamName)!
  const path = `${target.id}/avatar`
  return assembleLeagueTeamProfiles(
    accounts,
    accounts.map(({ id }) => ({ account_id: id, avatar_path: id === target.id ? path : null })),
    new Map([[path, `https://signed.example/${target.id}`]]),
  )
}

function Probe({
  account,
  managerId,
  service,
}: {
  readonly account: AuthenticatedDashboardAccount
  readonly managerId: string
  readonly service: TeamProfileService
}) {
  const profiles = useLeagueTeamProfiles(managerId, managerId, account, service)
  return <div data-team={profiles.current.teamName} data-avatar={profiles.current.avatarUrl ?? ''}>{profiles.loading ? 'loading' : profiles.current.managerName}</div>
}

beforeEach(() => {
  ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
})

afterEach(() => {
  roots.splice(0).forEach(({ root, container }) => {
    act(() => root.unmount())
    container.remove()
  })
})

describe('useLeagueTeamProfiles account switching', () => {
  it('never presents the previous authenticated team while the next profile load resolves', async () => {
    const jakinLoad = deferred<readonly LeagueTeamProfile[]>()
    const dindiLoad = deferred<readonly LeagueTeamProfile[]>()
    const service = {
      loadProfiles: vi.fn()
        .mockReturnValueOnce(jakinLoad.promise)
        .mockReturnValueOnce(dindiLoad.promise),
      uploadAvatar: vi.fn(),
    } as unknown as TeamProfileService
    const jakin: AuthenticatedDashboardAccount = { id: 'account-1', teamName: 'Jakin Goff', managerName: 'Vuk', role: 'LEAGUE_OWNER' }
    const dindi: AuthenticatedDashboardAccount = { id: 'account-2', teamName: 'Dindi', managerName: 'Kristian', role: 'MEMBER' }
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)
    roots.push({ root, container })

    await act(async () => root.render(<Probe account={jakin} managerId="demo-manager-1" service={service} />))
    await act(async () => root.render(<Probe account={dindi} managerId="demo-manager-3" service={service} />))
    expect(container.firstElementChild?.getAttribute('data-team')).toBe('Dindi')
    expect(container.firstElementChild?.getAttribute('data-avatar')).toBe('')

    await act(async () => jakinLoad.resolve(profilesWithAvatar('Jakin Goff')))
    expect(container.firstElementChild?.getAttribute('data-team')).toBe('Dindi')
    expect(container.firstElementChild?.getAttribute('data-avatar')).toBe('')

    await act(async () => dindiLoad.resolve(profilesWithAvatar('Dindi')))
    expect(container.firstElementChild?.getAttribute('data-team')).toBe('Dindi')
    expect(container.firstElementChild?.getAttribute('data-avatar')).toBe('https://signed.example/account-2')
    expect(container.textContent).toBe('Kristian')
  })
})
