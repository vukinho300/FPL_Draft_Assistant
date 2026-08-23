# Current Architecture

## Implemented baseline
Current verified `main` is `db33831caf6f88c17e4c6420560b8b81dbb045b9` after merged PR #33.

The deployed Kile N Others application now includes the completed responsive desktop/mobile shell, live Players data through the project-owned FPL boundary, Supabase foundation, six league accounts with RLS, persistent Supabase Auth sessions, and the completed account-aware application shell.

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

Authenticated application flow:
```text
Browser
  ↓
project-owned Supabase Auth session service
  ↓
Supabase Auth session
  ↓
RLS-protected league_accounts row
  ↓
stable approved account -> immutable roster manager ID
  ↓
shared dashboard/controller model
```

Raw external response shapes must stop at the adapter boundary. Backend/RLS remains authoritative for permissions.

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

## Current persistence and backend
Supabase is now the approved and active persistent backend foundation.

Hosted project:
- name: KNO
- project ref: `asrrkwyqerfkynhjypov`

Applied hosted migrations:
- `20260822170000_foundation.sql`
- `20260822180000_league_accounts.sql`

Current persistent backend state includes:
- six `league_accounts` identities;
- one `LEAGUE_OWNER` and five `MEMBER` roles;
- RLS-protected account reads;
- Supabase Auth user bindings provisioned outside committed migrations;
- Supabase-managed persistent browser sessions.

Persistent mutable league features added in later phases must use Supabase/Postgres/Storage/RLS rather than device-local storage as authoritative truth.

The legacy Draft Room may continue to use its existing versioned localStorage for draft-night session behavior; that is not the source of truth for season-long shared mutable league state.

## Account-aware shell
A2 is COMPLETE and production-verified.

The application now:
- initializes/restores Supabase Auth before deciding login vs authenticated UI;
- presents team-name + password login while keeping internal Auth email identities hidden;
- resolves the authenticated Auth user to one RLS-protected league account;
- resolves that approved account identity to one immutable official-draft roster manager ID;
- makes My Team account-specific on mobile and desktop;
- displays Commissioner only for Jakin Goff from real account role;
- exposes logout;
- keeps password storage outside project code.

PR #33 hardened roster/account identity:
- approved account identity maps to immutable manager ID rather than display-name guessing;
- unknown/inconsistent identities fail closed;
- Miku007 / Lovro maps to Miku's roster;
- switching accounts clears stale dashboard state while the new identity resolves;
- Commissioner authorization does not determine roster identity.

## Desktop/mobile presentation architecture
F2 is COMPLETE.

The application has one shared dashboard/controller model and dedicated desktop/mobile presentation trees. Mobile and desktop are two presentations of the same authenticated account, roster, data, and future persistent league entities.

## Players directory architecture
The Players page consumes normalized player data from the project FPL boundary and ownership derived from the immutable official draft plus PROCESSED project transactions.

Current sort priorities:
- Official FPL Draft Rank;
- Form;
- Total Points;
- MVP Consensus.

PR #33 corrected the live-player adapter to accept valid signed official Form and Total Points values. Signed values are valid official data and must not cause the whole player payload to fail validation merely for being negative.

## Current phase boundary
- F0 Second Brain foundation: COMPLETE.
- F1 Vercel deployment: COMPLETE.
- F2 desktop + mobile responsive shell: COMPLETE.
- P5A Players filtering/sorting + live Form/Total Points: COMPLETE.
- F3 Supabase foundation: COMPLETE.
- A1 Six Accounts + RLS: COMPLETE.
- A1.5 persistent session foundation: COMPLETE.
- A2 account-aware shell: COMPLETE.
- A3 Team Profiles + Avatars: CURRENT / NEXT.

A3 may add only the profile/avatar persistence needed by its approved scope. It must not pull G1 real FPL Draft league/entry identity forward.

## Architecture constraints
- No external API shape directly in React.
- No business-critical permission enforced only by hiding UI.
- No duplicate roster truth.
- No duplicate desktop/mobile business logic.
- No mutable official-draft history.
- Persistent mutable league state uses shared backend contracts, not authoritative localStorage.
- Account roster identity must fail closed rather than fall back to another manager.
- Commissioner authorization and roster identity remain separate concerns.
- No automatic official FPL transaction submission until explicitly designed.
- Create new source areas only when the current narrow phase needs them.