# Current Architecture

## Implemented baseline
Current `main` is the Kile N Others league dashboard introduced by merged PR #7.

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
React UI
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

## Current UI limitation
The current dashboard was designed desktop-first. Responsive/mobile work is a separate narrow phase. Preserve the existing visual language while adapting navigation, pitch cards, grids and tables to smaller screens.

## Architecture constraints
- No external API shape directly in React.
- No business-critical permission enforced only by hiding UI.
- No duplicate roster truth.
- No mutable official-draft history.
- No automatic official FPL transaction submission until explicitly designed.
- Create new source areas only when the current narrow phase needs them.