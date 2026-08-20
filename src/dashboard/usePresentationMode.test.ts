import { describe, expect, it } from 'vitest'

import {
  MOBILE_DASHBOARD_MEDIA_QUERY,
  presentationForMatch,
} from './usePresentationMode.ts'

describe('dashboard presentation breakpoint', () => {
  it('uses one shared mobile media-query contract', () => {
    expect(MOBILE_DASHBOARD_MEDIA_QUERY).toBe('(max-width: 44rem)')
    expect(presentationForMatch(true)).toBe('mobile')
    expect(presentationForMatch(false)).toBe('desktop')
  })
})
