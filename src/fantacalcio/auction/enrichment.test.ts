import { describe, expect, it } from 'vitest'
import { encodeEnrichment, healthLabel, loadEnrichment, normalizeEnrichment } from './enrichment.ts'
import type { CanonicalPlayer } from './playerPool.ts'

const pool: CanonicalPlayer[] = Array.from({ length: 534 }, (_, i) => ({ playerRef: `fantacalcio:fc:${i + 1}`, displayName: `Fixture ${i}`, club: 'Fixture', role: 'DIF', eligibility: 'SELECTABLE' }))
function source() {
  return { checkedAt: '2026-09-22T19:00:00.000Z', listoneVersion: 'test', listoneSeason: 's_2025_2026',
    strategy: { id: 'dynamic-strategy', name: 'Test SOS', creator: 'SOS Fanta', season: 's_26_27', format: 'classic', list: 'serie-a', credits: 500, tierMapping: { '1': { name: 'Test tier' } } },
    listone: pool.map((_, i) => ({ player_id: `fl-${i}`, fantacalcio_id: i + 1, injured: i === 0 ? 1 : i === 2 ? 3 : 0 })),
    rows: pool.slice(0, 500).map((_, i) => ({ player_id: `fl-${i}`, strategy_id: 'dynamic-strategy', fascia: 1, fascia_second: null, fascia_third: null, price: 10, perc_price: '2.0000', notes: i === 1 ? ['rischio_infortuni', 'rigorista'] : [], target: null, comment: 'Must never export' })) }
}
describe('local enrichment contract', () => {
  it('joins all 534 identities exactly and retains missing SOS rows explicitly without comments', async () => {
    const result = normalizeEnrichment(source(), pool)
    expect(result.players).toHaveLength(534)
    expect(new Set(result.players.map(p => p.fantalabId)).size).toBe(534)
    expect(result.players[533].hasStrategy).toBe(false)
    expect(JSON.stringify(result)).not.toContain('Must never export')
    expect(await loadEnrichment(await encodeEnrichment(result), pool)).toEqual(result)
  })
  it('rejects corrupt checksums, wrong release, missing/duplicate identities and wrong strategy', async () => {
    const data = normalizeEnrichment(source(), pool)
    const envelope = JSON.parse(await encodeEnrichment(data)); envelope.payload += ' '
    await expect(loadEnrichment(JSON.stringify(envelope), pool)).rejects.toThrow()
    await expect(loadEnrichment(await encodeEnrichment({ ...data, release: 'wrong' }), pool)).rejects.toThrow()
    const withToken = { ...data, access_token: 'must-never-cache' }
    const withSession = { ...data, players: [{ ...data.players[0], session: 'must-never-cache' }, ...data.players.slice(1)] }
    await expect(loadEnrichment(await encodeEnrichment(withToken), pool)).rejects.toThrow()
    await expect(loadEnrichment(await encodeEnrichment(withSession), pool)).rejects.toThrow()
    await expect(loadEnrichment(await encodeEnrichment({ ...data, players: [...data.players.slice(1), data.players[1]] }), pool)).rejects.toThrow()
    const missing = source(); missing.listone.pop(); expect(() => normalizeEnrichment(missing, pool)).toThrow()
    const duplicate = source(); duplicate.listone[1].fantacalcio_id = 1; expect(() => normalizeEnrichment(duplicate, pool)).toThrow()
    const wrong = source(); wrong.rows[0].strategy_id = 'different'; expect(() => normalizeEnrichment(wrong, pool)).toThrow()
    wrong.strategy.format = 'mantra'; expect(() => normalizeEnrichment(wrong, pool)).toThrow()
  })
  it('keeps current health, risk tags and unverified codes distinct', () => {
    const data = normalizeEnrichment(source(), pool)
    expect(healthLabel(data.players[0])).toBe('INJURED')
    expect(data.players[0].injuryRisk).toBe(false)
    expect(healthLabel(data.players[1])).toBe('Not currently flagged injured')
    expect(data.players[1].injuryRisk).toBe(true)
    expect(healthLabel(data.players[2])).toBe('Status unverified (source code 3)')
    expect(healthLabel(undefined)).toBe('Health enrichment not loaded')
  })
})
