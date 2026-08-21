// @vitest-environment jsdom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import LeagueDashboard from './LeagueDashboard.tsx'
import { MOBILE_DASHBOARD_MEDIA_QUERY } from './dashboard/usePresentationMode.ts'

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

function renderDashboard(matchesMobile: boolean) {
  const media = new MatchMediaController(matchesMobile)
  vi.stubGlobal('matchMedia', vi.fn(media.matchMedia))
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  const playerLoader = vi.fn(async () => ({
    retrievedAt: '2026-08-20T00:00:00.000Z',
    playerCount: 0,
    players: [],
  }))

  act(() => root.render(<LeagueDashboard playerLoader={playerLoader} />))
  mountedRoots.push({ root, container })
  return { container, media, playerLoader }
}

function clickButton(container: HTMLElement, label: string) {
  const button = [...container.querySelectorAll('button')].find(
    (candidate) => candidate.textContent?.trim() === label,
  )
  if (button === undefined) throw new Error(`Could not find ${label} button`)
  act(() => button.dispatchEvent(new MouseEvent('click', { bubbles: true })))
}

function mobileTitle(container: HTMLElement) {
  return container.querySelector('.mobile-app-header h1')?.textContent
}

function openMore(container: HTMLElement) {
  clickButton(container, 'More')
  expect(container.querySelector('.mobile-more-menu')).not.toBeNull()
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

  it('keeps all seven shared destinations reachable through mobile navigation', async () => {
    const { container } = renderDashboard(true)
    clickButton(container, 'My Team')
    expect(mobileTitle(container)).toBe('My Team')
    clickButton(container, 'Players')
    await act(async () => Promise.resolve())
    expect(mobileTitle(container)).toBe('Players')

    openMore(container)
    expect([...container.querySelectorAll('.mobile-more-menu button')].map((button) => button.textContent?.trim())).toEqual([
      'Teams', 'Matchday', 'Transactions', 'Draft Archive',
    ])
    clickButton(container, 'Teams')
    expect(mobileTitle(container)).toBe('Teams')
    expect(container.querySelector('.mobile-more-menu')).toBeNull()

    openMore(container)
    clickButton(container, 'Matchday')
    expect(mobileTitle(container)).toBe('Matchday')
    openMore(container)
    clickButton(container, 'Transactions')
    expect(mobileTitle(container)).toBe('Transactions')
    openMore(container)
    clickButton(container, 'Draft Archive')
    expect(mobileTitle(container)).toBe('Draft Archive')
    clickButton(container, 'League')
    expect(mobileTitle(container)).toBe('League')
  })

  it('uses one mobile squad presentation for My Team and Teams while keeping manager state shared', () => {
    const { container, media } = renderDashboard(true)
    clickButton(container, 'My Team')
    expect(container.querySelector('[data-mobile-squad]')).not.toBeNull()
    expect(container.querySelector('.football-pitch')).toBeNull()
    expect(container.querySelectorAll('.mobile-position-section')).toHaveLength(4)

    openMore(container)
    clickButton(container, 'Teams')
    clickButton(container, 'Deni')
    expect(container.querySelector('.mobile-squad-heading h2')?.textContent).toBe("Deni's squad")
    expect(container.querySelector('[data-mobile-squad]')).not.toBeNull()

    act(() => media.setMatches(false))
    expect(container.querySelector('.league-topbar h1')?.textContent).toBe('Teams')
    expect(container.querySelector('.squad-heading h2')?.textContent).toBe("Deni's squad")
  })

  it('renders only truthful unavailable Matchday states', () => {
    const { container } = renderDashboard(true)
    openMore(container)
    clickButton(container, 'Matchday')

    expect(container.querySelectorAll('.mobile-matchday-card')).toHaveLength(6)
    expect(container.textContent).toContain('GW score —')
    expect(container.textContent).toContain('Lineup not connected')
    expect(container.textContent).toContain('No fabricated matchday values')
    expect(container.textContent).toContain('UNVERIFIED')
  })

  it('does not repeat player loading when switching presentations', async () => {
    const { container, media, playerLoader } = renderDashboard(true)
    expect(playerLoader).not.toHaveBeenCalled()
    clickButton(container, 'Players')
    await act(async () => Promise.resolve())
    expect(playerLoader).toHaveBeenCalledTimes(1)

    act(() => media.setMatches(false))
    act(() => media.setMatches(true))
    expect(playerLoader).toHaveBeenCalledTimes(1)
  })
})
