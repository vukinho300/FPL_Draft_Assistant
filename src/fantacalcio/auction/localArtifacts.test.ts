import { describe, expect, it, vi } from 'vitest'
import { restoreCachedEnrichment, restoreCachedProjection, type LocalAuctionArtifactStore } from './localArtifacts.ts'
import type { AuctionValuePlayer } from './economics.ts'
import type { Enrichment } from './enrichment.ts'

function memoryStore() {
  const saved = new Map<string, unknown>()
  const store: LocalAuctionArtifactStore = {
    readProjection: vi.fn(async () => saved.get('projections.csv')),
    readEnrichment: vi.fn(async () => saved.get('fantalab-enrichment.json')),
    writeProjection: vi.fn(async bytes => { saved.set('projections.csv', bytes) }),
    writeEnrichment: vi.fn(async raw => { saved.set('fantalab-enrichment.json', raw) }),
    deleteProjection: vi.fn(async () => { saved.delete('projections.csv') }),
    deleteEnrichment: vi.fn(async () => { saved.delete('fantalab-enrichment.json') }),
    clear: vi.fn(async () => { saved.clear() }),
  }
  return { store, saved }
}

const pool = [{ playerRef: 'fantacalcio:fc:1' }] as AuctionValuePlayer[]
const enrichment = { schema: 1, scope: 'LOCAL_ONLY' } as Enrichment

describe('browser-local auction artifacts', () => {
  it('restores raw projections before enrichment and passes both through validators', async () => {
    const { store } = memoryStore()
    const bytes = new TextEncoder().encode('original,csv\r\n').buffer
    const raw = '{"payload":"local-only"}'
    await store.writeProjection(bytes)
    await store.writeEnrichment(raw)
    const calls: string[] = []
    const validateProjection = vi.fn(async (blob: Blob) => { calls.push(`projection:${await blob.text()}`); return pool })
    const validateEnrichment = vi.fn(async (text: string, validatedPool: readonly AuctionValuePlayer[]) => {
      calls.push(`enrichment:${text}`)
      expect(validatedPool).toBe(pool)
      return enrichment
    })
    const projections = await restoreCachedProjection(store, validateProjection)
    expect(projections).toEqual({ status: 'restored', value: pool })
    const result = await restoreCachedEnrichment(store, projections.value!, validateEnrichment)
    expect(result).toEqual({ status: 'restored', value: enrichment })
    expect(calls).toEqual(['projection:original,csv\r\n', `enrichment:${raw}`])
  })

  it('deletes an invalid projection and leaves enrichment unread until a valid pool exists', async () => {
    const { store, saved } = memoryStore()
    await store.writeProjection(new TextEncoder().encode('wrong').buffer)
    await store.writeEnrichment('not validated yet')
    const result = await restoreCachedProjection(store, async () => { throw new Error('checksum mismatch') })
    expect(result).toEqual({ status: 'invalid', value: null })
    expect(saved.has('projections.csv')).toBe(false)
    expect(store.readEnrichment).not.toHaveBeenCalled()
    expect(saved.has('fantalab-enrichment.json')).toBe(true)
  })

  it('deletes invalid enrichment without deleting valid projections', async () => {
    const { store, saved } = memoryStore()
    await store.writeProjection(new ArrayBuffer(2))
    await store.writeEnrichment('corrupt JSON')
    const result = await restoreCachedEnrichment(store, pool, async () => { throw new Error('identity mismatch') })
    expect(result).toEqual({ status: 'invalid', value: null })
    expect(saved.has('projections.csv')).toBe(true)
    expect(saved.has('fantalab-enrichment.json')).toBe(false)
  })

  it('clears both artifacts and has no authentication or session storage key', async () => {
    const { store, saved } = memoryStore()
    await store.writeProjection(new ArrayBuffer(1))
    await store.writeEnrichment('{"payload":"LOCAL_ONLY"}')
    expect([...saved.keys()]).toEqual(['projections.csv', 'fantalab-enrichment.json'])
    await store.clear()
    expect(saved.size).toBe(0)
  })
})
