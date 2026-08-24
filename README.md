# Kile N Others

**FPL Draft League Dashboard · 2026/27**

Kile N Others is the permanent season dashboard for the six-manager league: Vuk, Diego, Kristian, Miku, Tin, and Deni. Its canonical base state is the immutable 90-pick official draft snapshot for 2026/27. The dashboard presents league squads, ownership, a transaction tracker, Matchday placeholders, and the complete Draft Archive without controlling or replacing the official Fantasy Premier League Draft service.

The original Draft Room remains in the repository as legacy draft-night code. It is no longer the source of truth for current league rosters.

## Prerequisites

- Node.js 24, recorded in `.nvmrc`
- npm 11 or a compatible npm version
- Python 3.13 only when reproducing the research-side ranking artifact

## Install and run

```bash
npm ci
npm run dev
```

The Vite development server exposes the same project-owned `/api/fpl` boundary used by production, backed by the existing FPL adapter. The production Vercel Function remains `api/fpl.ts`.

## Supabase foundation

Supabase is the shared Auth/Postgres/Storage backend foundation. The current dashboard still runs without Supabase environment variables; account-aware UI belongs to a later phase. React code must obtain any browser client through `src/services/supabase`, never construct independent clients.

Copy `.env.example` to `.env.local` when a Supabase-backed feature is being developed, then provide the project URL and current browser-safe publishable key:

```text
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your-project-key
```

Only the publishable key belongs in Vite configuration. Supabase secret keys and legacy `service_role` keys are server-only and must never use a `VITE_` prefix.

The repository pins the Supabase CLI as a development dependency. Docker must be running for the local stack:

```bash
npm run supabase:start
npm run supabase:status
npm run supabase:db:reset
npm run supabase:db:lint
npm run supabase:gen:types
npm run supabase:verify:rls
npm run supabase:stop
```

Committed schema changes belong in timestamped files under `supabase/migrations/`. Generated `src/services/supabase/database.types.ts` is produced from the running local schema with `npm run supabase:gen:types`; do not hand-edit it.

### League account provisioning

The `league_accounts` migration seeds the six approved league identities but intentionally does not contain production Auth UUIDs or passwords. A trusted local/admin process binds each record to an Auth user using a deterministic internal, non-deliverable identifier derived from its team slug. The later UI will accept team name plus password; users never need this internal identifier.

After applying the migration to a hosted Supabase project, supply `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, and a unique password for every account that still needs creating, then run:

```bash
npm run provision:league-accounts
```

This command is admin-only: it uses the Supabase secret key, must never run in a browser or Vercel build, never changes an existing password, and fails if an existing binding disagrees with the approved registry. Do not commit its environment values. `npm run supabase:verify:rls` creates only disposable local Auth fixtures and refuses to target a hosted URL.

## Verification

```bash
npm run typecheck
npm test
npm run build
npm run lint
```

The opt-in live check contacts the public FPL Draft bootstrap and also audits the committed ranking-artifact join:

```bash
npm run verify:fpl-live
```

It is deliberately excluded from deterministic CI.

The G1 league-identity check performs only public official FPL Draft reads. It verifies the committed league/entry mapping, all six standings references, and each entry's exact 15-player original draft roster against the immutable archive:

```bash
npm run verify:fpl-league-live
```

No FPL login, cookie or mutation route is used.

The development-only archive export validates the canonical snapshot and prints its project-owned `DraftPick[]`. It never reads or writes browser storage:

```bash
npm run export:official-draft-picks
```

To reproduce the fixed current-season model signal after acquiring the pinned research data:

```bash
research/.venv/Scripts/python.exe -m research.scripts.build_current_draft_rankings
```

The script evaluates one fixed position-specific Ridge configuration on the 2023/24 and 2024/25 chronological development folds before producing `src/data/currentDraftRankingSignals.json`. It does not run XGBoost or a model search.

## League dashboard

The desktop navigation provides League, My Team, Teams, Matchday, Players, Transactions, and Draft Archive views. Pitch views group the full squad by FPL position. They do not claim an official Gameweek XI or bench order. Availability, fixtures, scores, and lineup fields remain visibly unconnected until a verified adapter exists.

## Immutable draft and roster evolution

`src/data/leagues/kile-n-others/officialDraft2026-27.json` is the canonical historical starting point. It contains 90 unique scheduled selections, six final 15-player rosters, and frozen draft-day ranking metadata. The human-readable mirror is `docs/leagues/KILE_N_OTHERS_OFFICIAL_DRAFT_2026_27.md`.

```text
immutable official draft final rosters
        +
processed transactions in chronological order
        ↓
