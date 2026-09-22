import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { EnrichmentSignals } from './EnrichmentSignals.tsx'
import type { Enrichment, PlayerEnrichment } from './auction/enrichment.ts'

const player: PlayerEnrichment = { playerRef: 'fixture', fantalabId: 'fixture-fl', tiers: ['1'], price: 9, percentage: 1.8,
  tags: ['rischio_infortuni', 'rigorista'], target: true, injured: false, injuryCode: 0, injuryRisk: true, hasStrategy: true }
const data: Enrichment = { schema: 1, scope: 'LOCAL_ONLY', release: 'fixture', checkedAt: '2026-09-22T00:00:00Z', listoneVersion: 'fixture', listoneSeason: 's_2025_2026',
  source: 'https://api.fantalab.it/v2', strategy: { id: 'fixture', name: 'Fixture SOS', creator: 'SOS Fanta', season: 's_26_27', format: 'classic', list: 'serie-a', credits: 500, tierMapping: { '1': 'Fixture tier' } }, players: [player] }

describe('separate SOS and health signals', () => {
  it('renders source price and tags with risk separated from current injury', () => {
    const html = renderToStaticMarkup(<EnrichmentSignals data={data} player={player} />)
    expect(html).toContain('Fixture tier (1)')
    expect(html).toContain('SOS reference price')
    expect(html).toContain('rigorista')
    expect(html).toContain('Not currently flagged injured')
    expect(html).toContain('Expert injury-risk tag')
    expect(html).not.toContain('>FIT<')
    expect(renderToStaticMarkup(<EnrichmentSignals data={data} player={{ ...player, injured: true, injuryCode: 1 }} />)).toContain('INJURED')
  })
  it('supports unloaded enrichment and players absent from the SOS strategy', () => {
    expect(renderToStaticMarkup(<EnrichmentSignals data={null} player={undefined} />)).toContain('Optional local enrichment not loaded.')
    expect(renderToStaticMarkup(<EnrichmentSignals data={data} player={{ ...player, hasStrategy: false }} />)).toContain('No SOS strategy row')
  })
})
