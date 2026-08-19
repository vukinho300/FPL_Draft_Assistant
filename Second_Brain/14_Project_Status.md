# Project Status

## Current baseline
Date context: August 2026.

Current `main` contains the merged Kile N Others dashboard transition.

Key historical commits:
- official draft snapshot commit: `71c7c791401c747f7d50c80616941f9bbce78fd5`
- dashboard implementation commit: `044c2cdb0e4cea5032dccc8ac9f1ed727105c61f`
- PR #7 merge commit: `fe41f8300b836722a458bae86dc1aa7f8146d57f`

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
- Production Vercel deployment verification.
- Proper mobile responsiveness.
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
This Second Brain is being introduced as a documentation-only foundation. Application code should remain identical to the merged dashboard baseline during F0.

## Immediate next milestones
1. Complete/verify F0 Second Brain documentation-only PR.
2. F1 deploy current `main` to Vercel.
3. F2 mobile responsiveness.
4. F3 Supabase foundation.

See `15_Current_Phase.md` for the exact next narrow task.