import rawOfficialDraft from './officialDraft2026-27.json' with { type: 'json' }

import {
  createImmutableOfficialDraftSnapshot,
  type OfficialDraftSnapshot,
} from '../../../domain/officialDraft.ts'

export const officialDraft202627 = createImmutableOfficialDraftSnapshot(
  rawOfficialDraft as OfficialDraftSnapshot,
)
