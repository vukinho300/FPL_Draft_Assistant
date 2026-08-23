# Testing and Deployment

## Testing philosophy
Use the smallest meaningful test surface during implementation, then run the full relevant merge-confidence checks before a meaningful PR is considered ready.

Codex should perform every verification it can reliably perform itself. A check belongs to Vuk only when it genuinely requires private credentials, a real device/browser, unavailable external authenticated access, or subjective product judgment.

A manual-only check must not automatically block unrelated technical work.

## PR/merge checkpoint
Before merge of a meaningful implementation PR, normally run:
- `npm run typecheck`
- `npm test`
- `npm run build`
- `npm run lint`
- `git diff --check`

Run `npm run verify:fpl-live` when the live FPL boundary or current-player/ranking join is relevant.

Run Supabase/RLS verification when database/auth/storage policy behavior changes.

Never report a test/browser/deployment check as passed unless it was actually performed.

## Regression priorities
Protect these invariants:
- immutable 90-pick official draft remains valid;
- current roster evolution never mutates archived draft history;
- unique player ownership and legal roster composition remain intact;
- external schema failures fail clearly rather than silently guessing;
- valid signed official Form/Total Points values are accepted;
- authenticated account identity resolves to the correct immutable roster manager ID;
- unknown/inconsistent account identity fails closed rather than falling back to Jakin/Vuk;
- Commissioner authorization remains separate from roster identity;
- desktop and mobile render the same underlying league/account/data state;
- authorization-sensitive writes are backend/RLS enforced.

## Current deployment
F1 — Vercel Deployment is COMPLETE.

Production:
`https://fpl-draft-assistant-eight.vercel.app/`

Production FPL endpoint:
`https://fpl-draft-assistant-eight.vercel.app/api/fpl`

The deployed FPL boundary remains:

```text
Browser -> GET /api/fpl -> project FPL handler -> project FPL service -> public FPL Draft bootstrap
```

Vercel packaging for `api/fpl.ts` must continue to include `src/services/fpl/**` or an equivalent proven solution.

## Hosted Supabase production deployment
Hosted Supabase project:
- name: KNO
- project ref: `asrrkwyqerfkynhjypov`

Applied hosted repository migrations:
- `20260822170000_foundation.sql`
- `20260822180000_league_accounts.sql`

Verified hosted state:
- six league account rows;
- one `LEAGUE_OWNER`, five `MEMBER`;
- RLS active;
- anonymous account reads blocked;
- intended authenticated account reads allowed;
- public signup disabled;
- six production Auth accounts provisioned outside source control;
- production authentication works.

Production Vercel browser configuration:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

No Supabase secret/service-role key belongs in browser/Vite environment variables.

## A2 production verification
A2 — Account-aware Shell is COMPLETE and verified in production.

Verified behavior includes:
- team-name + password login;
- persistent Supabase-managed session restoration;
- explicit logout;
- account-specific My Team;
- Jakin Goff Commissioner presentation;
- normal MEMBER presentation for other accounts;
- correct Miku007 / Lovro roster mapping;
- correct Jakin Goff / Vuk roster mapping;
- live Players directory after PR #33.

PR #33 verification reported:
- `npm run typecheck`
- `npm test`
- `npm run build`
- `npm run lint`
- `npm run verify:fpl-live`

Manual post-merge production checks confirmed the account/roster and live-player behavior above.

## Current deployment sequence
- F0 Second Brain foundation: COMPLETE.
- F1 Vercel deployment: COMPLETE.
- F2 desktop/mobile responsive shell: COMPLETE.
- P5A Players filtering/sorting + live Form/Total Points: COMPLETE.
- F3 Supabase foundation: COMPLETE.
- A1 Six Accounts + RLS: COMPLETE.
- A1.5 persistent session foundation: COMPLETE.
- A2 account-aware shell: COMPLETE.
- A3 Team Profiles + Avatars: CURRENT / NEXT.

Do not skip to G1 while A3 is current unless Vuk explicitly changes the roadmap.

## Desktop and mobile verification
Desktop and mobile are both required targets of the same deployed application.

User-facing changes should verify representative desktop and narrow mobile layouts when the affected UI is shared across both. Mobile must remain normal-phone usable without required zoom and without unintended page-level horizontal overflow.

## A3 verification direction
A3 should prove, at minimum, the profile/avatar persistence and authorization contract it introduces, plus Teams page consumption on both desktop and mobile where affected.

Codex should choose the exact technical test strategy after inspecting the repository.

If a production avatar upload/login flow genuinely requires Vuk's private credentials or browser interaction, the final report should isolate only that check under:

**Manual verification for Vuk**
- exact action;
- expected result;
- failure signal.

## CI philosophy
CI is a merge-confidence boundary, not a substitute for targeted local tests. Avoid adding expensive broad workflows without a concrete failure mode.