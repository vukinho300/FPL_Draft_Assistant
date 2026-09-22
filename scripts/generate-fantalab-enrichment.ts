import { execFileSync } from 'node:child_process'
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadAuctionValueRelease } from '../src/fantacalcio/auction/economics.ts'
import { normalizeEnrichment, encodeEnrichment, loadEnrichment } from '../src/fantacalcio/auction/enrichment.ts'

// Run with the frozen projections.csv path; the FL1 browser must be signed in on localhost:9223.
// No credential argument, environment export, browser-state file, raw strategy or premium comment is saved.
try {
  const path = process.argv[2]
  if (!path) throw new Error('Provide the accepted projections.csv path')
  const pool = await loadAuctionValueRelease(new Blob([readFileSync(path)]))
  const raw = execFileSync('python', [fileURLToPath(new URL('./fantalab-session.py', import.meta.url))],
    { encoding: 'utf8', maxBuffer: 5_000_000, stdio: ['ignore', 'pipe', 'pipe'] })
  const data = normalizeEnrichment(JSON.parse(raw), pool)
  const encoded = await encodeEnrichment(data)
  await loadEnrichment(encoded, pool)
  const output = resolve(dirname(fileURLToPath(import.meta.url)), '../.local/fantalab-enrichment.json')
  mkdirSync(dirname(output), { recursive: true })
  writeFileSync(output, encoded, { mode: 0o600 })
  console.log(JSON.stringify({ output, players: data.players.length, sosRows: data.players.filter(p => p.hasStrategy).length, checkedAt: data.checkedAt }))
} catch {
  console.error('Enrichment generation failed closed. Check the frozen release, signed-in FL1 session and exact SOS Classic source schema. No artifact was written.')
  process.exitCode = 1
}
