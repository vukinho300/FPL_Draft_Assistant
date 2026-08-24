# Kile N Others — Second Brain

## Purpose
This folder is the project control manual. The GitHub repository, committed code, migrations, database state, tests, and verified deployed state remain the technical source of truth. The Second Brain records approved architecture, product rules, current status, and the current roadmap family so Codex does not repeatedly rediscover the project.

## Current product
Kile N Others is a private six-team FPL Draft league companion for the 2026/27 season. It preserves the useful Draft Room, rankings/model evidence, immutable official draft, current roster derivation, Players/Teams/Transactions foundations and Draft Archive while evolving into a persistent season-long league app.

## Current technical baseline
- Frontend: React + Vite + TypeScript.
- Tests: Vitest. Static analysis: Oxlint.
- Runtime: Node 24.
- F0 Second Brain: COMPLETE.
- F1 Vercel deployment: COMPLETE.
- F2 desktop/mobile responsive shell: COMPLETE.
- P5A Players filtering/sorting + live Form/Total Points: COMPLETE.
- F3 Supabase Foundation: COMPLETE.
- A1 Six Accounts + RLS: COMPLETE.
- A1.5 Persistent Session / Automatic Login: COMPLETE.
- A2 Account-aware Shell: COMPLETE and production-verified.
- A3 Team Profiles + Avatars: COMPLETE and production-verified.
- **A family: COMPLETE.**
- **G1 Real FPL Draft league/entry identity: CURRENT / NEXT.**
- Current verified `main`: `a62d027d310efa08dbdd22dc53bf17818a863fec`.
- Production application: `https://fpl-draft-assistant-eight.vercel.app/`.
- Production FPL boundary: `https://fpl-draft-assistant-eight.vercel.app/api/fpl`.
- Canonical historical draft: `src/data/leagues/kile-n-others/officialDraft2026-27.json`.
- Official-draft tag: `kile-n-others-official-draft-2026-27`.
- Live FPL boundary: project-owned `/api/fpl` adapter over public official FPL Draft data.
- Desktop and mobile use separate presentation trees over shared controller/domain/data/profile state.

## Hosted Supabase production state
Hosted project: **KNO** (`asrrkwyqerfkynhjypov`).

Applied repository migrations:
- `20260822170000_foundation.sql`
- `20260822180000_league_accounts.sql`
- `20260823163233_team_profiles_avatars.sql`

Verified hosted state:
- `league_accounts` contains six rows;
- exactly one `LEAGUE_OWNER` and five `MEMBER` rows;
- Jakin Goff -> Vuk -> `LEAGUE_OWNER` / Commissioner;
- six `team_profiles` rows exist, one per authoritative league account;
- private `team-avatars` Storage bucket exists with a 2 MB JPEG/PNG/WebP contract;
- authenticated league members can read league-visible profile/avatar data;
- profile/avatar writes are owner-scoped through backend RLS/Storage policies;
- Commissioner status does not grant blanket cross-team avatar editing;
- RLS is active and anonymous protected data access is blocked;
- public signup is disabled while email/password authentication remains enabled;
- six production Supabase Auth users are provisioned with private passwords held by Vuk;
- Vercel production has browser-safe `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`;
- no Supabase secret/service-role credential is exposed to the frontend;
- production authentication, profile loading, avatar upload/persistence and shared Teams display are working.

## A-family outcome
The account/profile foundation is complete.

A1/A1.5/A2/A3 now provide:
- six persistent authenticated product identities;
- real MEMBER / LEAGUE_OWNER authorization foundation;
- Supabase-managed persistent sessions and logout;
- team-name + password login without project password storage;
- stable approved account -> immutable roster manager ID resolution;
- fail-closed behavior for unknown/inconsistent roster identity;
- account-specific My Team;
- Jakin Goff as the only Commissioner;
- one persistent team profile per account;
- private owner-managed team avatars with deterministic initial fallback;
- shared profile state across desktop/mobile and My Team/Teams;
- authenticated-team avatar/initial in My Team navigation;
- compact phone profile/current-roster presentation that remains truthful about not yet being a submitted Gameweek XI.

