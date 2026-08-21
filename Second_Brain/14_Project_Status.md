# Project Status

## Current baseline
Date context: August 2026.

Current `main` contains the merged Kile N Others dashboard plus completed F2 desktop/mobile presentation work.

Key historical commits:
- official draft snapshot commit: `71c7c791401c747f7d50c80616941f9bbce78fd5`
- dashboard implementation commit: `044c2cdb0e4cea5032dccc8ac9f1ed727105c61f`
- PR #7 merge commit: `fe41f8300b836722a458bae86dc1aa7f8146d57f`
- F1 deployment-fix PR #10 merge commit: `47608eab6d851807e23eced4d774d5a42ed02925`
- F2 final mobile PR #20 merge commit: `0370b6b0bff620b58a6ef50392a3d1c7571dbe6d`

Current phase state:
- F0 — Second Brain Foundation: COMPLETE
- F1 — Vercel Deployment: COMPLETE
- F2 — Desktop + Mobile Responsive Shell: COMPLETE
- P5A — Basic Players Filtering/Sorting: CURRENT
- F3 — Supabase Foundation: NEXT AFTER P5A

Official draft tag:
`kile-n-others-official-draft-2026-27`

## Implemented and preserved
- Immutable official 90-pick 2026/27 draft archive.
- Six legal 15-player final rosters.
- Draft-time Official / model / MVP ranking archive.
- Current-roster derivation from processed project transactions.
- Unique ownership validation.
- League activity domain.
- Shared dashboard/controller model.
- Dedicated desktop and mobile presentation trees.
- Viewport-based presentation selection with one presentation mounted at a time.
- Floating mobile navigation with `League / My Team / Teams / More` primary order.
- Intentional mobile League, My Team, Teams, Matchday, Players, Transactions and Draft Archive views.
- Gameweek-first mobile League information hierarchy with truthful unavailable states for unconnected data.
- Players directory using current normalized FPL Draft player pool.
- Transactions page/domain foundations.
- Draft Archive.
- Legacy Draft Room and draft-night recommendation logic retained.
- Public FPL Draft bootstrap adapter via `/api/fpl`.
- Production Vercel deployment of the Kile N Others dashboard.
- Production project-owned `/api/fpl` Vercel Function boundary.
- Required Vercel packaging configuration in `vercel.json` for `src/services/fpl/**`.
- Matchday endpoint research documentation.

## F2 completion
F2 is COMPLETE after merged PR #20 and user acceptance of the production mobile experience.

F2 established the final presentation boundary only. It did not implement database-backed lineups, real standings, real Gameweek points, player photos or scoring.

## Current P5A target
Improve the existing Players page using already-available project data before starting F3.

P5A must add shared desktop/mobile controls for:
- position;
- ownership: All / Free Agents / Owned;
- sorting by Official Draft rank;
- sorting by Draft MVP rank;
- sorting by model rank where currently exposed reliably;
- existing player/owner search.

Free Agent state derives from current ownership after PROCESSED transactions. Missing ranking values remain unknown and sort deterministically.

## Current ranking/model state
Preserve:
- Official Draft rank as primary evidence.
- `DraftFitHeuristicV1`: 70% official-rank evidence + 30% historical model evidence when exact trusted model signal exists; otherwise official only.
- Fixed position-specific Ridge signal remains secondary evidence.
- Data quality: PASS WITH EXCLUSIONS.
- Leakage: PASS.
- Model sanity: PASS.

Do not start new model-family/XGBoost work as part of P5A or the league-dashboard foundation.

## Not implemented yet
- P5A enhanced Players filtering/sorting.
- Remote database.
- Authentication/accounts.
- RLS/admin permissions.
- Team profile photos.
- Cross-device persistence.
- Real Kile N Others league/entry IDs.
- Real league standings.
- Real manager Gameweek squads.
- Submitted project lineups.
- League score history/admin corrections.
- Player photos.
- Verified injury/availability/minutes enrichment.
- Trading Block.
- Persistent/direct trade proposals.
- Real FPL transaction reconciliation.
- Start/bench assistant.
- Waiver/free-agent assistant.

## Known architectural boundaries
- Official draft history is immutable.
- Matchday league-specific FPL Draft endpoints remain unverified until real IDs/contracts are captured.
- Authenticated/mutation FPL Draft routes are outside current integration.
- Current post-draft project transactions are not yet remotely persistent.
- Player-status classifications must not be invented when evidence is insufficient.
- Mobile and desktop must share the same filtering/sorting logic and future persistent backend state.

## Second Brain status
F0 is complete and the Second Brain is the project control manual.

Repository truth remains authoritative when implementation and documentation disagree. Second Brain phase/status documentation must be reconciled after verified implementation changes and before planning from it.

No implementation state should be documented as complete until it has actually been merged and verified.

## Immediate next milestones
1. P5A — Basic Players filtering/sorting.
2. F3 — Supabase foundation.
3. A1 — six accounts + RLS.
4. A2 — account-aware shell.

See `15_Current_Phase.md` for the exact current narrow phase.