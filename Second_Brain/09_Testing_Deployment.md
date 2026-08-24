# Testing and Deployment

## Testing philosophy
Use the smallest meaningful test surface during implementation, then run the full relevant merge-confidence checks before a meaningful PR is considered ready.

Codex performs every verification it can reliably perform itself. A check belongs to Vuk only when it genuinely requires private credentials, a real device/browser, unavailable authenticated external access, or subjective product judgment.

A manual-only check must not automatically block unrelated technical work.

## PR/merge checkpoint
Before merge of a meaningful implementation PR, normally run:
- `npm run typecheck`
- `npm test`
- `npm run build`
- `npm run lint`
- `git diff --check`

Run `npm run verify:fpl-live` when the live FPL boundary or current-player/ranking join is relevant. Run Supabase/RLS/Storage verification when backend authorization/storage changes.

Never report a check as passed unless it was actually performed.

## Regression priorities
Protect these invariants:
- immutable official draft remains valid;
- current roster evolution never mutates archived draft history;
- external schema failures fail clearly rather than guessing;
- valid signed official Form/Total Points values remain accepted;
- authenticated account identity resolves to the correct immutable roster manager ID;
- unknown/inconsistent identity fails closed rather than falling back to Jakin/Vuk;
- Commissioner authorization remains separate from roster identity;
- team profile data never becomes account/roster identity authority;
- account switching does not leak stale profile state;
- desktop/mobile consume the same underlying account/profile/data state;
- authorization-sensitive writes are backend/RLS enforced.

## Current deployment
Production:
`https://fpl-draft-assistant-eight.vercel.app/`

Production FPL endpoint:
`https://fpl-draft-assistant-eight.vercel.app/api/fpl`

The existing project-owned FPL boundary and Vercel packaging must remain intact unless an equivalent solution is proven.

## Hosted Supabase production
KNO project ref: `asrrkwyqerfkynhjypov`.

Applied hosted migrations:
- `20260822170000_foundation.sql`
- `20260822180000_league_accounts.sql`
- `20260823163233_team_profiles_avatars.sql`

Verified hosted state:
- six league accounts;
- six team profiles;
- one `LEAGUE_OWNER`, five `MEMBER`;
- private 2 MB JPEG/PNG/WebP avatar bucket;
- RLS active;
- anonymous protected access blocked;
- authenticated league profile/avatar reads allowed;
- owner-scoped avatar/profile writes;
- public signup disabled;
- six production Auth users provisioned outside source control;
- production authentication and A3 profile/avatar behavior work.

Browser-safe Vercel configuration:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

No Supabase service-role/secret credential belongs in browser/Vite variables.

## A-family verification
A1/A1.5/A2/A3 are COMPLETE and production-verified.

A2 verification includes login, persistent sessions, logout, account-specific My Team, correct MEMBER/Commissioner behavior, correct Miku007/Lovro and Jakin Goff/Vuk roster mappings, and live Players data.

A3 PR #35 verification reported:
- typecheck;
- 187 tests;
- build;
- lint;
- Supabase reset/lint;
- local database advisors;
- RLS/Storage verification;
- `git diff --check`.

A3 corrective PR #36 verification reported:
- typecheck;
- 188 tests;
- build;
- lint;
- Supabase reset/lint;
- A1/A2/A3 RLS and Storage verification;
- account-switch profile isolation and mobile-density regression coverage.

Post-merge production/manual verification is complete: profile/avatar loading and upload work, shared avatar display works, and the corrected mobile My Team/profile/current-roster layout works on the real phone.

## Current phase
- Foundation phases: COMPLETE.
- A family: COMPLETE.
- **G1 Real FPL Draft league/entry identity: CURRENT / NEXT.**

## G1 verification direction
G1 should prove identity and read contracts rather than build G2 presentation.

Verification should establish:
- one real Kile N Others FPL Draft league ID;
- exactly six real official entry IDs;
- explicit unique mapping to the six existing project identities/rosters;
- observed read-only league endpoint behavior and relevant schema evidence;
- failure on duplicate/missing/conflicting identity;
- no official FPL write/mutation behavior;
- no credentials/private browser tokens added to source control.

Codex should perform all public/read-contract verification it can. If the league URL/ID can only be obtained from Vuk's authenticated FPL Draft browser, isolate only that minimal manual action.

## CI philosophy
CI is a merge-confidence boundary, not a substitute for targeted local tests. Avoid broad workflows without a concrete failure mode.