PR #33 remains part of the baseline:
- Miku007 / Lovro -> Miku roster correction;
- no fallback to Jakin/Vuk;
- stale previous-account dashboard prevention;
- Commissioner authorization separated from roster identity;
- valid signed official Form / Total Points values accepted;
- live Players data restored.

A3 was delivered through:
- PR #35 `feat: add team profiles and avatars`;
- PR #36 `fix: compact mobile team profile`.

## League authority
- Jakin Goff is the backend `LEAGUE_OWNER` account.
- Product-facing title: **Commissioner**.
- Authorization continues to rely on backend role/RLS, not the display label.
- Future Gameweek lineup permission/lock rules remain as defined in `07_League_Rules_Product_Behavior.md` and later G3 work.

## Approved target architecture
```text
React/Vite UI on Vercel
        |
        +--> Supabase Auth/Postgres/Storage/RLS
        |       - league accounts / team profiles / avatars
        |       - persistent sessions handled by Supabase Auth
        |       - future lineups + audit metadata
        |       - future scores/corrections
        |       - future trading block / trades
        |
        +--> Vercel Functions /api/fpl/*
                - verified official/public FPL data

Existing pure domain layer remains authoritative for project rules.
```

## Immutable rule
Never rewrite the official 2026/27 draft to reflect later league activity.

```text
immutable official draft
        +
processed post-draft transactions
        =
current league rosters
```

## Codex read map
Read only what the task needs.
- Deployment: `00_HOME`, `09_Testing_Deployment`, `15_Current_Phase`.
- Mobile/UI: `00_HOME`, `03_Current_Architecture`, `09_Testing_Deployment`, `15_Current_Phase`.
- Data/API: `00_HOME`, `04_Data_Architecture_Sources`, `15_Current_Phase`.
- Supabase/Auth/RLS: `00_HOME`, `05_Authentication_Security`, `12_Roadmap`, `15_Current_Phase`.
- League/Gameweek identity: `00_HOME`, `04_Data_Architecture_Sources`, `07_League_Rules_Product_Behavior`, `12_Roadmap`, `15_Current_Phase`.
- Roadmap/planning: `00_HOME`, `12_Roadmap`, `14_Project_Status`, `15_Current_Phase`.
- Workflow/session: `00_HOME`, `11_Decision_Log`, `16_Codex_Session_Workflow`.

Do not inspect unrelated folders unless a relevant Second Brain note or failing test requires it.

## Development workflow
1. ChatGPT inspects current `main` and relevant Second Brain notes, then defines product goal, non-negotiable architecture/data/security rules, scope boundaries, roadmap ordering, and acceptance criteria.
2. Codex inspects the repository and owns implementation strategy, exact files/components/SQL/CSS/refactors, debugging, and test execution.
3. Prompts are outcome-oriented and avoid micromanaging implementation details Codex can determine better from repository context.
4. Reuse known working Codex session/tool access; do not repeat setup/authentication unless access is actually missing or expired.
5. Codex performs every verification it can reliably perform itself.
6. Checks that genuinely require Vuk go in a concise **Manual verification for Vuk** section with only exact action, expected result, and failure signal; one manual-only check must not block unrelated work.
7. Use a fresh short-lived implementation branch for each roadmap step; open a Draft PR; never merge.
8. Prefer one coherent implementation commit per narrow step and avoid unnecessary checkpoint/progress commits. Review-fix commits are acceptable when useful; Vuk may squash when merging to keep `main` history compact.
9. ChatGPT independently reviews the actual PR/diff/CI.
10. Vuk alone merges implementation and documentation PRs.
11. **Second Brain reconciliation happens at the end of a roadmap letter family, not after every individual numbered step.** A is reconciled after A1/A1.5/A2/A3; G will be reconciled after the approved G steps are complete. An earlier docs correction is allowed only when the control manual becomes materially unsafe or misleading.

Never use permanent Codex/ChatGPT branches. Never use worktrees without a real Git reason. Never document planned functionality as implemented reality.

## Next phase
See `15_Current_Phase.md`: **G1 — Real FPL Draft league/entry identity**.

G1 establishes the verified identity contract for the real Kile N Others FPL Draft league and its six official entries before G2 consumes that identity for real Gameweek/standings data.
