import { officialDraft202627 } from '../src/data/leagues/kile-n-others/officialDraft2026-27.ts'
import { restoreValidatedDraftPicks } from '../src/domain/officialDraft.ts'

// Development-only, explicit export. This script never reads or writes browser localStorage.
process.stdout.write(`${JSON.stringify(restoreValidatedDraftPicks(officialDraft202627), null, 2)}\n`)
