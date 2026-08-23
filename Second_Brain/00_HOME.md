# Kile N Others — Second Brain

## Purpose
This folder is the project control manual. The GitHub repository, committed code, migrations, database state, tests, and verified deployed state remain the technical source of truth. The Second Brain records approved architecture, product rules, current status, and the next narrow task so Codex does not repeatedly rediscover the project.

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
- A3 Team Profiles + Avatars: CURRENT / NEXT implementation phase.
- Current verified `main`: `db33831caf6f88c17e4c6420560b8b81dbb045b9`.
- Production application: `https://fpl-draft-assistant-eight.vercel.app/`.
- Production FPL boundary: `https://fpl-draft-assistant-eight.vercel.app/api/fpl`.
- Canonical historical draft: `src/data/leagues/kile-n-others/officialDraft2026-27.json`.
- Official-draft tag: `kile-n-others-official-draft-2026-27`.
- Live FPL boundary: project-owned `/api/fpl` adapter over public official FPL Draft data.
- Desktop and mobile use separate presentation trees over one shared controller/domain/data model.

## Hosted Supabase production state
Hosted project: **KNO** (`asrrkwyqerfkynhjypov`).

Applied repository migrations:
- `20260822170000_foundation.sql`
- `20260822180000_league_accounts.sql`

Verified hosted state:
- `league_accounts` contains six rows;
- exactly one `LEAGUE_OWNER` and five `MEMBER` rows;
- Jakin Goff -> Vuk -> `LEAGUE_OWNER` / Commissioner;
- RLS enabled;
- anonymous account access blocked;
- intended authenticated account reads allowed;
- public signup disabled while email/password authentication remains enabled;
- six production Supabase Auth users provisioned with private passwords held by Vuk;
- Vercel production has browser-safe `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`;
- no Supabase secret/service-role credential is exposed to the frontend;
- production has been redeployed against hosted Supabase and authentication works.

## Account/session state
A2 is complete and verified in production:
- visible login uses team name + password;
- Supabase-managed sessions persist and restore across normal refresh/reopen while valid;
- logout clears authenticated state;
- project code does not store passwords;
- each authenticated account resolves to the correct immutable roster manager ID;
- My Team is account-specific;
- Jakin Goff alone receives Commissioner presentation from real account role;
- MEMBER accounts retain normal member presentation;
- roster identity and Commissioner authorization are separate concerns.

PR #33 (`fix: isolate account rosters and live players`) fixed:
- stable account -> immutable roster-manager-ID resolution;
- fail-closed behavior for unknown/inconsistent identities instead of falling back to Jakin/Vuk;
- Miku007 / Lovro -> Miku roster correction;
- stale previous-account dashboard state during account switching;
- separation of Commissioner role from roster identity;
- acceptance of valid signed official Form and Total Points values;
- restoration of live Players data.

Manual post-merge verification confirmed account-specific My Team, the corrected Miku007 roster, the correct Jakin Goff/Vuk roster, and live Players data.

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
        |       - league accounts / profiles
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
- Team profiles/avatars: `00_HOME`, `03_Current_Architecture`, `05_Authentication_Security`, `12_Roadmap`, `15_Current_Phase`.
- League/Gameweek: `00_HOME`, `07_League_Rules_Product_Behavior`, `15_Current_Phase`.
- Roadmap/planning: `00_HOME`, `12_Roadmap`, `14_Project_Status`, `15_Current_Phase`.

Do not inspect unrelated folders unless a relevant Second Brain note or failing test requires it.

## Development workflow
1. ChatGPT inspects current `main` and relevant Second Brain notes, then defines product goal, non-negotiable architecture/data/security rules, scope boundaries, roadmap ordering, and acceptance criteria.
2. Codex inspects the repository and owns implementation strategy, exact files/components/SQL/CSS/refactors, debugging, and test execution.
3. Prompts are outcome-oriented and avoid micromanaging implementation details Codex can determine better from repository context.
4. Reuse known working Codex session/tool access; do not repeat setup/authentication unless access is actually missing or expired.
5. Codex performs every verification it can reliably perform itself.
6. Checks that genuinely require Vuk go in a concise **Manual verification for Vuk** section with only exact action, expected result, and failure signal; one manual-only check must not block unrelated work.
7. Use a fresh short-lived implementation branch for code or docs branch for Second Brain work; open a Draft PR; never merge.
8. ChatGPT independently reviews the actual PR/diff/CI.
9. Vuk alone merges implementation and documentation PRs.

Never use permanent Codex/ChatGPT branches. Never use worktrees without a real Git reason. Never document planned functionality as implemented reality.

## Next phase
See `15_Current_Phase.md`: **A3 — Team Profiles + Avatars**.

Do not skip to G1 unless A3 is completed or Vuk explicitly changes the roadmap.