# Current Phase

## A3 — Team Profiles + Avatars
Status: CURRENT / NEXT

Do not start G1 while A3 is current unless Vuk explicitly changes the roadmap.

## Dependency state
- F0 — Second Brain Foundation: COMPLETE
- F1 — Vercel Deployment: COMPLETE
- F2 — Desktop + Mobile Responsive Shell: COMPLETE
- P5A — Players filtering/sorting + live Form/Total Points: COMPLETE
- F3 — Supabase Foundation: COMPLETE
- A1 — Six Accounts + RLS: COMPLETE
- A1.5 — Persistent Session / Automatic Login: COMPLETE
- A2 — Account-aware Shell: COMPLETE and production-verified
- A3 — Team Profiles + Avatars: CURRENT / NEXT

## Verified baseline entering A3
Current verified `main`:
`db33831caf6f88c17e4c6420560b8b81dbb045b9`

A2 is complete and working in production.

Verified account/session behavior:
- team-name + password login;
- Supabase-managed session restoration across normal refresh/reopen while valid;
- explicit logout;
- no project password storage;
- current Auth user resolves to one valid league account;
- My Team resolves to the authenticated team;
- Jakin Goff alone displays Commissioner from real account role;
- other accounts behave as normal MEMBER accounts;
- desktop and mobile share the same authenticated account/session model.

Hosted Supabase production is established in KNO (`asrrkwyqerfkynhjypov`):
- repository migrations `20260822170000_foundation.sql` and `20260822180000_league_accounts.sql` are applied;
- six league account rows exist;
- one `LEAGUE_OWNER`, five `MEMBER`;
- RLS enabled;
- anonymous account reads blocked;
- intended authenticated account reads allowed;
- public signup disabled;
- six private production Auth users provisioned;
- Vercel browser-safe Supabase variables configured;
- no service-role/secret credential exposed to the frontend;
- production authentication works.

PR #33 is part of the baseline and must not be regressed:
- stable approved account -> immutable roster manager ID mapping;
- fail closed on unknown/inconsistent roster identity;
- no fallback to Jakin/Vuk;
- Miku007 / Lovro -> Miku roster correction;
- stale previous-account dashboard prevention on account switch;
- Commissioner authorization separated from roster identity;
- valid signed official Form / Total Points accepted;
- live Players data restored.

## Why A3 is now
The roadmap intentionally places A3 after the account-aware shell and before real FPL Draft league/entry identity work.

The product now has:
- persistent authenticated league identities;
- stable account-to-roster identity;
- backend role/RLS foundation;
- shared desktop/mobile account-aware UI;
- hosted Supabase production infrastructure.

The next dependency is to give those six authenticated teams persistent league-visible profile data and avatars before moving into G1 league/entry integration.

## A3 product outcome
Each of the six league teams should have a persistent profile backed by Supabase, including an avatar that can be uploaded/replaced according to approved authorization rules, and the Teams page should consume that persistent profile data.

The experience should work as one shared league feature across desktop and mobile.

## Approved A3 scope
In scope:
- persistent Team profile table/data model;
- avatar upload/update using Supabase Storage or the repository-consistent equivalent approved backend path;
- Teams page reads and displays persistent profile/avatar data;
- owner-scoped profile/avatar updates for the authenticated team;
- narrowly justified Commissioner repair/admin capability if repository evidence shows it is needed;
- backend/RLS/storage policies protecting reads/writes;
- deterministic tests and verification appropriate to the chosen implementation.

## Non-negotiable architecture / security rules
- Supabase Auth/Postgres/RLS/Storage remains the persistent backend.
- Persistent profile/avatar state must not use localStorage as authoritative truth.
- Normal members may modify only fields explicitly permitted for their own account/team.
- Any Commissioner-only repair capability must derive from backend `LEAGUE_OWNER` authorization, not a React-only flag.
- No Supabase secret/service-role credential may be exposed to browser code or Vite public variables.
- Do not request, store, commit, or log Vuk's production passwords.
- Preserve the existing six league-account identities and stable account -> immutable roster manager ID mapping.
- Do not let profile display names become roster identity authority.
- Desktop/mobile must consume one shared profile data contract rather than maintaining separate persistent state.
- Preserve immutable official draft history and current roster derivation rules.
- Avoid broad public/anonymous profile mutation.

## Out of scope for A3
Do not implement:
- G1 real FPL Draft league ID / six entry IDs;
- G2 standings/Gameweek adapter;
- Gameweek lineup persistence or locking;
- Commissioner post-kickoff lineup administration;
- scoring/corrections;
- Trading Block/trade proposals;
- Premier League player-photo identity work;
- unrelated Players enrichment;
- automatic official FPL writes.

## Acceptance direction
A3 is complete when repository evidence and testing demonstrate that:
- all six teams can be represented by persistent profiles linked to the existing league-account identity model;
- authenticated league members can read the league-visible profiles needed by Teams;
- a normal MEMBER cannot update another team's protected profile/avatar data;
- a team can update its permitted own profile/avatar data;
- avatar storage/read/update authorization is enforced through backend policies, not only UI hiding;
- Teams page consumes persistent profile data on the shared desktop/mobile model;
- missing avatar/profile data has a truthful fallback state rather than fabricated data;
- account-to-roster identity behavior from PR #33 is unchanged;
- existing login/session/logout/member/Commissioner behavior is not regressed;
- no secret/password is added to source control or browser configuration;
- relevant typecheck/tests/build/lint/database/RLS/storage checks pass;
- any genuinely manual-only production/browser check is isolated under **Manual verification for Vuk** with exact action, expected result, and failure signal.

Codex should inspect the repository and choose the exact schema, policy, storage path, component structure, state flow, migration shape, and test strategy. ChatGPT should not prescribe unnecessary file-level implementation.

## Workflow for the eventual A3 implementation
- continue the same Codex session while its existing repository/tool context remains useful;
- use a fresh short-lived implementation branch from current `main`;
- Codex performs every check it can itself;
- do not stop unrelated work because one private-password/browser-only check remains;
- open one Draft PR;
- ChatGPT independently reviews the actual PR/diff/CI;
- Vuk alone merges.

## Next phase after A3
After A3 is merged, verified, and reconciled in the Second Brain, proceed to:

**G1 — Real FPL Draft league/entry identity**

unless Vuk explicitly changes the roadmap ordering.