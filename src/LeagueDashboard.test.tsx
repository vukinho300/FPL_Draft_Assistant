// @vitest-environment jsdom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import LeagueDashboard from './LeagueDashboard.tsx'
import { KILE_N_OTHERS_ACCOUNT_ROSTER_IDENTITIES } from './data/leagues/kile-n-others/accountRosterIdentity.ts'
import { officialDraft202627 } from './data/leagues/kile-n-others/officialDraft2026-27.ts'
import type { Player } from './domain/player.ts'
import { MOBILE_DASHBOARD_MEDIA_QUERY } from './dashboard/usePresentationMode.ts'
import {
  assembleLeagueTeamProfiles,
  type TeamProfileService,
} from './services/supabase/teamProfiles.ts'
import type { AuthenticatedDashboardAccount } from './dashboard/useLeagueTeamProfiles.ts'
import { LiveLeagueStateController } from './services/fpl/liveLeagueState.ts'
import { createG4TestData } from './testing/g4TestData.ts'

class MatchMediaController {
  private matches: boolean
  private readonly listeners = new Set<(event: MediaQueryListEvent) => void>()

  constructor(matches: boolean) {
    this.matches = matches
  }

  readonly matchMedia = (query: string): MediaQueryList => ({
    matches: this.matches,
    media: query,
    onchange: null,
    addEventListener: (_type: string, listener: EventListenerOrEventListenerObject) => {
      this.listeners.add(listener as (event: MediaQueryListEvent) => void)
    },
    removeEventListener: (_type: string, listener: EventListenerOrEventListenerObject) => {
      this.listeners.delete(listener as (event: MediaQueryListEvent) => void)
    },
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => true,
  })

  setMatches(matches: boolean) {
    this.matches = matches
    const event = { matches, media: MOBILE_DASHBOARD_MEDIA_QUERY } as MediaQueryListEvent
    this.listeners.forEach((listener) => listener(event))
  }
}

const mountedRoots: { root: Root; container: HTMLDivElement }[] = []

function renderDashboard(
  matchesMobile: boolean,
  players?: readonly Player[],
  currentManagerId?: string,
  account?: AuthenticatedDashboardAccount,
  profileService?: TeamProfileService,
  gameweekPhase: Parameters<typeof createG4TestData>[0] = 'OFFICIAL_EVENT_MARKED_FINISHED',
) {
  const g4 = createG4TestData(gameweekPhase)
  const loadedPlayers = players ?? g4.players
  const media = new MatchMediaController(matchesMobile)
  vi.stubGlobal('matchMedia', vi.fn(media.matchMedia))
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  const playerLoader = vi.fn(async () => ({
    retrievedAt: '2026-08-20T00:00:00.000Z',
    playerCount: loadedPlayers.length,
    players: [...loadedPlayers],
  }))
  const liveLeagueController = new LiveLeagueStateController({
    load: vi.fn().mockResolvedValue(g4.live),
    now: () => new Date('2026-08-25T10:00:30Z'),
  })

  act(() => root.render(<LeagueDashboard playerLoader={playerLoader} currentManagerId={currentManagerId} account={account} profileService={profileService} liveLeagueController={liveLeagueController} />))
  mountedRoots.push({ root, container })
  return { container, media, playerLoader }
}

function clickButton(container: HTMLElement, label: string) {
  const button = [...container.querySelectorAll('button')].find(
    (candidate) => candidate.textContent?.trim() === label
      || candidate.getAttribute('aria-label') === label
      || candidate.lastElementChild?.textContent?.trim() === label,
  )
  if (button === undefined) throw new Error(`Could not find ${label} button`)
  act(() => button.dispatchEvent(new MouseEvent('click', { bubbles: true })))
}

function changeSelect(container: HTMLElement, label: string, value: string) {
  const select = container.querySelector<HTMLSelectElement>(`select[aria-label="${label}"]`)
  if (select === null) throw new Error(`Could not find ${label} select`)
  select.value = value
  act(() => select.dispatchEvent(new Event('change', { bubbles: true })))
}

function mobileTitle(container: HTMLElement) {
  return container.querySelector('.mobile-app-header h1')?.textContent
}

async function settle() {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
  })
}

function openMore(container: HTMLElement) {
  clickButton(container, 'More')
  expect(container.querySelector('.mobile-more-menu')).not.toBeNull()
}

function navigateFromMore(container: HTMLElement, label: string) {
  openMore(container)
  clickButton(container, label)
  expect(container.querySelector('.mobile-more-menu')).toBeNull()
}

beforeEach(() => {
  const reactTestEnvironment = globalThis as typeof globalThis & {
    IS_REACT_ACT_ENVIRONMENT: boolean
  }
  reactTestEnvironment.IS_REACT_ACT_ENVIRONMENT = true
})

