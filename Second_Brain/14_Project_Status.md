# Project Status

## Current baseline
Date context: August 23, 2026.

Current verified `main`:
`db33831caf6f88c17e4c6420560b8b81dbb045b9`

This baseline includes the responsive Kile N Others dashboard, corrected ranking provenance, live Players Form/Total Points, Supabase foundation, six-account/RLS foundation, persistent Supabase Auth sessions, completed account-aware shell, and merged PR #33 account-roster/live-player hardening.

Recent relevant merge commits / PRs:
- F3 Supabase foundation PR #26: `c690b53c61eb3921df057990b79f7fe668e5ba37`
- A1 Six Accounts + RLS PR #27: `548db8bfff6f17e6e99f459702916b3c41f3bd54`
- A1.5 Persistent Session PR #28: `524b794d56fde92ffe7d9a4d88093ed03a3a4eeb`
- A2 Account-aware Shell PR #30: merged
- workflow/autonomy docs PR #31: merged
- latest pre-PR #33 Second Brain workflow commit: `e8976ab5637e04f1479bf8b0be4b6ec2ef79453a`
- PR #33 `fix: isolate account rosters and live players`: merged into `db33831caf6f88c17e4c6420560b8b81dbb045b9`

Current phase state:
- F0 — Second Brain Foundation: COMPLETE
- F1 — Vercel Deployment: COMPLETE
- F2 — Desktop + Mobile Responsive Shell: COMPLETE
- P5A — Players Filtering/Sorting + live Form/Total Points: COMPLETE
- F3 — Supabase Foundation: COMPLETE
- A1 — Six Accounts + RLS: COMPLETE
- A1.5 — Persistent Session / Automatic Login: COMPLETE
- A2 — Account-aware Shell: COMPLETE
- A3 — Team Profiles + Avatars: CURRENT / NEXT

Official draft tag:
`kile-n-others-official-draft-2026-27`

## Hosted Supabase / production state
Hosted Supabase project:
- KNO
- project ref `asrrkwyqerfkynhjypov`

Hosted migrations applied:
- `20260822170000_foundation.sql`
- `20260822180000_league_accounts.sql`

Verified hosted account state:
- six `league_accounts` rows;
- exactly one `LEAGUE_OWNER`;
- exactly five `MEMBER`;
- Jakin Goff -> Vuk -> `LEAGUE_OWNER` / Commissioner;
- RLS enabled;
- anonymous account access blocked;
- intended authenticated account reads allowed;
- public signup disabled;
- email/password auth enabled;
- six real Supabase Auth users provisioned by Vuk using private passwords.

Production Vercel has:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

No Supabase secret/service-role credential is exposed to the frontend. Production has been redeployed using hosted Supabase and authentication works.

## A2 verified behavior
A2 is complete and production-verified.

Verified behavior:
- team-name + password login;
- Supabase-managed persistent session restoration;
- logout;
- no project password storage;
- authenticated account resolves to the correct team/account;
- My Team is account-specific;
- Jakin Goff alone displays Commissioner from real account role;
- other accounts behave as normal MEMBER accounts;
- desktop/mobile share the same account/session model.

Manual post-merge checks confirmed account-specific My Team, Miku007's correct roster, Jakin Goff's correct Vuk roster, and live Players data.

## PR #33 fixes now part of baseline
PR #33 corrected two production-critical classes of failure.

Account/roster identity:
- authenticated accounts resolve through one explicit approved account -> immutable roster manager ID mapping;
- unknown/inconsistent identity fails closed instead of inheriting Jakin/Vuk;
- Miku007 / Lovro correctly resolves to Miku's roster;
- account switches clear stale previous-account dashboard state;
- Commissioner role is authorization/presentation and does not determine roster identity.

Live Players:
- official Draft bootstrap Form and Total Points may contain valid signed values;
- the adapter now accepts those signed official values instead of rejecting the entire player payload;
- live Players directory is restored.

## Implemented and preserved
- Immutable official 90-pick 2026/27 draft archive.
- Six legal 15-player final rosters.
- Draft-time Official / model / MVP historical evidence.
- Current-roster derivation from processed project transactions.
- Shared dashboard/controller model with dedicated desktop/mobile presentations.
- Players directory using current normalized FPL Draft pool.
- Sort by Official FPL Draft Rank, Form, Total Points and MVP Consensus.
- Production `/api/fpl` Vercel Function.
- Supabase browser client/config and migration-first backend structure.
- Six seeded league identities with RLS and constrained MEMBER/LEAGUE_OWNER roles.
- Supabase-managed persistent browser sessions and automatic token refresh.
- Account-aware application shell and account-specific My Team.
- Explicit logout without project password storage.

## Not implemented yet
- A3 persistent team profiles and avatar upload/update.
- Real Kile N Others league/entry IDs (G1).
- Real league standings/Gameweek adapter.
- Persistent submitted project lineups.
- Commissioner post-start lineup administration.
- League score history/admin corrections.
- Verified Premier League player photos.
- Verified injury/availability/minutes enrichment.
- Trading Block and persistent trade proposals.
- Real FPL transaction reconciliation.
- Recommendation assistants.

## Known architectural boundaries
- Official draft history is immutable.
- Mobile and desktop share one domain/data/backend model.
- Persistent mutable league data must not use localStorage as authoritative truth.
- Supabase Auth session persistence may use Supabase-managed browser storage; project code must not store passwords or client-authoritative roles.
- Auth-sensitive permissions must be enforced by backend/RLS, not merely frontend hiding.
- Account roster identity must fail closed and must not fall back to Jakin/Vuk.
- Commissioner authorization and roster identity are separate concerns.
- Matchday league-specific FPL Draft endpoints remain unverified until G1.
- No automatic official FPL mutations before read/reconciliation behavior is proven.

## Immediate next milestones
1. A3 — Team Profiles + Avatars.
2. G1 — Real FPL Draft league/entry identity.
3. G2 — Real Gameweek/standings adapter.
4. P1/P2 — verified Premier League photo identity/photos where practical before final lineup visuals.
5. G3 — persistent lineup domain using the approved member-lock / Commissioner-override authorization model.

A3 must not be skipped for G1 unless Vuk explicitly changes the roadmap.

See `15_Current_Phase.md` for the current narrow task.