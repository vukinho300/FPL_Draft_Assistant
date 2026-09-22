# Fantacalcio — Roadmap and Current Status

## Current status

Project review/architecture research: COMPLETE.

FA0A architecture audit + league-rule questionnaire: **COMPLETE**.

FA0B rules/architecture contract freeze: **COMPLETE**.

**FA0 — Rules & architecture freeze: COMPLETE.**

**FA1 — Fantacalcio shell + authorization: COMPLETE.**

Production verification passed after PR #47:
- Vuk-only capability/RLS grant is live;
- Fantacalcio product entry works;
- Fantacalcio ↔ FPL switching works;
- logout/login works;
- existing FPL behavior remains available.

**Current delivery mode: 9-hour official-auction sprint.**

Current sprint task: **FA2-S — reliable auction ledger engine**.

The long-term roadmap below remains the post-auction architecture. During the sprint, phases may be compressed according to `07_Auction_Sprint.md` when doing so preserves correctness and directly improves auction readiness.

Remaining uncertainty is narrow and explicitly tracked:
- season-ending injury refund is unconfirmed;
- full upper defense-modifier table/cap is unconfirmed;
- auction position sequence will be selected when the asta starts.

These uncertainties do not block the initial auction recorder.

## Confirmed 2026/27 league contract

- season: 2026/27;
- initial auction before 10 October 2026, likely imminent;
- Classic roles + head-to-head league competition;
- 8 managers: Achi, Massi, Peps, Vuk, Dan, Paolo, Gian/Edu, Francesco;
- 500 credits each;
- 25-player roster: 3 POR / 8 DIF / 8 CEN / 6 ATT;
- minimum purchase price: 1 credit;
- maximum legal bid must reserve 1 credit for each still-unfilled mandatory slot;
- defense modifier enabled;
- goalkeeper included in defense modifier by base vote only;
- defender/goalkeeper modifier inputs exclude ordinary bonus/malus;
- no captain modifier;
- trades allowed after initial auction;
- one repair auction after winter transfer market closes in 2027.

## 9-hour sprint override

The hard delivery constraint is a usable official-auction system within the current 9-hour project timebox.

During this sprint:
- reliable auction recording is non-negotiable;
- simple validated data/model methods are preferred over rushed complex methods;
- full roadmap phases may be compressed into sprint variants;
- no fake player/model data may be introduced;
- security, ownership/budget correctness and recoverability are not optional;
- documentation/onboarding/re-audit work is minimized unless it prevents a real error;
- the full roadmap resumes after the auction.

See `07_Auction_Sprint.md` for the active sequence and cut line.

## Roadmap principles

Two workstreams can progress in parallel:
- auction/product reliability;
- data/model research.

The usable auction recorder must not be blocked by sophisticated ML work.

For the first official asta, the target is one clean, validated projection release. A large recurring refresh/retraining system is intentionally **not** a standalone early milestone.

## FA0 — Rules & architecture freeze — COMPLETE

FA0 is complete through FA0A + FA0B.

Frozen outcomes:
- shared platform infrastructure may be reused without coupling Fantacalcio to FPL football-domain models;
- Fantacalcio remains a separate domain for identities, roles, scoring, auction state, projections and economics;
- Vuk-only access uses an explicit capability tied to verified Supabase Auth identity;
- FA1 can proceed without inventing unresolved league rules;
- valuation-sensitive unknowns remain explicit rather than guessed.

## FA1 — Fantacalcio shell + authorization — COMPLETE

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
- minimum 1-credit purchase enforced;
- max legal bid respects remaining mandatory slots;
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
- calculate/reconcile Fantacalcio scoring from historical data;
- include defense-modifier-aware team/position value where the league rule affects auction value.

Completion:
- sampled seasons/players reproduce expected fantasy outcomes under league rules;
- modifier treatment is evidence-based and configurable for any still-unconfirmed upper band/cap.

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
- minimum 1-credit future slots are enforced;
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

## Deferred / explicitly unresolved

- continuous automatic database/model refresh infrastructure beyond deliberate release rebuilds;
- iPhone/mobile optimization;
- speculative opponent psychology;
- advanced data sources that fail quality/licensing/value gates;
- season-ending injury refund until commissioner confirmation;
- full upper defense-modifier table/cap until confirmed;
- fixed auction position sequence (chosen at auction start).
