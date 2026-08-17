# FPL Draft Assistant

**Phase 6.1 — Draft-night MVP with Best Pair**

FPL Draft Assistant is a personal desktop companion for an official Fantasy Premier League Draft. It loads the current public FPL Draft player pool, maintains a local ranked board, assigns manually recorded players to managers through the existing snake schedule, and provides deterministic Best Available, Best Fit, and consecutive-turn Best Pair context. All official draft actions still happen in the official FPL Draft service.

The default development fixture is the real six-manager order Vuk, Diego, Kristian, Miku, Tin, and Deni, with Vuk selected as the user. The domain remains generic for 2–16 managers.

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

To reproduce the fixed current-season model signal after acquiring the pinned research data:

```bash
research/.venv/Scripts/python.exe -m research.scripts.build_current_draft_rankings
```

The script evaluates one fixed position-specific Ridge configuration on the 2023/24 and 2024/25 chronological development folds before producing `src/data/currentDraftRankingSignals.json`. It does not run XGBoost or a model search.

## Draft-night workflow

1. Confirm the first-round manager order and choose “My manager”.
2. Follow the ranked available-player board or search/filter it.
3. After each official selection, click **Draft** for the selected player.
4. The snake schedule automatically assigns that player to the correct manager and advances the picker.
5. Use **Undo last pick** for the single supported correction.

Refresh restores manager configuration, user-manager identity, and authoritative pick history from the versioned `fpl-draft-assistant:v1` localStorage entry. Availability, completed-pick count, rosters, and current picker are always recomputed.

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
Public FPL Draft bootstrap
        ↓
server-side FPL adapter -> normalized Player[]
        ↓                         + small research-generated model artifact
MVP consensus ranking            + snake schedule / Turn Horizon
        ↓                         + authoritative local pick history
Available board + rosters + Best Available + Best Fit + Best Pair
        ↓
React Draft Room
```

Important calculations remain pure in `src/domain`; React does not reimplement snake reversal, roster validation, consensus arithmetic, Best Fit, or Best Pair. Storage is isolated under `src/storage`. Phase 5 research remains isolated under `research/` and its Python dependencies do not ship in the app.

Current trust statuses are:

- Data quality: **PASS WITH EXCLUSIONS**
- Leakage: **PASS**
- Model sanity: **PASS**

## Documentation

- [Draft-night MVP](docs/DRAFT_NIGHT_MVP.md)
- [Architecture](docs/ARCHITECTURE.md)
- [FPL data contract](docs/FPL_DATA_CONTRACT.md)
- [Draft-board logic](docs/DRAFT_BOARD_LOGIC.md)
- [Snake-draft logic](docs/SNAKE_DRAFT_LOGIC.md)
- [Historical research](research/README.md)

## Current limitations

- Manual companion only: no FPL authentication or automatic official picks
- Secondary Ridge output is supporting evidence, not the sole ranking authority
- No validated opponent-selection or survival-probability model
- Best Pair is deterministic scenario analysis, not an opponent-behavior or player-survival model
- No prices, budgets, three-per-club rule, trades, waivers, or health diagnosis
- No database, accounts, cross-device sync, or backup import/export
- No production Understat, bookmaker, ClubElo, scraping, or XGBoost integration
- The public FPL Draft endpoint and its schema are not formally guaranteed

## Deployment target

Vercel remains the target, sourced from this GitHub repository. Deployment itself is outside Phase 6.
