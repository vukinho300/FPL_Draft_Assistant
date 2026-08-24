# Testing and Deployment

## Testing philosophy
Use the smallest meaningful test surface during implementation, then run the full relevant merge-confidence checks before a meaningful PR is considered ready.

Codex performs every verification it can reliably perform itself. A check belongs to Vuk only when it genuinely requires private credentials, a real device/browser, unavailable authenticated external access, or subjective product judgment.

Never report an unperformed check as passed.

## Standard merge-confidence checks
Normally run:
- `npm run typecheck`
- `npm test`
- `npm run build`
- `npm run lint`
- `git diff --check`

Run the existing live FPL verifiers when their contracts are relevant. G1 adds `npm run verify:fpl-league-live` for league/entry identity.

Run Supabase/RLS/Storage verification when project-created persistent state or authorization changes.

## Regression priorities
Protect:
- immutable custom 90-pick draft history;
- stable six product account -> roster identities;
- G1 official league/entry mapping;
- no fuzzy/positional identity fallback;
- external schema failures fail clearly;
- valid signed official Form/Total Points remain accepted;
- profiles/avatars never become identity authority;
- account switching does not leak stale state;
- desktop/mobile consume one underlying live/domain state;
- official current ownership never rewrites custom draft history;
- no manual official-state database silently overrides verified official data;
- live/provisional and finalized values remain distinguishable;
- no secret/password/cookie/token enters source/browser public configuration.

## Current deployment
Production:
`https://fpl-draft-assistant-eight.vercel.app/`

Existing project FPL boundary:
`https://fpl-draft-assistant-eight.vercel.app/api/fpl`

New official league/event reads should remain behind project-owned service/adapter boundaries and use a Vercel/server boundary where appropriate for caching, normalization and stable frontend contracts.

## Hosted Supabase
KNO project ref: `asrrkwyqerfkynhjypov`.

Applied migrations:
- `20260822170000_foundation.sql`
- `20260822180000_league_accounts.sql`
- `20260823163233_team_profiles_avatars.sql`

A-family authentication/profile/avatar behavior is production-verified.

Supabase remains for project-created companion state. Do not add migrations merely to duplicate official lineups, standings, scores or current ownership.

## G1 verification
G1 verified official league `45938` and six entry/league-entry identities through project-owned league-details/draft-choice adapters plus exact immutable-roster identity proof.

The G1 live verifier must remain a regression check whenever official league identity contracts change.

## G2 verification direction — Official League State Contracts
G2 is primarily a read-contract/research/adapter phase. It should actually observe current 2026/27 official responses rather than assume community/historical shapes.

G2 should verify, where available:
- current Gameweek and timing/state;
- entry/event team response for all six verified entry IDs;
- exact starter/bench/order semantics;
- event-live player points and event/stat fields needed for later live scoring/events;
- fixtures/kickoff/finished state needed to know when play is active/finalized;
- element-status ownership/free-agent/locked semantics and owner identity join;
- official standings/event-total/season-total semantics and their lag/finalization behavior;
- transaction/waiver/trade read contracts only if this can be done narrowly without turning G2 into transaction implementation.

The purpose is to prove contracts for later G3+ work, not to build final UI in G2.

## Live-scoring test requirements for later G3
Before calling live standings correct, tests must cover:
- six official lineups joined to six verified entries;
- live player-point changes altering the correct team's provisional total;
- rank movement when totals cross;
- tied totals according to explicitly approved tie semantics;
- missing/duplicate player or entry mappings fail closed;
- finalized official results reconcile provisional values;
- stale/failed upstream data produces truthful freshness/error state rather than invented numbers.

Do not invent autosub/bonus/finalization rules. Verify them first in G2.

## Live refresh/freshness
The product goal is automatic active-GW updating. Before choosing polling frequency, Codex should inspect endpoint behavior, cache headers/rate considerations and existing Vercel architecture.

Requirements:
- active matches refresh automatically at a useful cadence;
- quiet/inactive periods back off substantially;
- UI exposes freshness such as `LIVE · updated … ago`;
- "immediate" means as soon as the official upstream feed reflects the event, not before.

## CI philosophy
CI is a merge-confidence boundary, not a substitute for targeted live-contract verification. Keep live external checks reproducible and separate from deterministic CI when upstream availability would make CI flaky.