afterEach(() => {
  mountedRoots.forEach(({ root, container }) => {
    act(() => root.unmount())
    container.remove()
  })
  mountedRoots.length = 0
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('LeagueDashboard presentation boundary', () => {
  it('mounts only the presentation selected by the shared breakpoint', () => {
    const { container, media } = renderDashboard(false)
    expect(container.querySelector('[data-presentation="desktop"]')).not.toBeNull()
    expect(container.querySelector('[data-presentation="mobile"]')).toBeNull()

    act(() => media.setMatches(true))
    expect(container.querySelector('[data-presentation="desktop"]')).toBeNull()
    expect(container.querySelector('[data-presentation="mobile"]')).not.toBeNull()
  })

  it('uses League, My Team, Teams and More as the primary mobile navigation', () => {
    const { container } = renderDashboard(true)
    const primaryLabels = [...container.querySelectorAll('.mobile-bottom-navigation > button')].map(
      (button) => button.getAttribute('aria-label'),
    )
    expect(primaryLabels).toEqual(['League', 'My Team', 'Teams', 'More'])

    openMore(container)
    expect([...container.querySelectorAll('.mobile-more-menu button')].map((button) => button.textContent?.trim())).toEqual([
      'Players', 'Matchday', 'Transactions', 'Draft Archive',
    ])
  })

  it('keeps all More destinations reachable and closes More after navigation', async () => {
    const { container } = renderDashboard(true)
    navigateFromMore(container, 'Players')
    await act(async () => Promise.resolve())
    expect(mobileTitle(container)).toBe('Players')
    navigateFromMore(container, 'Matchday')
    expect(mobileTitle(container)).toBe('Matchday')
    navigateFromMore(container, 'Transactions')
    expect(mobileTitle(container)).toBe('Transactions')
    navigateFromMore(container, 'Draft Archive')
    expect(mobileTitle(container)).toBe('Draft Archive')
  })

  it('uses the approved Gameweek-first League hierarchy without draft clutter', () => {
    const { container } = renderDashboard(true)
    expect(mobileTitle(container)).toBe('Kile N Others')
    expect(container.textContent).toContain('Current Gameweek')
    expect(container.textContent).toContain('My Gameweek Points')
    expect(container.textContent).toContain('League standings')
    expect(container.textContent).toContain('Important Gameweek events')
    expect(container.textContent).toContain('Recent transactions')
    expect(container.textContent).not.toContain('Open Draft Archive')
    expect(container.textContent).not.toContain('Roster completeness')
    expect(container.textContent).not.toContain('Latest recorded events')
    expect(container.textContent).toContain('not connected')
  })

  it('uses the private decision workspace for My Team and league-visible official ownership for Teams before lock', async () => {
    const storageWrite = vi.spyOn(Storage.prototype, 'setItem')
    const { container, media } = renderDashboard(true)
    clickButton(container, 'My Team')
    await settle()
    expect(container.querySelector('[data-gameweek-mode="planner"]')).not.toBeNull()
    expect(container.textContent).toContain('Private decision workspace')
    expect(container.textContent).toContain('Nothing is submitted to FPL')
    expect(container.querySelectorAll('.gameweek-pitch .gameweek-player-tile')).toHaveLength(11)
    expect(container.querySelectorAll('.gameweek-bench .gameweek-player-tile')).toHaveLength(4)
    expect(storageWrite).not.toHaveBeenCalled()

    clickButton(container, 'Teams')
    await settle()
    expect(container.querySelector('[data-gameweek-mode="roster"]')).not.toBeNull()
    expect(container.textContent).toContain('League-visible current roster')
    expect(container.textContent).not.toContain('Private decision workspace')
    clickButton(container, 'Rod Wave Disciples')
    expect(container.querySelector('.team-profile-header')?.textContent).toContain('Rod Wave Disciples')
    expect(container.querySelectorAll('.gameweek-current-roster .gameweek-list-row')).toHaveLength(15)

    act(() => media.setMatches(false))
    expect(container.querySelector('.league-topbar h1')?.textContent).toBe('Teams')
    expect(container.querySelector('[data-gameweek-mode="roster"]')).not.toBeNull()
  })

  it('uses the selected authenticated manager ID for every approved account roster', () => {
    KILE_N_OTHERS_ACCOUNT_ROSTER_IDENTITIES.forEach((identity) => {
      const { container } = renderDashboard(true, undefined, identity.rosterManagerId)
      clickButton(container, 'My Team')
      const expectedManager = officialDraft202627.managers.find(
        (manager) => manager.id === identity.rosterManagerId,
      )
      expect(container.querySelector('.team-profile-header')?.textContent).toContain(identity.teamName)
      expect(expectedManager?.id).toBe(identity.rosterManagerId)
    })
  })

  it('uses one persistent profile source for My Team, Teams and both navigation presentations', async () => {
    const accounts = KILE_N_OTHERS_ACCOUNT_ROSTER_IDENTITIES.map((identity, index) => ({
      id: `account-${index + 1}`,
      team_name: identity.teamName,
      manager_name: identity.accountManagerName,
      role: identity.teamName === 'Jakin Goff' ? 'LEAGUE_OWNER' as const : 'MEMBER' as const,
    }))
    const profiles = assembleLeagueTeamProfiles(
      accounts,
      accounts.map(({ id }, index) => ({
        account_id: id,
        avatar_path: index === 0 ? `${id}/avatar` : null,
      })),
      new Map([['account-1/avatar', 'https://signed.example/jakin-avatar']]),
    )
    const profileService = {
      loadProfiles: vi.fn().mockResolvedValue(profiles),
      uploadAvatar: vi.fn().mockResolvedValue(profiles),
    } satisfies TeamProfileService
    const account: AuthenticatedDashboardAccount = {
      id: 'account-1',
      teamName: 'Jakin Goff',
      managerName: 'Vuk',
      role: 'LEAGUE_OWNER',
    }
    const { container, media } = renderDashboard(
      true,
      undefined,
      'demo-manager-1',
      account,
      profileService,
    )
    await act(async () => Promise.resolve())

    clickButton(container, 'My Team')
    expect(container.querySelector('.team-profile-header')?.textContent).toContain('Jakin Goff')
    expect(container.querySelector('.team-profile-header')?.textContent).toContain('Managed by Vuk')
    expect(container.querySelector('.team-profile-header')?.textContent).toContain('Commissioner')
    expect(container.querySelector('.team-profile-header')?.textContent).not.toContain('shared across devices')
    expect(container.querySelector('.mobile-bottom-navigation button[aria-label="My Team"] img')?.getAttribute('src')).toBe('https://signed.example/jakin-avatar')

    const input = container.querySelector<HTMLInputElement>('.team-avatar-input')
    const file = new File(['avatar'], 'team.png', { type: 'image/png' })
    Object.defineProperty(input, 'files', { configurable: true, value: [file] })
    await act(async () => input!.dispatchEvent(new Event('change', { bubbles: true })))
    expect(profileService.uploadAvatar).toHaveBeenCalledWith('account-1', file, 'account-1/avatar')

    clickButton(container, 'Teams')
    clickButton(container, 'Miku007')
    expect(container.querySelector('.team-profile-header')?.textContent).toContain('Miku007')
    expect(container.querySelector('.team-profile-header')?.textContent).toContain('Managed by Lovro')
    expect(container.querySelector('.team-profile-header .team-avatar-fallback')?.textContent).toBe('M')

    act(() => media.setMatches(false))
    expect(container.querySelector('.league-sidebar button[aria-label="My Team"] img')?.getAttribute('src')).toBe('https://signed.example/jakin-avatar')
    expect(container.querySelector('.team-profile-header')?.textContent).toContain('Miku007')
    expect(profileService.loadProfiles).toHaveBeenCalledTimes(1)
  })

  it('shows the official effective XI, ordered bench, shared G3 score, and one Pitch/List model after lock', async () => {
    const { container } = renderDashboard(
      true,
      undefined,
      'demo-manager-1',
      undefined,
      undefined,
      'ACTIVE',
    )
    clickButton(container, 'My Team')
    await settle()

    expect(container.querySelector('[data-gameweek-mode="official"]')).not.toBeNull()
    expect(container.textContent).toContain('LIVE GW points')
    expect(container.querySelector('.gameweek-score-block strong')?.textContent).toBe('40')
    expect(container.querySelectorAll('.gameweek-pitch .gameweek-player-tile')).toHaveLength(11)
    expect(container.querySelectorAll('.gameweek-bench .gameweek-player-tile')).toHaveLength(4)
    expect([...container.querySelectorAll('.gameweek-bench-slot > span')].map(({ textContent }) => textContent)).toEqual(['GK', '1', '2', '3'])

    clickButton(container, 'List')
    expect(container.querySelector('[data-gameweek-presentation="pitch"]')).toBeNull()
    expect(container.querySelectorAll('[data-gameweek-presentation="list"] .gameweek-list-row')).toHaveLength(15)
    expect(container.textContent).toContain('Jakin Goff Player 1')

    clickButton(container, 'Teams')
    clickButton(container, 'Miku007')
    expect(container.querySelector('.gameweek-score-block strong')?.textContent).toBe('43')
    expect(container.textContent).not.toContain('Private decision workspace')
  })

  it('renders only truthful unavailable Matchday states', () => {
    const { container } = renderDashboard(true)
    navigateFromMore(container, 'Matchday')

    expect(container.querySelectorAll('.mobile-matchday-card')).toHaveLength(6)
    expect(container.textContent).toContain('GW score —')
    expect(container.textContent).toContain('Lineup not connected')
    expect(container.textContent).toContain('No fabricated matchday values')
    expect(container.textContent).toContain('UNVERIFIED')
  })

  it('uses shared filtered player results with full names in mobile and desktop presentations', async () => {
    const draftedPlayer = officialDraft202627.picks[0]
    const players: readonly Player[] = [
      {
        id: draftedPlayer.draftPlayerId,
        displayName: 'Test',
        fullName: 'Owned Full Name',
        position: draftedPlayer.position,
        club: draftedPlayer.club,
        officialDraftRank: 12,
        form: 4.1,
        totalPoints: 42,
      },
      {
        id: 'mobile-free-agent',
        displayName: 'Free',
        fullName: 'Free Full Name',
        position: draftedPlayer.position,
        club: draftedPlayer.club,
        officialDraftRank: 1,
        form: 7.8,
        totalPoints: 58,
      },
    ]
    const { container, media } = renderDashboard(true, players)
    navigateFromMore(container, 'Players')
    await act(async () => Promise.resolve())

    expect(container.textContent).toContain('Owned Full Name')
    expect(container.textContent).toContain('Free Full Name')
    expect(container.querySelector('.mobile-player-directory table')).toBeNull()
    expect(container.querySelectorAll('.mobile-ownership-filters button')).toHaveLength(3)
    expect(container.querySelector('select[aria-label="Sort players"]')).not.toBeNull()
    expect(container.textContent).toContain('Official FPL Draft rank')
    expect(container.textContent).toContain('Form')
    expect(container.textContent).toContain('Total Points')
    expect(container.textContent).toContain('MVP consensus')
    expect(container.textContent).not.toContain('Draft model rank')
    expect(container.textContent).toContain('Form leaders')
    expect(container.textContent).toContain('Total Points leaders')

    changeSelect(container, 'Sort players', 'FORM')
    const mobileOrder = [...container.querySelectorAll('.mobile-directory-player h3')].map(
      ({ textContent }) => textContent,
    )
    expect(mobileOrder).toEqual(['Free Full Name', 'Owned Full Name'])

    act(() => media.setMatches(false))
    const desktopOrder = [...container.querySelectorAll('.player-directory tbody tr td:first-child strong')].map(
      ({ textContent }) => textContent,
    )
    expect(desktopOrder).toEqual(mobileOrder)

    act(() => media.setMatches(true))

    clickButton(container, 'OWNED')
    expect(container.textContent).toContain('Owned Full Name')
    expect(container.textContent).not.toContain('Free Full Name')

    act(() => media.setMatches(false))
    expect(container.querySelector('.player-directory')?.textContent).toContain('Owned Full Name')
    expect(container.querySelector('.player-directory')?.textContent).not.toContain('Free Full Name')
  })

  it('keeps mobile transaction categories usable without changing transaction meaning', () => {
    const { container } = renderDashboard(true)
    navigateFromMore(container, 'Transactions')
    expect(container.querySelectorAll('.mobile-transaction-tabs button')).toHaveLength(4)
    clickButton(container, 'ACTIVITY')
    expect(container.textContent).toContain('No recorded league transactions')
    expect(container.textContent).toContain('PROCESSED')
  })

  it('renders immutable draft history as mobile cards instead of a desktop table', () => {
    const { container } = renderDashboard(true)
    navigateFromMore(container, 'Draft Archive')
    expect(container.textContent).toContain('Immutable historical record')
    expect(container.querySelectorAll('.mobile-archive-picks details')).toHaveLength(15)
    expect(container.querySelector('.mobile-archive-picks table')).toBeNull()
    expect(container.textContent).toContain('Official at draft')
    expect(container.textContent).toContain('Model at draft')
    expect(container.textContent).toContain('MVP at draft')
  })

  it('does not repeat player loading when switching presentations', async () => {
    const { container, media, playerLoader } = renderDashboard(true)
    expect(playerLoader).not.toHaveBeenCalled()
    navigateFromMore(container, 'Players')
    await act(async () => Promise.resolve())
    expect(playerLoader).toHaveBeenCalledTimes(1)

    act(() => media.setMatches(false))
    act(() => media.setMatches(true))
    expect(playerLoader).toHaveBeenCalledTimes(1)
  })
})
