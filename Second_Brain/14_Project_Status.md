# Project Status

## Current baseline
Date context: August 2026.

Current `main` contains the merged Kile N Others dashboard transition.

Key historical commits:
- official draft snapshot commit: `71c7c791401c747f7d50c80616941f9bbce78fd5`
- dashboard implementation commit: `044c2cdb0e4cea5032dccc8ac9f1ed727105c61f`
- PR #7 merge commit: `fe41f8300b836722a458bae86dc1aa7f8146d57f`
- F1 deployment-fix PR #10 merge commit: `47608eab6d851807e23eced4d774d5a42ed02925`

Current phase state:
- F0 — Second Brain Foundation: COMPLETE
- F1 — Vercel Deployment: COMPLETE
- F2 — Desktop + Mobile Responsive Shell: CURRENT, NOT YET IMPLEMENTED

Official draft tag:
`kile-n-others-official-draft-2026-27`

## Implemented and preserved
- Immutable official 90-pick 2026/27 draft archive.
- Six legal 15-player final rosters.
- Draft-time Official / model / MVP ranking archive.
- Current-roster derivation from processed project transactions.
- Unique ownership validation.
- League activity domain.
- League dashboard shell.
- My Team page shell.
- Teams pitch-style squad view.
- Matchday shell with unavailable/unverified boundaries.
- Players directory using current normalized FPL Draft player pool.
- Transactions page/domain foundations.
- Draft Archive.
- Legacy Draft Room and draft-night recommendation logic retained.
- Public FPL Draft bootstrap adapter via `/api/fpl`.
- Production Vercel deployment of the Kile N Others dashboard.
- Production project-owned `/api/fpl` Vercel Function boundary.
- Required Vercel packaging configuration in `vercel.json` for `src/services/fpl/**`.
- Matchday endpoint research documentation.

## Current ranking/model state
Preserve:
- Official Draft rank as primary evidence.
- `DraftFitHeuristicV1`: 70% official-rank evidence + 30% historical model evidence when exact trusted model signal exists; otherwise official only.
- Fixed position-specific Ridge signal remains secondary evidence.
- Data quality: PASS WITH EXCLUSIONS.
- Leakage: PASS.
- Model sanity: PASS.

Do not start new model-family/XGBoost work as part of the league-dashboard foundation.

## Not implemented yet
- F2 desktop/mobile responsive shell and intentional phone usability.
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

## Second Brain status
F0 is complete and the Second Brain is the project control manual.

Repository truth remains authoritative when implementation and documentation disagree. Second Brain phase/status documentation must be reconciled after verified implementation changes and before planning from it.

No implementation state should be documented as complete until it has actually been merged and verified.

## Immediate next milestones
1. Reconcile and merge the documentation-only F0/F1/F2 status sync.
2. F2 — desktop + mobile responsive shell.
3. F3 — Supabase foundation.
4. A1 — six accounts + RLS.

See `15_Current_Phase.md` for the exact current narrow phase.