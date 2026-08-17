# Architecture

## Purpose

FPL Draft Assistant is a personal companion application for an official Fantasy Premier League Draft. It helps a user organize draft-night information without replacing or controlling the official service.

## Scope

The implemented Phase 6.1 scope is a desktop draft-night companion: manager setup, a live ranked player board, sequential pick tracking, derived rosters and availability, undo-last-pick, Best Available, deterministic Best Fit, consecutive-turn Best Pair, and local refresh persistence. Backup/import, official-pick automation, and season-long management remain outside this phase.

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

`src/domain/league.ts` owns the official roster contract, supported league-size validation, and per-position demand/target arithmetic. `src/domain/draftBoard.ts` consumes only `Player[]` to derive deterministic official-rank context. `src/domain/manager.ts` owns manager identity and configuration validation. `src/domain/draftSchedule.ts` generates the snake schedule, current picker, manager turns, and Turn Horizon. `src/domain/draftRanking.ts` combines official and optional model rank evidence without mutating either. `src/domain/draftState.ts` validates authoritative sequential pick history and derives rosters and availability. `src/domain/bestFit.ts` owns individual-selection depletion facts; `src/domain/bestPair.ts` owns consecutive-selection pair evaluation. None imports React or raw upstream response types.

Planned source areas are:

- `src/domain`: project-owned types and pure business rules.
- `src/services`: external-data interfaces and adapters.
- `src/storage`: browser persistence abstractions.
- `src/components`: reusable UI components.
- `src/features`: application-level feature areas.

Only a source area needed by the current phase should be created.

## Persistence decision

`src/storage/draftSessionStorage.ts` owns the versioned `fpl-draft-assistant:v1` localStorage contract. It persists only the ordered managers, `userManagerId`, and authoritative pick history. Completed-pick count, current picker, drafted IDs, availability, and rosters are recomputed from the schedule and history.

Malformed JSON, unsupported schema versions, invalid manager configuration, and invalid persisted history fail closed. The UI offers a fresh-session reset instead of silently accepting the state. Data is local to one browser/origin; there is no database, account, cross-device sync, or backup import/export.

## Deployment model

The planned delivery path is GitHub to Vercel. `api/fpl.ts` is a thin Vercel Function entry point, but deployment and credentials are intentionally not configured in this phase.

The production request flow is:

```text
Browser -> GET /api/fpl -> FPL client -> official FPL Draft endpoint
```

The Vite development configuration mounts the same `createFplHandler` implementation at `/api/fpl` for local Draft Room testing. Production continues to use the root Vercel Function. No separate proxy implementation or browser-side direct upstream call is introduced.

## External FPL data

The integration retrieves `https://draft.premierleague.com/api/bootstrap-static` on the server. The Phase 6 verification observed 590 normalized current players. Live counts are response-specific evidence, not a schema or availability guarantee.

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

## Ranking, Best Fit, and Best Pair boundary

The Phase 6 recommendation domain consumes schedule context without putting recommendation logic inside the snake engine:

```text
Consensus-ranked Available Player Data
        +
User Roster
        +
Turn Horizon
        ↓
Best Available + deterministic Best Fit + deterministic Best Pair
```

Official Draft rank remains the primary evidence. `DraftFitHeuristicV1` uses 70% official-rank percentile and 30% historical-model-rank percentile when an exact, trustworthy model signal exists; otherwise it uses 100% official rank. Those weights are a transparent MVP choice, not optimized probabilities.

Best Fit removes roster-illegal candidates, creates a Turn-Horizon-sized shortlist, and stress-tests positional depth by consuming the next `N` top consensus options, where `N` is the opponent selections before the user's following turn. Recommendation ordering uses current consensus quality plus 0.35 times the resulting position drop-off. Deterministic tie-breakers fall back to consensus rank, display name, and player ID. The output contains facts and fixed explanations; it has no probability or survival claim.

Best Pair activates only when the current picker is the user and at least two consecutive selections remain in that current turn. It considers distinct available players from a shortlist of `max(12, N + 5)`, rejects pairs that would exceed roster capacities, removes the pair and then the next `N` consensus-ranked opponent selections, and evaluates positional replacements jointly. For two selections at one position, the stronger selection is compared with the strongest replacement and the second selection with the second replacement. Its score is pair consensus quality plus 0.35 times the sum of positive replacement drops. The five results use deterministic quality, rank, official-evidence, name, and ID tie-breakers and contain no probability claim.

At Vuk's consecutive edge turn, Best Pair is active immediately before Picks 12 and 13, uses 10 opponent selections before the following turn at Pick 24, and becomes inactive after Pick 12 is recorded because only Pick 13 remains. React only renders the domain result and never auto-drafts either player. See [DRAFT_NIGHT_MVP.md](DRAFT_NIGHT_MVP.md).

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
- AI-generated recommendation text
- A fabricated projection for cold-start players
- Pair optimization in the Phase 6 MVP

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

Draft-day and in-season targets are separate. Historical FPL `code` is the authoritative cross-season player key but remains metadata, never a primary estimator predictor. Features are cutoff-aware, preprocessing is fitted inside chronological training folds, and the 2025/26 configuration was frozen before its original evaluation. Since that result is now exposed, later model families must treat 2025/26 as a previously exposed external benchmark rather than an untouched holdout.

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

### Phase 5B model-safety boundary

Quality-approved feature rows now expose `prediction_cutoff`, `feature_max_timestamp`, `target_start_timestamp`, `target_end_timestamp`, and a metadata-only stable sample key. The model boundary blocks any row unless features are at/before the cutoff and targets begin strictly afterward. Actual chronology further excludes a future-labelled rescheduled fixture that has already occurred by the cutoff.

`model_safety.py` owns the forbidden-feature registry, immutable estimator manifests, temporal validation, sample-key uniqueness, chronological split audits, and deterministic negative-control plumbing. Every fit must receive exactly its declared numeric/categorical features; targets, future/final values, IDs, names, teams, sample keys, and evaluation metadata cannot enter implicitly. Preprocessing stays inside the training-fitted scikit-learn pipeline.

```text
QUALITY-APPROVED DATA
  -> TEMPORAL CONTRACT
  -> FEATURE ALLOWLIST + MANIFEST
  -> UNIQUE SAMPLE KEYS + ZERO-OVERLAP CHRONOLOGICAL SPLIT
  -> TRAIN-ONLY PREPROCESSING
  -> MODEL + SHUFFLED/RANDOM CONTROLS
  -> GROUPED METRIC VALIDATION
  -> MODEL-SANITY VERDICT
```

The current statuses are data quality **PASS WITH EXCLUSIONS**, leakage **PASS**, and model sanity **PASS**. XGBoost is deliberately absent and belongs to Phase 5C.

Research conclusions do not enter `src/domain/player.ts` and are not a Best Fit implementation. A future phase may design a production enrichment adapter after reviewing the evidence, source stability, scoring-regime changes and cold-start limitations.
