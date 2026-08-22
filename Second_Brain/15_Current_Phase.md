# Current Phase

## F3 — Supabase Foundation
Status: CURRENT

## Dependency state
- F0 — Second Brain Foundation: COMPLETE
- F1 — Vercel Deployment: COMPLETE
- F2 — Desktop + Mobile Responsive Shell: COMPLETE
- P5A — Players filtering/sorting + live Form/Total Points: COMPLETE
- F3 — Supabase Foundation: CURRENT
- A1 — Six accounts + RLS: NEXT AFTER F3

## Why F3 is now
The responsive shell and Players-page foundation are complete. The next dependency is a shared persistent backend so accounts, lineups, profiles, transactions and later league state do not rely on device-local state.

## F3 goal
Introduce the minimum Supabase foundation without prematurely implementing the higher-level league features.

Approved backend components:
- Supabase Auth;
- Postgres;
- Row Level Security;
- Storage foundation where needed;
- migrations committed to the repository;
- environment/configuration boundaries that keep privileged secrets server-only.

F3 should establish the project-owned database/auth foundation and schema conventions needed by later A1/G3 work, but should not attempt to implement the full lineup UI, standings, trades or scoring in the same step.

## Account/role direction
The league will have exactly six initial team accounts.

Roles:
- `MEMBER`
- `LEAGUE_OWNER`

Jakin Goff is the `LEAGUE_OWNER` account. Its product-facing title is **Commissioner**.

Authorization decisions must be enforced through backend/RLS policies rather than only frontend conditionals.

## Approved future lineup authorization contract
This rule must shape F3/A1/G3 schema and RLS design even though lineup persistence itself belongs to G3.

Before a verified Gameweek start/deadline:
- each member may create, edit and submit only their own lineup;
- a member cannot edit another manager's lineup.

After the Gameweek starts:
- MEMBER accounts cannot insert, edit, replace or submit a lineup for that Gameweek;
- only Jakin Goff / `LEAGUE_OWNER` / Commissioner may insert, edit or replace a lineup for itself or any other manager;
- commissioner post-start writes must be auditable when lineup persistence is implemented;
- the lock must use verified server/backend Gameweek timing, not only a client-side clock.

## P5A completion state
The Players page now uses shared desktop/mobile logic and verified live official FPL Draft data.

Available Players sort options:
- Official FPL Draft Rank;
- Form;
- Total Points;
- MVP Consensus.

Draft Model Rank remains preserved as project/model evidence but is no longer a primary Players-page sort option.

The Players page also exposes compact Form Leaders and Total Points Leaders from the same shared filtered directory.

## F3 acceptance direction
F3 should be complete only when:
- Supabase project configuration is represented safely in the app/repository;
- schema/migration workflow is established;
- minimum league/account persistence primitives needed by A1 are defined;
- RLS is enabled on project-owned mutable tables introduced by F3;
- privileged secrets are not committed;
- local/development environment setup is documented sufficiently for the next Codex task;
- existing Vercel/FPL functionality remains intact;
- typecheck/tests/build/lint pass as appropriate.

## Out of scope for F3
Do not implement in the same phase:
- the six production account credentials;
- full account-aware UI;
- Gameweek lineup persistence/UI;
- standings/Gameweek adapter;
- Trading Block;
- trade proposals;
- player photos;
- scoring;
- recommendation AI.

## Next phase
### A1 — Six Accounts + RLS

A1 will build the six actual league identities and authorization policies on top of the F3 foundation, including the unique Jakin Goff Commissioner/LEAGUE_OWNER identity.