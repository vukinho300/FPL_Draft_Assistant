import { healthLabel, type Enrichment, type PlayerEnrichment } from './auction/enrichment.ts'

export function EnrichmentSignals({ data, player }: { readonly data: Enrichment | null; readonly player: PlayerEnrichment | undefined }) {
  return <>
    <section aria-label="SOS Fanta analysis" className="analysis-signal"><h3>SOS FANTA</h3>
      {data === null || player === undefined ? <p>Optional local enrichment not loaded.</p> : <>
        {!player.hasStrategy ? <p>No SOS strategy row for this player.</p> : <>
          <p>SOS tier: <strong>{player.tiers.length === 0 ? 'Unassigned' : player.tiers.map(id => id === '0' ? 'Unassigned (raw 0)' : `${data.strategy.tierMapping[id]} (${id})`).join(' / ')}</strong></p>
          <p>SOS reference price: <strong>{player.price ?? 'Unavailable'}</strong> / {data.strategy.credits} strategy credits · {player.percentage ?? '—'}%</p>
          <p>Tags: {player.tags.filter(tag => tag !== 'rischio_infortuni').join(' · ') || 'None supplied'}{player.target === true && ' · TARGET'}</p>
        </>}
        <small>{data.strategy.creator} · {data.strategy.name} · Checked {new Date(data.checkedAt).toLocaleString()}</small>
      </>}
    </section>
    <section aria-label="Health analysis" className="analysis-signal"><h3>HEALTH</h3>
      <p className={player?.injured === true ? 'health-injured' : ''}>{healthLabel(player)}</p>
      {player?.injuryRisk && <p>Expert injury-risk tag: rischio_infortuni (separate from current status)</p>}
    </section>
  </>
}
