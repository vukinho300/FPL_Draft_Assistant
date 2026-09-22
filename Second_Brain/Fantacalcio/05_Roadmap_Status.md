# Fantacalcio — Roadmap and Current Status

## Current status

Project review/architecture research: COMPLETE.

Current implementation phase: **FA0 — Rules & architecture freeze**.

No Fantacalcio production code should assume unresolved squad/scoring rules.

## Roadmap principles

Two workstreams can progress in parallel:
- auction/product reliability;
- data/model research.

The usable auction recorder must not be blocked by sophisticated ML work.

For the first official asta, the target is one clean, validated projection release. A large recurring refresh/retraining system is intentionally **not** a standalone early milestone.

## FA0 — Rules & architecture freeze

**Objective:** define exactly what game is being optimized.

Work:
- exact scoring system;
- squad slots/formation rules;
- nomination/bidding rules;
- configurable manager count and budget;
- Vuk-only capability design;
- confirm shared-platform/separate-domain architecture.

Completion:
- no unresolved rule materially affects valuation or auction legality.

## FA1 — Fantacalcio shell + authorization

**Objective:** create private blue Fantacalcio mode.

Work:
- Vuk-only capability;
- frontend navigation gating;
- backend/RLS/API enforcement;
- laptop shell.

Completion:
- Vuk can access;
- other FPL accounts fail authorization;
- existing FPL behavior unaffected.

## FA2 — Auction ledger engine

**Objective:** build reliable real-time auction state.

Work:
- auction session;
- managers;
- nominations;
- sales;
- corrections/undo;
- budgets;
- position slots;
- invariant tests.

Completion:
- deterministic budgets/slots/history;
- duplicate ownership blocked;
- corrections safe.

## FA3 — Laptop auction MVP

**Objective:** make the system usable at the table.

Work:
- player search;
- fast sale entry;
- manager board;
- history;
- keyboard workflow;
- export/backup.

Completion:
- common sale can be recorded in seconds;
- state persists correctly;
- desktop rehearsal passes.

## FD1 — Serie A/Fantacalcio source and API research

**Objective:** choose trustworthy sources before building the data pipeline.

This phase requires dedicated deep research.

Investigate official and commercial/open providers for:
- Fantacalcio roles/votes/fantamedia/quotations/FVM;
- Serie A players, matches, lineups and minutes;
- advanced statistics including xG/xA when useful;
- transfers;
- injuries/suspensions;
- probable lineups/starter evidence;
- set pieces/penalties/tactical role;
- historical seasons;
- historical auction-price evidence.

Evaluate:
- coverage;
- stable IDs;
- timestamp semantics;
- historical depth;
- licensing/terms;
- cost/rate limits;
- reproducibility;
- unique predictive value.

Completion:
- approved/rejected source matrix;
- small source set selected;
- no important field relies on an unverified scraper by accident.

## FD2 — Canonical identity/data layer

**Objective:** create stable validated Serie A data.

Work:
- immutable raw snapshots;
- source manifests/checksums;
- internal player IDs;
- cross-source mappings;
- canonical player/match/season/role/injury tables;
- quality gates.

Completion:
- critical identity conflicts = 0;
- duplicate/ambiguous/missing coverage reported;
- canonical data reproducible from raw sources.

## FM1 — Exact scoring reconstruction

**Objective:** build the historical target matching the real league.

Work:
- calculate/reconcile Fantacalcio scoring from historical data.

Completion:
- sampled seasons/players reproduce expected fantasy outcomes under league rules.

## FM2 — Playing-time baseline

**Objective:** estimate starts/appearances/minutes.

Completion:
- chronological validation beats simple naive role/minutes baselines or documents why not.

## FM3 — Production + availability baselines

**Objective:** predict output when playing and expected availability separately.

Work:
- shrinkage/simple baselines;
- injury/availability features;
- current-season evidence.

Completion:
- leakage audit passes;
- baseline performance and calibration established.

## FM4 — Model tournament

**Objective:** choose model family from evidence.

Work:
- Ridge/ElasticNet and shrinkage baselines;
- tree/boosting/probabilistic/LTR candidates where justified;
- walk-forward evaluation;
- negative controls.

Completion:
- selected model beats or deliberately defers to simple baseline on predeclared metrics.

## FM5 — Official-asta projection release

**Objective:** produce the clean player evaluation dataset used for the auction.

This replaces the earlier idea of a large standalone recurring refresh milestone for the first cycle.

Work:
- collect the newest intended snapshot;
- validate/sanitize;
- update current-season context/injuries/roles;
- build features;
- train/select frozen model configuration;
- generate versioned projections and uncertainty;
- run release quality gates;
- freeze a release ID for the official asta.

Completion:
- every selectable player has a projection or explicit unavailable reason;
- source/model timestamps and warnings are visible;
- release is reproducible;
- Vuk approves the release for auction use.

If a material event occurs after release but before the auction, perform a deliberate rebuild rather than relying on a continuously refreshing database.

## FE1 — Static auction economics

**Objective:** turn projections into economic value.

Work:
- replacement level;
- scarcity;
- VORP/marginal value;
- fair credits;
- max legal bid;
- roster/budget optimizer.

Completion:
- optimized legal 500-credit roster scenarios;
- position budgets emerge from the player pool rather than fixed percentages.

## FE2 — Live market economics

**Objective:** react to actual purchases.

Work:
- opponent budgets/needs;
- market residuals;
- inflation by position/tier;
- dynamic expected prices;
- Vuk target/alternative recalculation.

Completion:
- each sale updates guidance immediately and deterministically.

## FE3 — Scenario / Monte Carlo max-bid engine

**Objective:** compare buy-now against waiting.

Work:
- price distributions;
- remaining-auction simulation;
- scenario utility/risk.

Completion:
- recommended max bids respond rationally to scarcity, competitors and remaining budget.

## FA4 — Full decision dashboard

**Objective:** join the validated model/economics with the fast auction UI.

Completion:
- laptop rehearsal proves rapid entry, correct state, useful recommendations and understandable uncertainty.

## Deferred

- continuous automatic database/model refresh infrastructure beyond what is needed for a deliberate release rebuild;
- iPhone/mobile optimization;
- speculative opponent psychology;
- any advanced data source that fails quality/licensing/value gates.
