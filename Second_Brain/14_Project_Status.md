# Project Status

## Current baseline
Date context: August 2026.

Current `main` contains the merged responsive Kile N Others dashboard, corrected player-ranking provenance, and the completed Players-page live Form/Total Points improvements.

Recent merge commits:
- F2 final mobile PR #20: `0370b6b0bff620b58a6ef50392a3d1c7571dbe6d`
- ranking provenance PR #23: `a70d06326704e924622d8c2d1297c5b97017c51a`
- Players Form/Total Points PR #24: `fc5d2587b676b6c6b89a490de05148ea714ade6d`

Current phase state:
- F0 — Second Brain Foundation: COMPLETE
- F1 — Vercel Deployment: COMPLETE
- F2 — Desktop + Mobile Responsive Shell: COMPLETE
- P5A — Players Filtering/Sorting + live Form/Total Points: COMPLETE
- F3 — Supabase Foundation: CURRENT
- A1 — Six Accounts + RLS: NEXT AFTER F3

Official draft tag:
`kile-n-others-official-draft-2026-27`

## Implemented and preserved
- Immutable official 90-pick 2026/27 draft archive.
- Six legal 15-player final rosters.
- Draft-time Official / model / MVP historical evidence.
- Current-roster derivation from processed project transactions.
- Shared dashboard/controller model.
- Dedicated desktop and mobile presentation trees.
- Floating mobile navigation with `League / My Team / Teams / More`.
- Gameweek-first League presentation with truthful unavailable states where data is not connected.
- Players directory using current normalized FPL Draft pool.
- Full verified player names.
- Player search, position and ownership filtering.
- Sort by Official FPL Draft Rank, Form, Total Points and MVP Consensus.
- Model ranking evidence preserved but removed as a primary in-season Players sort.
- Compact Form Leaders and Total Points Leaders.
- Live official FPL Draft Form and Total Points normalized at the adapter boundary.
- Production `/api/fpl` Vercel Function and deployment.
- Legacy Draft Room/model evidence retained.

## Current ranking/player state
Players-page current-season priorities:
- Official FPL Draft Rank — live official `draft_rank`;
- Form — live official FPL Draft bootstrap value;
- Total Points — live official FPL Draft bootstrap value;
- MVP Consensus — project full-pool consensus retained for comparison.

Frozen model evidence remains part of project ranking provenance and Draft Archive history but is no longer a primary Players-page sort option.

## Approved commissioner rule
Jakin Goff is the `LEAGUE_OWNER` account and will be displayed as **Commissioner**.

Future Gameweek lineup permissions:
- before the verified Gameweek start/deadline, each member may create/edit/submit only their own lineup;
- after kickoff, MEMBER lineup writes are locked;
- only the Commissioner may insert/edit/replace a lineup for itself or any other manager after kickoff;
- commissioner post-start writes must be backend/RLS enforced and auditable;
- Gameweek locking must use verified backend/server timing rather than client-only time.

## Not implemented yet
- Supabase remote database/auth/storage foundation.
- Six authenticated accounts.
- RLS/admin permissions.
- Team profile photos.
- Cross-device persistent mutable league state.
- Real Kile N Others league/entry IDs.
- Real league standings/Gameweek adapter.
- Persistent submitted project lineups.
- Commissioner post-start lineup administration.
- League score history/admin corrections.
- Player photos.
- Verified injury/availability/minutes enrichment.
- Trading Block and persistent trade proposals.
- Real FPL transaction reconciliation.
- Recommendation assistants.

## Known architectural boundaries
- Official draft history is immutable.
- Mobile and desktop share one domain/data/backend model.
- Persistent mutable state must not use localStorage as authoritative truth.
- Auth-sensitive permissions must be enforced by backend/RLS, not merely frontend hiding.
- Matchday league-specific FPL Draft endpoints remain unverified until real IDs/contracts are captured.
- Player status/classification must not be invented.
- No automatic official FPL mutations before read/reconciliation behavior is proven.

## Immediate next milestones
1. F3 — Supabase foundation.
2. A1 — six accounts + RLS.
3. A2 — account-aware shell.
4. G1/G2 — real league identity and Gameweek/standings adapters.
5. G3 — persistent lineup domain using the approved member-lock / Commissioner-override authorization model.

See `15_Current_Phase.md` for the current narrow task.