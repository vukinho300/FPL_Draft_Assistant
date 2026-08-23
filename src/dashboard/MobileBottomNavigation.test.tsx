// @vitest-environment jsdom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { LEAGUE_NAVIGATION } from './navigation.ts'
import { MobileBottomNavigation } from './MobileBottomNavigation.tsx'
import { createFallbackLeagueTeamProfiles } from '../services/supabase/teamProfiles.ts'
import type { LeagueDashboardModel } from './useLeagueDashboardModel.ts'
import type { LeagueTeamProfilesModel } from './useLeagueTeamProfiles.ts'

const roots: { root: Root; container: HTMLDivElement }[] = []

function renderNavigation(isCommissioner: boolean) {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  const navigate = vi.fn()
  const onLogout = vi.fn()
  const model = {
    navigation: LEAGUE_NAVIGATION,
    view: 'league',
    navigate,
  } as unknown as LeagueDashboardModel
  const profileList = createFallbackLeagueTeamProfiles()
  const profiles = {
    profiles: profileList,
    current: profileList[isCommissioner ? 0 : 1],
    selected: profileList[0],
    loading: false,
    uploading: false,
    error: null,
    uploadCurrentAvatar: vi.fn(),
    profileForRoster: (managerId: string) => profileList.find((profile) => profile.rosterManagerId === managerId)!,
  } as LeagueTeamProfilesModel
  act(() => root.render(
    <MobileBottomNavigation
      model={model}
      profiles={profiles}
      account={{ id: isCommissioner ? 'jakin' : 'dindi', teamName: isCommissioner ? 'Jakin Goff' : 'Dindi', managerName: isCommissioner ? 'Vuk' : 'Kristian', role: isCommissioner ? 'LEAGUE_OWNER' : 'MEMBER' }}
      onLogout={onLogout}
    />,
  ))
  roots.push({ root, container })
  return { container, onLogout }
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

describe('MobileBottomNavigation account surface', () => {
  it('keeps the four primary destinations and puts Commissioner/logout inside More', () => {
    const { container, onLogout } = renderNavigation(true)
    const primaryButtons = [...container.querySelectorAll('.mobile-bottom-navigation > button')]
    expect(primaryButtons.map((button) => button.getAttribute('aria-label'))).toEqual(['League', 'My Team', 'Teams', 'More'])
    expect(container.querySelector('button[aria-label="My Team"] .team-avatar-fallback')?.textContent).toBe('J')

    act(() => primaryButtons.at(-1)!.dispatchEvent(new MouseEvent('click', { bubbles: true })))
    expect(container.querySelector('.mobile-account-surface')?.textContent).toContain('Jakin Goff')
    expect(container.querySelector('.mobile-account-surface')?.textContent).toContain('Commissioner')
    const logout = [...container.querySelectorAll('.mobile-account-surface button')].find((button) => button.textContent === 'Log out')
    act(() => logout!.dispatchEvent(new MouseEvent('click', { bubbles: true })))
    expect(onLogout).toHaveBeenCalledTimes(1)
  })

  it('does not display Commissioner for a member account', () => {
    const { container } = renderNavigation(false)
    const more = [...container.querySelectorAll('.mobile-bottom-navigation > button')].at(-1)
    act(() => more!.dispatchEvent(new MouseEvent('click', { bubbles: true })))

    expect(container.querySelector('.mobile-account-surface')?.textContent).toContain('Dindi')
    expect(container.querySelector('.mobile-account-surface')?.textContent).not.toContain('Commissioner')
  })
})
