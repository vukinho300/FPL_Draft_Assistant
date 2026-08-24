# Project Status

## Current baseline
Date context: August 24, 2026.

Current verified `main`:
`a62d027d310efa08dbdd22dc53bf17818a863fec`

This baseline includes the responsive Kile N Others dashboard, live Players data, Supabase foundation, completed A-family account/auth/profile work, and the A3 mobile-density correction.

Recent relevant merges:
- PR #33 `fix: isolate account rosters and live players` -> `db33831caf6f88c17e4c6420560b8b81dbb045b9`
- PR #34 docs reconciliation -> `233f958791241ba78601ffc050119aa575cdbe53`
- PR #35 A3 Team Profiles + Avatars -> `ac5b5c1206b36e154e79a3ba5697928ad496b607`
- PR #36 A3 mobile profile density correction -> `a62d027d310efa08dbdd22dc53bf17818a863fec`

Current phase state:
- F0 — COMPLETE
- F1 — COMPLETE
- F2 — COMPLETE
- P5A — COMPLETE
- F3 — COMPLETE
- A1 — COMPLETE
- A1.5 — COMPLETE
- A2 — COMPLETE
- A3 — COMPLETE
- **A family — COMPLETE**
- **G1 — Real FPL Draft league/entry identity: CURRENT / NEXT**

## Hosted Supabase / production state
Hosted KNO project ref: `asrrkwyqerfkynhjypov`.

Applied hosted migrations:
- `20260822170000_foundation.sql`
- `20260822180000_league_accounts.sql`
- `20260823163233_team_profiles_avatars.sql`

Verified hosted state:
- six `league_accounts` rows;
- exactly one `LEAGUE_OWNER` and five `MEMBER` rows;
- six `team_profiles` rows;
- private `team-avatars` bucket with 2 MB JPEG/PNG/WebP contract;
- RLS enabled;
- intended authenticated account/profile/avatar reads allowed;
- profile/avatar writes owner-scoped;
- public signup disabled;
- six real Supabase Auth users provisioned using private passwords;
- production authentication and A3 profile/avatar flow work.

## A-family completed behavior
- team-name + password login;
- Supabase-managed persistent sessions;
- logout;
- no project password storage;
- stable account -> immutable roster manager ID mapping;
- no fallback to Jakin/Vuk;
- Miku007 / Lovro -> Miku roster correction;
- stale-account-state prevention;
- Jakin Goff alone as Commissioner;
- one persistent profile per account;
- private owner-managed avatars with deterministic initial fallback;
- shared My Team/Teams profile state;
- My Team navigation avatar/fallback;
- account-switch profile isolation;
- compact mobile profile/current-roster rendering;
- live Players data with signed official Form/Total Points accepted.

## Not implemented yet
- real Kile N Others league/entry IDs (G1);
- real league standings/Gameweek adapter (G2);
- persistent submitted project lineups (G3);
- Gameweek lineup presentation (G4);
- scoring/event feed/corrections (G5/G5A/G6);
- verified Premier League player photos;
- richer minutes/availability enrichment;
- Trading Block/trades;
- real FPL transaction reconciliation.

## Known boundaries
- official draft history is immutable;
- mobile and desktop share one domain/data/backend model;
- persistent mutable league data does not use localStorage as authority;
- account roster identity fails closed;
- Commissioner authorization and roster identity are separate concerns;
- profile/avatar data is presentation data, not identity authority;
- league-specific FPL Draft endpoints remain unverified until G1;
- no automatic official FPL mutations before read/reconciliation behavior is proven.

## Workflow checkpoint
This is the consolidated **end-of-A** reconciliation.

Second Brain updates now happen at the end of a roadmap letter family rather than after each numbered step, unless an earlier correction is needed because the control manual becomes materially false or unsafe.

Implementation steps remain narrow. Prefer one coherent commit per narrow task and avoid unnecessary checkpoint/progress commits. Vuk alone merges and may squash when appropriate.

## Immediate next milestones
1. G1 — Real FPL Draft league/entry identity.
2. G2 — Real Gameweek/standings adapter.
3. G3 — Persistent lineup domain.
4. G4 — My Team/Teams Gameweek lineup presentation.
5. G5/G5A/G6 — scoring, event feed and Commissioner corrections.

See `15_Current_Phase.md` for the current task.
