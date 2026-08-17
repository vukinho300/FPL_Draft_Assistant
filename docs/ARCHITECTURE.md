# Architecture

## Purpose

FPL Draft Assistant is a personal companion application for an official Fantasy Premier League Draft. It helps a user organize draft-night information without replacing or controlling the official service.

## Scope

The product scope is a draft-night companion: manager setup, a local draft board, available-player discovery, pick tracking, history, undo, and backup are planned. The current implementation establishes the player-data boundary, deterministic candidate-board domain, manager configuration, and snake-schedule context. It does not implement live draft state or football player selection.

## Initial stack

The client uses React, Vite, and TypeScript. npm manages dependencies, Vitest runs unit tests, and Oxlint provides lightweight static analysis. Node.js 24 is the recorded development and CI runtime.

## Architecture

The intended dependency flow is:

```text
External FPL data
       ↓
FPL adapter
       ↓
Normalized internal models
       ↓
Domain logic
       ↓
React UI
```

External response structures stop at the adapter boundary. Components consume stable project-owned models, while important calculations remain pure and testable independently of React. `src/services/fpl` validates the small upstream surface it needs and maps it into the `src/domain` Player model.

`src/domain/league.ts` owns the official roster contract, supported league-size validation, and per-position demand/target arithmetic. `src/domain/draftBoard.ts` consumes only `Player[]` to derive deterministic rank context and candidate-board entries. `src/domain/manager.ts` owns manager identity and configuration validation. `src/domain/draftSchedule.ts` consumes validated manager configuration to generate the snake schedule, current picker, manager turns, and Turn Horizon. None of these modules imports raw FPL response types or React.

Planned source areas are:

- `src/domain`: project-owned types and pure business rules.
- `src/services`: external-data interfaces and adapters.
- `src/storage`: browser persistence abstractions.
- `src/components`: reusable UI components.
- `src/features`: application-level feature areas.

Only a source area needed by the current phase should be created.

## Persistence decision

Future personal draft state will use browser-local persistence through a storage adapter backed by `localStorage`. State therefore will not automatically be shared between different browsers or devices. Export and import can later provide an explicit transfer mechanism. Phase 4 deliberately adds no storage: manager setup and `completedPickCount` are demonstration state that reset on refresh.

## Deployment model

The planned delivery path is GitHub to Vercel. `api/fpl.ts` is a thin Vercel Function entry point, but deployment and credentials are intentionally not configured in this phase.

The production request flow is:

```text
Browser -> GET /api/fpl -> FPL client -> official FPL Draft endpoint
```

The Vite development server does not execute root Vercel Functions. Deterministic tests exercise the integration modules directly. Developers who need end-to-end local function execution may use a separately installed Vercel CLI and `vercel dev`; the CLI is not a project dependency.

## External FPL data

The integration currently retrieves `https://draft.premierleague.com/api/bootstrap-static` on the server. It was live-verified at `2026-08-17T11:32:17.936Z` with HTTP 200 and an `application/json` response containing 587 players, 20 teams, and four position definitions.

The endpoint is an undocumented or insufficiently documented implementation detail. Its availability and schema are not guaranteed. For that reason:

- the client checks HTTP status and content type before parsing;
- the normalizer treats input as `unknown` and validates only required fields;
- raw response shapes remain inside `src/services/fpl`;
- unknown club or position references and invalid player records fail the response rather than being silently guessed or skipped;
- `/api/fpl` returns only `retrievedAt`, `playerCount`, and normalized players;
- the response is marked `no-store` in this phase.

The Player model adopts the upstream numeric `id` as a project-owned string ID, `web_name` as the display label, the referenced team name and short name as a Club, the explicitly mapped position, and `draft_rank` as a nullable official ordinal. The upstream response does not formally define the semantics of `draft_rank`; it must not be described as projected points or a project recommendation.

The response also exposed `status` codes and numerous statistics, but their precise current semantics were not established by the response itself. They are intentionally omitted. Full field evidence and failure categories are documented in [FPL_DATA_CONTRACT.md](FPL_DATA_CONTRACT.md).

## Draft-board domain

The domain accepts leagues from 2 through 16 managers. Official per-manager roster requirements are 2 GK, 5 DEF, 5 MID, and 3 FWD. League demand multiplies those values by manager count.

Candidate targets apply the project-owned `DEFAULT_RESERVE_BUFFER` of 0.35 independently to every position and round each result upward. Per-position calculation prevents an overall buffer from producing too few candidates at one position.

Players are ordered by:

1. valid `officialDraftRank` ascending;
2. display name ascending using deterministic string comparison;
3. player ID ascending using deterministic string comparison.

Null-ranked players follow every ranked player and retain `null`; no artificial official rank is created. `positionRank`, positional demand, candidate target, and core-demand membership are project-derived context. They are not official fields, projections, VOR, or availability assessments.

The board validates that each position has enough input players to meet its candidate target. If not, it throws a typed error containing the position, required target, and available count instead of returning a silently incomplete pool. See [DRAFT_BOARD_LOGIC.md](DRAFT_BOARD_LOGIC.md) for formulas and examples.

## Manager and snake-schedule domain

