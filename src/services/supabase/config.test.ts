import { describe, expect, it } from 'vitest'

import {
  readSupabaseBrowserConfig,
  SUPABASE_BROWSER_ENVIRONMENT_KEYS,
} from './config.ts'

describe('Supabase browser configuration', () => {
  it('accepts only the public project URL and publishable key contract', () => {
    expect(SUPABASE_BROWSER_ENVIRONMENT_KEYS).toEqual([
      'VITE_SUPABASE_URL',
      'VITE_SUPABASE_PUBLISHABLE_KEY',
    ])
    expect(readSupabaseBrowserConfig({
      VITE_SUPABASE_URL: 'https://project-ref.supabase.co',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_fixture-key',
    })).toEqual({
      url: 'https://project-ref.supabase.co',
      publishableKey: 'sb_publishable_fixture-key',
    })
  })

  it('accepts the local CLI URL without weakening hosted-project HTTPS', () => {
    expect(readSupabaseBrowserConfig({
      VITE_SUPABASE_URL: 'http://127.0.0.1:54321',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_local-fixture',
    }).url).toBe('http://127.0.0.1:54321')

    expect(() => readSupabaseBrowserConfig({
      VITE_SUPABASE_URL: 'http://project-ref.supabase.co',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_fixture-key',
    })).toThrow('must use HTTPS')
  })

  it('fails clearly when required browser configuration is missing', () => {
    expect(() => readSupabaseBrowserConfig({})).toThrow(
      'Missing required browser configuration: VITE_SUPABASE_URL',
    )
    expect(() => readSupabaseBrowserConfig({
      VITE_SUPABASE_URL: 'https://project-ref.supabase.co',
    })).toThrow('Missing required browser configuration: VITE_SUPABASE_PUBLISHABLE_KEY')
  })

  it('rejects secret and legacy service-role credentials at the browser boundary', () => {
    for (const key of ['sb_secret_fixture', 'service-role-jwt-fixture']) {
      expect(() => readSupabaseBrowserConfig({
        VITE_SUPABASE_URL: 'https://project-ref.supabase.co',
        VITE_SUPABASE_PUBLISHABLE_KEY: key,
      })).toThrow('must be a Supabase publishable key')
    }
  })
})
