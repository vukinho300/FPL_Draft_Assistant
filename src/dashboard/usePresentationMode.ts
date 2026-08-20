import { useEffect, useState } from 'react'

export const MOBILE_DASHBOARD_BREAKPOINT_REM = 44
export const MOBILE_DASHBOARD_MEDIA_QUERY = `(max-width: ${MOBILE_DASHBOARD_BREAKPOINT_REM}rem)`

export type DashboardPresentation = 'desktop' | 'mobile'

export function presentationForMatch(matchesMobileQuery: boolean): DashboardPresentation {
  return matchesMobileQuery ? 'mobile' : 'desktop'
}

function currentPresentation(): DashboardPresentation {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return 'desktop'
  return presentationForMatch(window.matchMedia(MOBILE_DASHBOARD_MEDIA_QUERY).matches)
}

export function usePresentationMode(): DashboardPresentation {
  const [presentation, setPresentation] = useState(currentPresentation)

  useEffect(() => {
    const mediaQuery = window.matchMedia(MOBILE_DASHBOARD_MEDIA_QUERY)
    const updatePresentation = (event: MediaQueryListEvent | MediaQueryList) => {
      setPresentation(presentationForMatch(event.matches))
    }

    updatePresentation(mediaQuery)
    mediaQuery.addEventListener('change', updatePresentation)
    return () => mediaQuery.removeEventListener('change', updatePresentation)
  }, [])

  return presentation
}
