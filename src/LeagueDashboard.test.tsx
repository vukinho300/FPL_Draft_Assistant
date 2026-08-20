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

  it('preserves shared view state when the presentation changes', () => {
    const { container, media } = renderDashboard(true)
    clickButton(container, 'Teams')
    expect(container.querySelector('.mobile-boundary-header h1')?.textContent).toBe('Teams')

    act(() => media.setMatches(false))
    expect(container.querySelector('.league-topbar h1')?.textContent).toBe('Teams')
    expect(container.querySelector('.manager-tabs')).not.toBeNull()
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