A `Manager` has a project-owned string ID and a visible display name. Identity is independent of that label, so a rename does not create a new manager. A `DraftConfiguration` preserves the explicitly supplied first-round order, identifies the user's manager, and records the existing 15-player squad size as its round count.

Validation reuses the supported 2–16 manager range. IDs must be non-empty and unique, labels must be non-empty after trimming, and `userManagerId` must resolve. Display labels must also be unique after trimming and lower-case normalization. That last requirement is a **project UX rule**, not an official FPL rule; duplicate visible labels would be ambiguous during manual draft-night operation.

The assistant models the Wheel of Names or other order supplied by the user. It never modifies the official FPL Draft league or its server-side order. Odd rounds retain the supplied order and even rounds reverse it. The engine generates 15 rounds using `FPL_DRAFT_SQUAD_SIZE` and returns one-based project-owned `DraftSlot` values. For `N` managers the schedule length is `N × 15`.

Scheduling progress is represented only by `completedPickCount`: zero means no selections are complete, and schedule length means the draft is complete. The current slot is the schedule element immediately after the completed prefix; it is deliberately `null` at completion. Manager pick numbers, consecutive manager turns, and Turn Horizon are derived by inspecting this generated schedule rather than duplicating snake-position formulas. See [SNAKE_DRAFT_LOGIC.md](SNAKE_DRAFT_LOGIC.md) for exact off-by-one semantics.

## Future Best Fit boundary

A future Best Fit service may consume schedule context without putting recommendation logic inside the snake engine:

```text
Available Player Data
        +
User Roster
        +
Draft Board
        +
Turn Horizon
        ↓
Best Fit
```

Phase 4 implements only Turn Horizon from that input set. It does not implement a roster, player selections, pair scoring, recommendations, or choose a scoring model.

## Future data-enrichment research

A later research phase may evaluate verified sources and precise contracts for expected goals, expected assists, expected goal involvement, ICT components, minutes and starts, defensive contributions, player availability, and fixture difficulty. These are roadmap questions, not current normalized fields. Phase 4 adds no FBref integration, scraping, projections, health assessment, or enrichment code.

## Non-goals for v1

- FPL account authentication
- Automatically submitting official picks
- Modifying the official draft order
- Trades
- Waivers
- Season-long league management
- A remote database
- AI recommendations
- A fabricated projection model
- Football player selection or roster state in the Phase 4 schedule engine

## Verification philosophy

Important calculations must be deterministic and covered by focused unit tests. Tests should use the smallest fixtures that demonstrate behavior, keep external integration at explicit boundaries, and avoid large fabricated player datasets.

## Phase 5 offline research boundary

Phase 5 adds a Python-only research layer without changing the production dependency graph:

```text
Historical external data
        ↓
Research ingestion + provenance
        ↓
Blocking data-quality gate
        ↓
Leakage-safe historical features
        ↓
Chronological backtesting
        ↓
Evidence
        ↓
Future production enrichment
```

The layer lives under `research/`; pandas, NumPy, SciPy and scikit-learn are research-only dependencies and do not ship in the React/Vercel build. Raw data, processed frames, environments and model binaries are gitignored. Committed artifacts are acquisition/feature/model code, small deterministic fixtures, configs, checksums, aggregate metrics and reports.

Draft-day and in-season targets are separate. Historical FPL `code` is the only authoritative cross-season player key. Features are cutoff-aware, preprocessing is fitted inside chronological training folds, and 2025/26 is a locked holdout whose config was frozen before target evaluation. Optional source failures degrade the experiment rather than becoming production dependencies or scraping escalation.

### Phase 5A quality boundary

The research dependency flow is now enforced as:

```text
SOURCE
  ↓
RAW SCHEMA + GRAIN + DUPLICATE VALIDATION
  ↓
REFERENTIAL INTEGRITY + HISTORICAL IDENTITY
  ↓
DECLARED JOIN CARDINALITY
  ↓
MISSINGNESS + DISTRIBUTION + TEMPORAL/LEAKAGE VALIDATION
  ↓
FEATURES
  ↓
MODELS
```

`research/fpl_research/quality.py` owns pure validation and audited-join primitives. `quality_gate.py` applies them to the pinned archives, and `run_data_quality.py` writes both human and machine evidence. Dataset building and benchmark entry points refuse to run without a current benchmarkable gate result. Preserve-left joins fail on row multiplication; unjustified many-to-many joins fail; conflicting logical duplicates fail.

Data cleaning and data-quality validation are distinct. Validation decides whether a source can be trusted. Cleaning may then apply only documented, evidence-backed transformations. Phase 5A permits identical-copy removal, the historical `GKP` label normalization to `GK`, and removal of assistant-manager chip rows that violate the football-player grain. It does not auto-delete statistical outliers or turn absent fields into zero.

Understat is optional. Its 2020/21 and 2025/26 player-level datasets fail availability, so configurations requiring those source-seasons are blocked rather than scored. FPL and Football-Data pass all required seasons, with explicit FPL exclusions documented in the quality report.

Research conclusions do not enter `src/domain/player.ts` and are not a Best Fit implementation. A future phase may design a production enrichment adapter after reviewing the evidence, source stability, scoring-regime changes and cold-start limitations.
