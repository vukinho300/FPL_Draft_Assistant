# Project Status

## Current baseline
Date context: August 2026.

Current `main` contains the merged responsive Kile N Others dashboard, corrected player-ranking provenance, completed Players live Form/Total Points work, Supabase foundation, six-account/RLS foundation and persistent Supabase Auth session lifecycle.

Recent merge commits:
- F2 final mobile PR #20: `0370b6b0bff620b58a6ef50392a3d1c7571dbe6d`
- ranking provenance PR #23: `a70d06326704e924622d8c2d1297c5b97017c51a`
- Players Form/Total Points PR #24: `fc5d2587b676b6c6b89a490de05148ea714ade6d`
- F3 Supabase foundation PR #26: `c690b53c61eb3921df057990b79f7fe668e5ba37`
- A1 Six Accounts + RLS PR #27: `548db8bfff6f17e6e99f459702916b3c41f3bd54`
- A1.5 Persistent Session PR #28: `524b794d56fde92ffe7d9a4d88093ed03a3a4eeb`

Current phase state:
- F0 — Second Brain Foundation: COMPLETE
- F1 — Vercel Deployment: COMPLETE
- F2 — Desktop + Mobile Responsive Shell: COMPLETE
- P5A — Players Filtering/Sorting + live Form/Total Points: COMPLETE
- F3 — Supabase Foundation: COMPLETE
- A1 — Six Accounts + RLS: COMPLETE
- A1.5 — Persistent Session / Automatic Login: COMPLETE
- A2 — Account-aware Shell: CURRENT

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
- Supabase JS client/config boundary with safe publishable browser environment variables.
- Repository-pinned Supabase local development workflow and migration-first structure.
- Six seeded league identities with constrained MEMBER/LEAGUE_OWNER schema and RLS foundation.
- Jakin Goff is the sole LEAGUE_OWNER and product-facing Commissioner.
- Local/admin provisioning workflow does not commit production passwords.
- Generated Supabase database types and local RLS verification.
- Project-owned auth session service with `INITIALIZING` / `AUTHENTICATED` / `UNAUTHENTICATED` lifecycle.
- Supabase-managed persistent browser sessions and automatic token refresh.
- Shared team-name to internal Auth identity resolution.
- Explicit sign-out behavior without project password storage.

## Current authentication state
Authentication/security foundations are implemented, but the current dashboard has not yet been gated or made account-aware.

A2 must connect the existing session/account layers to the product shell so that:
- a valid stored session restores automatically;
- unauthenticated users see team-name + password login;
- authenticated users enter the app;
- authenticated identity resolves to the correct league account/team;
- My Team becomes the logged-in team;
- Jakin Goff is displayed as Commissioner based on real account data;
- logout clears the session;
- desktop/mobile share the same account/session model.

Browser session persistence is convenience only. Backend/RLS remains authoritative for permissions.

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
- A2 account-aware login/application shell.
- Hosted/production account provisioning and production Supabase environment setup where still required.
- Team profile photos.
- Cross-device persistent mutable league feature state beyond Auth sessions.
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
- Persistent mutable league data must not use localStorage as authoritative truth.
- Supabase Auth session persistence may use Supabase-managed browser storage; project code must not store passwords or client-authoritative roles.
- Auth-sensitive permissions must be enforced by backend/RLS, not merely frontend hiding.
- Matchday league-specific FPL Draft endpoints remain unverified until real IDs/contracts are captured.
- Player status/classification must not be invented.
- No automatic official FPL mutations before read/reconciliation behavior is proven.

## Immediate next milestones
1. A2 — account-aware shell.
2. G1 — real FPL Draft league/entry identity.
3. G2 — real Gameweek/standings adapter.
4. P1/P2 — verified Premier League photo identity/photos where practical before final lineup visuals.
5. G3 — persistent lineup domain using the approved member-lock / Commissioner-override authorization model.

See `15_Current_Phase.md` for the current narrow task.