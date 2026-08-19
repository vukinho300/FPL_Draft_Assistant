# Kile N Others — Second Brain

## Purpose
This folder is the project control manual. The GitHub repository, committed code, migrations, database state, tests, and verified external contracts remain the technical source of truth. The Second Brain records approved architecture, product rules, current status, and the next narrow task so Codex does not repeatedly rediscover the project.

## Current product
Kile N Others is a private six-team FPL Draft league companion for the 2026/27 season. It evolved from the original FPL Draft Assistant and must preserve the useful Draft Room, rankings, model evidence, scarcity, Turn Horizon, Best Fit, Best Pair, immutable official draft, current roster derivation, Teams/Players/Transactions foundations, and Draft Archive.

## Current technical baseline
- Frontend: React + Vite + TypeScript.
- Tests: Vitest. Static analysis: Oxlint.
- Runtime: Node 24.
- Current state: PR #7 merged into `main`; Kile N Others dashboard is the baseline.
- Canonical historical draft: `src/data/leagues/kile-n-others/officialDraft2026-27.json`.
- Official-draft tag: `kile-n-others-official-draft-2026-27`.
- Live FPL boundary: project-owned `/api/fpl` adapter over the public FPL Draft bootstrap.
- No database, accounts, cross-device persistence, verified league IDs, real Matchday adapter, or production deployment yet.

## Approved target architecture
```text
React/Vite UI on Vercel
        |
        +--> Supabase Auth/Postgres/Storage/RLS
        |       - accounts
        |       - profiles
        |       - lineups
        |       - scores/corrections
        |       - trading block
        |       - trade proposals/history
        |       - sync metadata
        |
        +--> Vercel Functions /api/fpl/*
                - official/public FPL Draft data
                - official FPL data
                - verified Premier League data

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

- Deployment task: `00_HOME`, `09_Testing_Deployment`, `15_Current_Phase`.
- Mobile/UI task: `00_HOME`, `03_Current_Architecture`, `09_Testing_Deployment`, `15_Current_Phase`.
- Data/API task: `00_HOME`, `04_Data_Architecture_Sources`, `15_Current_Phase`.
- Auth/RLS/profile task: `00_HOME`, `05_Authentication_Security`, `15_Current_Phase`.
- League behavior/gameweek task: `00_HOME`, `07_League_Rules_Product_Behavior`, `15_Current_Phase`.
- Trading task: `00_HOME`, `07_League_Rules_Product_Behavior`, `15_Current_Phase`.
- Roadmap/planning task: `00_HOME`, `12_Roadmap`, `14_Project_Status`, `15_Current_Phase`.

Do not inspect unrelated folders unless a relevant Second Brain note or failing test requires it.

## Development workflow
1. Plan/approve architecture outside Codex when needed.
2. Update/read the relevant Second Brain notes.
3. Give Codex one narrow implementation task.
4. Run targeted tests directly related to that task.
5. Independently verify the repository/PR.
6. Manually update the Second Brain with exact confirmed changes.
7. Move to the next narrow task.

Optimize for correctness, low token/credit usage, and small verifiable changes.

## Codex task shape
Every implementation prompt should contain:
- GOAL
- FILES LIKELY TO CHANGE
- DO NOT CHANGE
- ACCEPTANCE CRITERIA
- TARGETED TESTS
- GIT INSTRUCTIONS
- SHORT FINAL RESPONSE FORMAT

Avoid broad repository rediscovery, repeated architecture explanations, unrelated refactors, and full-suite testing for small changes.

## Model usage
- Luna: trivial/mechanical edits, small CSS, simple tests, rename/copy/filter changes.
- Terra: normal React/TypeScript work, Supabase integration, migrations, API adapters, non-trivial bugs.
- Sol: architecture, security/RLS review, data-source investigation, major PR verification.

Default to the cheapest model that can reliably execute the already-approved decision.

## Next phase
See `15_Current_Phase.md`.