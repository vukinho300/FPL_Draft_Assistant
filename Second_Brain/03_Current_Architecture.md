# Current Architecture

## Implemented baseline
Current `main` is the Kile N Others league dashboard introduced by merged PR #7, deployed to Vercel during completed phase F1, and now completed through F2 desktop/mobile presentation work.

The production application uses the project-owned `/api/fpl` Vercel Function boundary. PR #10 added `vercel.json` so the deployed `api/fpl.ts` function explicitly includes `src/services/fpl/**`; this fixed the production `ERR_MODULE_NOT_FOUND` packaging failure.

Frontend stack:
- React 19
- Vite
- TypeScript
- Node 24
- Vitest
- Oxlint

Current dashboard views:
- League
- My Team
- Teams
- Matchday
- Players
- Transactions
- Draft Archive

## Core dependency flow
```text
External FPL data
      ↓
project-owned adapter
      ↓
normalized internal models
      ↓
pure domain logic
      ↓
shared dashboard/controller model
      ↓
Desktop presentation / Mobile presentation
```

Raw external response shapes must stop at the adapter boundary.

## Existing domain responsibilities
- `league.ts`: roster contract and position requirements.
- `manager.ts`: manager identity/configuration.
- `draftSchedule.ts`: snake schedule and Turn Horizon.
- `draftRanking.ts`: official/model consensus ranking.
- `draftState.ts`: sequential pick history, availability, rosters.
- `bestFit.ts`: deterministic individual recommendation logic.
- `bestPair.ts`: consecutive-turn pair evaluation.
- `officialDraft.ts`: immutable official-draft validation/freeze/restore utility.
- `transactions.ts`: project-owned trades/waivers/free agents, ownership, roster evolution, activity.

Keep React thin: it should render domain/service results rather than reimplement rules.

## Historical truth
Canonical official draft:
`src/data/leagues/kile-n-others/officialDraft2026-27.json`

The official draft is immutable historical truth.

```text
official draft final rosters
      +
PROCESSED project transactions
      ↓
current league rosters
```

Post-draft state must never edit the historical snapshot.

## Legacy Draft Room
The original Draft Room code is retained in the repository. Preserve:
- Official Draft rank.
- Historical model evidence.
- MVP ranking.
- Scarcity/depth concepts.
- Turn Horizon.
- Best Available.
- Best Fit.
- Best Pair.

It is legacy draft-night functionality, not the runtime source of truth for current season rosters.

## Current persistence
The old Draft Room has versioned browser `localStorage` for manual draft-night sessions.

The completed 2026/27 draft was backed up externally and converted into the canonical immutable repository snapshot.

The season dashboard currently has:
- no remote database;
- no account state;
- no cross-device sync;
- no persistent post-draft transaction storage.

## Desktop/mobile presentation architecture
F2 is COMPLETE.

The application now has:
- one shared dashboard/controller model owning view state, roster derivation, manager selection, transaction filters, player-directory state and archive data;
- one dedicated desktop presentation tree;
- one dedicated mobile presentation tree;
- viewport-based presentation selection with only one presentation mounted at a time;
- shared navigation truth for all seven views;
- floating mobile navigation with primary order `League / My Team / Teams / More`;
- intentional mobile League, My Team, Teams, Matchday, Players, Transactions and Draft Archive views;
- no global desktop-only minimum width forcing mobile overflow.

Desktop and mobile are presentation layers of one product, not separate applications. Future persistent mutable data must come from the same backend/database contracts on both form factors.

## Players directory architecture
The Players page currently consumes normalized player data from the project FPL boundary and ownership derived from the immutable official draft plus PROCESSED project transactions.

P5A may extend only the shared directory filtering/sorting layer and its desktop/mobile presentation controls. It must not duplicate player lists per presentation.

Free Agent / Owned state must be derived from current ownership, not hardcoded.

Rank sorting may use only currently available trusted ranking fields:
- Official Draft rank;
- Draft MVP rank;
- model rank/evidence where the normalized/current player-directory model exposes it reliably.

Unknown/missing rank values must remain explicit and sort deterministically rather than being invented.

## Approved target evolution
Add infrastructure incrementally:

```text
React/Vite UI on Vercel
        |
        +--> Supabase Auth/Postgres/Storage/RLS
        |
        +--> Vercel Functions /api/fpl/*
                  ↓
            verified official/public football sources
```

Do not rewrite the frontend framework or domain architecture to achieve this.

## Current phase boundary
- F0 Second Brain foundation: COMPLETE.
- F1 Vercel deployment: COMPLETE.
- F2 desktop + mobile responsive shell: COMPLETE.
- P5A basic Players filtering/sorting: CURRENT narrow product step.
- F3 Supabase foundation follows P5A.

P5A is intentionally small and uses data already present in the current application. It must not pull forward P3/P4 enriched stats/status work or F3 database work.

## Architecture constraints
- No external API shape directly in React.
- No business-critical permission enforced only by hiding UI.
- No duplicate roster truth.
- No duplicate desktop/mobile business logic.
- No mutable official-draft history.
- No automatic official FPL transaction submission until explicitly designed.
- Create new source areas only when the current narrow phase needs them.