current league rosters and ownership directory
```

`PROPOSED` trades never change ownership. Only `PROCESSED` records are applied. Trades must exchange the same positional composition, and waiver/free-agent exchanges preserve position. No project transaction is submitted to FPL automatically.

## Ranking evidence

Official `draft_rank` is the primary live ranking input and remains visible unchanged. The project-owned `DraftFitHeuristicV1` combines rank-percentile evidence as follows:

```text
trusted historical model signal: 70% official rank + 30% model rank
no trusted historical signal:    100% official rank
```

The fixed secondary signal is position-specific Ridge with `alpha=10`, using only quality-approved `FPL_BASE`, `FPL_EXPECTED`, and `FPL_ICT` draft-day features. Current inference and historical dataset construction share the same position-specific prior-rate helper; a deterministic parity test checks every shared MVP input value. Exact stable FPL `code` matching is required during artifact generation. Unmatched, ambiguous, conflicting, and insufficient-history players retain their official Draft rank and receive no fabricated model value.

The 70/30 split is a transparent project MVP heuristic, not an official FPL ranking, validated probability, or historically optimized weight. See [docs/DRAFT_NIGHT_MVP.md](docs/DRAFT_NIGHT_MVP.md).

## Best Available, Best Fit, and Best Pair

**Best Available** is the highest consensus-ranked legal available player for the user's roster.

**Best Fit** evaluates a shortlist using current quality plus deterministic positional opportunity cost. It reuses Turn Horizon and assumes the next `N` opponent selections consume the top consensus-ranked available players. This is a board-depletion stress test, not a prediction of opponent behavior and not a survival probability. At Vuk's consecutive Picks 12 and 13, `N` is derived from the opponent selections before the following user turn at Pick 24.

**Best Pair** is shown only when at least two consecutive user selections remain in the current turn. It evaluates legal pairs jointly, removes each pair plus the same schedule-derived `N` opponent selections, and compares each selected positional slot with a separate post-scenario replacement. At Vuk's Pick 12 it evaluates Picks 12 + 13 with 10 opponent selections before Pick 24; after Pick 12 is recorded, it disappears because only Pick 13 remains. It never records or submits either player automatically.

## Architecture overview

```text
Immutable official draft -> processed transactions -> current rosters
            ↓                                      ↓
      Draft Archive                    ownership + squad views
                                                   ↑
Public FPL Draft bootstrap -> adapter -> normalized Player[]
```

Important calculations remain pure in `src/domain`; React does not reimplement snapshot validation, ownership, or transaction application. The legacy Draft Room retains its snake, ranking, Best Fit, and Best Pair modules. Storage is isolated under `src/storage`. Phase 5 research remains isolated under `research/` and its Python dependencies do not ship in the app.

Current trust statuses are:

- Data quality: **PASS WITH EXCLUSIONS**
- Leakage: **PASS**
- Model sanity: **PASS**

## Documentation

- [Draft-night MVP](docs/DRAFT_NIGHT_MVP.md)
- [Official 2026/27 draft](docs/leagues/KILE_N_OTHERS_OFFICIAL_DRAFT_2026_27.md)
- [League dashboard roadmap](docs/LEAGUE_DASHBOARD_ROADMAP.md)
- [FPL Draft Matchday research](docs/FPL_DRAFT_MATCHDAY_RESEARCH.md)
- [Architecture](docs/ARCHITECTURE.md)
- [FPL data contract](docs/FPL_DATA_CONTRACT.md)
- [Draft-board logic](docs/DRAFT_BOARD_LOGIC.md)
- [Snake-draft logic](docs/SNAKE_DRAFT_LOGIC.md)
- [Historical research](research/README.md)

## Current limitations

- Manual companion only: no FPL authentication or automatic official picks
- No verified league ID or entry IDs are stored, so standings and manager Gameweek squads are not connected
- No live Gameweek scores, official lineup/bench state, injuries, expected minutes, or fixture difficulty yet
- Transactions are project-owned records; they do not submit official trades, waivers, or free-agent moves
- Secondary Ridge output is supporting evidence, not the sole ranking authority
- No validated opponent-selection or survival-probability model
- Best Pair is deterministic scenario analysis, not an opponent-behavior or player-survival model
- No prices, budgets, three-per-club rule, or health diagnosis
- No account-aware UI, hosted account provisioning, cross-device league-state persistence, or backup import/export yet
- No production Understat, bookmaker, ClubElo, scraping, or XGBoost integration
- The public FPL Draft endpoint and its schema are not formally guaranteed

## Deployment target

Vercel remains the target, sourced from this GitHub repository. Deployment itself is outside Phase 6.
