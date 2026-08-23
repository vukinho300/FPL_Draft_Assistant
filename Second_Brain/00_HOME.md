# Kile N Others — Second Brain

## Purpose
This folder is the project control manual. The GitHub repository, committed code, migrations, database state, tests, and verified external contracts remain the technical source of truth. The Second Brain records approved architecture, product rules, current status, and the next narrow task so Codex does not repeatedly rediscover the project.

## Current product
Kile N Others is a private six-team FPL Draft league companion for the 2026/27 season. It evolved from the original FPL Draft Assistant and preserves the useful Draft Room, rankings/model evidence, immutable official draft, current roster derivation, Players/Teams/Transactions foundations and Draft Archive while moving toward a persistent season-long league app.

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
- A1.5 Persistent Session / Automatic Login foundation: COMPLETE.
- A2 Account-aware Shell: CURRENT.
- Current verified `main` baseline after PR #28: `524b794d56fde92ffe7d9a4d88093ed03a3a4eeb`.
- Production application: `https://fpl-draft-assistant-eight.vercel.app/`.
- Production FPL boundary: `https://fpl-draft-assistant-eight.vercel.app/api/fpl`.
- Canonical historical draft: `src/data/leagues/kile-n-others/officialDraft2026-27.json`.
- Official-draft tag: `kile-n-others-official-draft-2026-27`.
- Live FPL boundary: project-owned `/api/fpl` adapter over public official FPL Draft data.
- Desktop and mobile use separate presentation trees over one shared controller/domain/data model.
- Supabase client/config/migration foundation exists; six league identities and MEMBER/LEAGUE_OWNER RLS foundation exist; browser session persistence/refresh lifecycle exists; A2 now connects that identity/session layer to the product shell.

## League authority
- Jakin Goff is the backend `LEAGUE_OWNER` account.
- Product-facing title: **Commissioner**.
- Authorization continues to rely on backend role/RLS, not the display label.
- Members may create/edit/submit only their own lineup before the verified Gameweek start/deadline.
- After kickoff, normal member lineup writes lock; only the Commissioner may insert/edit/replace a lineup for itself or another manager.
- Commissioner post-start lineup writes must be backend-enforced and auditable when G3 lineup persistence is implemented.

## Authentication/session rule
- Visible login UX is team name + password.
- Internal Supabase Auth email identifiers are an implementation detail and should not be exposed to users.
- Passwords are never stored by project code.
- Browser authentication uses Supabase-managed persistent sessions and refresh tokens.
- After a successful login on a browser/device, refresh or later reopening should restore the valid session automatically without re-entering the password.
- Auth startup must distinguish `INITIALIZING`, `AUTHENTICATED`, and `UNAUTHENTICATED` so the product does not briefly treat a restorable session as logged out.
- Explicit logout clears the persistent authenticated session.
- Session persistence proves authentication only; roles/Commissioner authorization remain database/RLS controlled.

## Approved target architecture
```text
React/Vite UI on Vercel
        |
        +--> Supabase Auth/Postgres/Storage/RLS
        |       - league accounts / profiles
        |       - persistent sessions handled by Supabase Auth
        |       - lineups + audit metadata
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

- Deployment: `00_HOME`, `09_Testing_Deployment`, `15_Current_Phase`.
- Mobile/UI: `00_HOME`, `03_Current_Architecture`, `09_Testing_Deployment`, `15_Current_Phase`.
- Data/API: `00_HOME`, `04_Data_Architecture_Sources`, `15_Current_Phase`.
- Supabase/Auth/RLS: `00_HOME`, `05_Authentication_Security`, `12_Roadmap`, `15_Current_Phase`.
- Account-aware shell: `00_HOME`, `03_Current_Architecture`, `05_Authentication_Security`, `12_Roadmap`, `15_Current_Phase`.
- League/Gameweek: `00_HOME`, `07_League_Rules_Product_Behavior`, `15_Current_Phase`.
- Players: `00_HOME`, `03_Current_Architecture`, `07_League_Rules_Product_Behavior`, `12_Roadmap`, `15_Current_Phase`.
- Roadmap/planning: `00_HOME`, `12_Roadmap`, `14_Project_Status`, `15_Current_Phase`.

Do not inspect unrelated folders unless a relevant Second Brain note or failing test requires it.

## Development workflow
1. ChatGPT inspects current `main` and relevant Second Brain notes, then defines the product goal, non-negotiable architecture/data/security rules, scope boundaries, and acceptance criteria.
2. Codex inspects the repository and owns the implementation plan. It should choose the exact files, component structure, SQL/RLS shape, refactors, CSS approach, test seams, and command sequence that best fit the actual codebase.
3. ChatGPT prompts should be direct about outcomes and invariants but should not micromanage implementation details that Codex can reason about better from repository context.
4. Prescriptive implementation instructions are reserved for true invariants: security boundaries, immutable history, source-of-truth rules, migration safety, and explicit previously approved architecture decisions.
5. Codex may choose a different implementation approach than a suggestion when repository evidence supports a safer, simpler, faster, or more maintainable solution; it should explain material deviations in its final report.
6. Codex uses a fresh short-lived branch from current `main` and does not edit `Second_Brain/` during normal implementation tasks.
7. Codex performs every verification it can reliably perform itself: relevant tests, typecheck, lint, build, local integration checks, database/RLS checks, and repository inspection.
8. Codex must not report a check as passed unless it actually ran it. If a check genuinely requires Vuk, a real device/browser, unavailable credentials, or subjective visual judgment, the final report includes a concise **Manual verification for Vuk** section with the exact minimal steps and expected result. If no manual verification is needed, say so.
9. Codex stages explicit files, pushes, and opens a Draft PR; Codex never merges.
10. ChatGPT independently reviews the actual PR/diff/CI and returns PASS/FIX/FAIL.
11. Vuk alone merges implementation PRs.
12. After merged/verified implementation, ChatGPT updates Second Brain only when approved, on a short-lived docs branch and Draft PR; Vuk reviews and merges docs PRs.

Never use permanent Codex/ChatGPT branches. Never use a docs branch for implementation code. Never document planned functionality as implemented reality.

## Prompting rule
A good Codex prompt should primarily answer four things:
- What outcome does Vuk want?
- What project/product/security constraints cannot change?
- What is in scope and out of scope?
- What evidence is required before the task can be considered complete?

The prompt should normally leave execution details to Codex after it inspects the repository. Avoid long step-by-step implementation recipes unless the step itself is an invariant or Codex has already shown it needs a specific correction.

## Model usage
- Luna: trivial/mechanical work.
- Terra: normal React/TypeScript/Supabase implementation.
- Sol: architecture, security/RLS review, data-source investigation, major verification.

## Next phase
See `15_Current_Phase.md`: A2 — Account-aware Shell.