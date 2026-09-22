# Fantacalcio — Modelling and Leakage

## Prediction target

For the first official asta, rank/value players by their realistic expected Fantacalcio contribution **from the actual 2026/27 auction date through the remainder of the season**, under the league's exact scoring rules.

The auction must occur before 10 October 2026 and is expected to be imminent, so current 2026/27 Serie A evidence already exists and must be incorporated without overpowering the historical prior.

Do not optimize historical reputation or short-term form in isolation.

## League-rule implications for the target

Confirmed roster/scoring context materially affects valuation:
- Classic roles;
- 3 POR / 8 DIF / 8 CEN / 6 ATT;
- 500-credit auction budget;
- defense modifier enabled;
- goalkeeper included in defense modifier by **base vote only**;
- defender modifier calculation also excludes ordinary bonus/malus;
- goalkeeper clean-sheet and penalty-save bonuses matter for normal player fantapoints but **not** for the defense-modifier base-vote calculation.

Therefore defender/goalkeeper valuation must not be reduced to goals, assists, clean sheets or ordinary fantapoints alone. Base-vote consistency and expected contribution to the defense modifier are economically relevant.

The exact high-end defense-modifier band table/cap remains unconfirmed and should remain configurable/explicitly uncertain until verified.

## Model decomposition

Research and evaluate separate components:

1. **Playing time**
   - P(start)
   - P(appear)
   - expected minutes
   - rotation/role stability

2. **Production when playing**
   - fantasy output conditional on role/minutes
   - attacking/defensive contribution
   - set-piece/penalty role
   - team context
   - base-vote quality/consistency where relevant to the defense modifier

3. **Availability**
   - current injury/suspension state
   - historical availability/risk
   - uncertainty around return/recurrence

Combine these into remaining-season expected value with explicit uncertainty.

## Historical prior + current-season evidence

Do not use a fixed arbitrary historical/current-season weight.

Prefer evidence-driven shrinkage/Bayesian/recency methods where:
- role and minutes can update quickly;
- penalties/set pieces update rapidly when verified;
- underlying scoring/talent rates update more slowly;
- injury/availability priors update cautiously;
- current-season weight naturally increases with genuine evidence.

Learn prior strength through chronological historical evaluation.

## New signings

Treat transfer expectation as a prior, not truth.

Potential context:
- previous league/club;
- age;
- transfer fee/loan structure where reliable;
- previous minutes/production;
- expected role;
- competition;
- current Serie A starts/minutes;
- tactical fit;
- team strength.

Cross-league statistical translation must be validated before becoming a numerical production feature.

New signings normally carry wider uncertainty until Serie A evidence accumulates.

## Model tournament

Do not preselect XGBoost.

Mandatory baselines should include simple leakage-safe approaches such as:
- historical/recency baselines;
- empirical Bayes/shrinkage;
- Ridge/ElasticNet.

Then evaluate stronger candidates where justified:
- histogram gradient boosting;
- XGBoost;
- LightGBM;
- CatBoost;
- quantile/probabilistic models;
- learning-to-rank as a ranking benchmark/ensemble component.

A more complicated model enters production only if it beats the simple baselines on predeclared future-like chronological metrics.

## Leakage invariants

For every sample with prediction time T:

```text
max(feature_observed_at) <= prediction_time
prediction_time < target_period_start
```

Audit especially:
- final-season statistics;
- future match outcomes;
- historical quotations/FVM;
- probable-lineup snapshots;
- injuries and return dates;
- transfers;
- rolling windows;
- auction prices;
- target-derived features;
- current-season aggregates that include future matches.

Primary validation is chronological/walk-forward, not random train/test splitting.

Reuse the FPL research philosophy:
- immutable feature manifests;
- stable sample keys;
- zero train/test overlap;
- train-only preprocessing;
- duplicate-sample checks;
- shuffled-target negative controls;
- random-feature controls;
- baseline comparisons;
- source/identity quality gates.

## Explainability and uncertainty

Expose components where useful:
- performance;
- playing time;
- role;
- current-season evidence;
- historical prior;
- team context;
- health/availability;
- base-vote/modifier contribution where relevant;
- scarcity;
- risk;
- confidence.

Player explanations must be grounded in actual features/evidence rather than generic generated prose.

Avoid unsupported precision, especially for injury risk and uncertain new signings.

The season-ending injury-refund rule is not yet confirmed, so do not use assumed refund protection to reduce injury-risk penalties in the production valuation.


## Mandatory pre-model data-integrity gate

**No model training, ranking or auction-value recommendation may be trusted until the input release is `MODEL_READY`.**

The integrity gate is a hard prerequisite, not a cosmetic report.

### Hard-fail conditions

Any of the following blocks `MODEL_READY` until repaired or the affected source/season is excluded:

- wrong season/competition;
- missing current Classic role for a selectable player;
- unresolved current-player identity collision;
- duplicate canonical/sample key that can change training weight or ownership identity;
- silent many-to-many join explosion;
- materially incomplete match/gameweek coverage used as if complete;
- orphan player-match rows;
- silent numeric parse failure coerced to zero;
- undocumented source freshness/cutoff;
- feature timestamp after prediction cutoff;
- target-period information in features;
- target-derived fields in the feature matrix;
- train/validation/test overlap across the declared prediction boundary;
- shuffled-target control performing implausibly like the real model without explanation.

A high aggregate score can **never compensate for a hard failure**.

## Data Quality Score — 0 to 100

Every frozen research release must calculate a reproducible score with evidence for each component:

| Component | Weight |
| --- | ---: |
| Provenance & reproducibility | 10 |
| Schema & value validity | 10 |
| Identity & duplicate integrity | 20 |
| Coverage & missingness | 20 |
| Cross-source consistency | 15 |
| Temporal / leakage safety | 25 |
| **Total** | **100** |

### Interpretation

- **90–100 + zero hard failures:** `MODEL_READY`
- **80–89:** usable for investigation / possibly `AUCTION_POOL_READY`, but **not approved for statistical modelling**
- **<80:** blocked
- any hard failure: blocked regardless of score

The score is diagnostic and comparable across releases; it must not hide which sub-gate failed.

## Required integrity audits

### Raw provenance
For every used artifact record source, exact Git/provider version, path, checksum, schema, season, retrieval/observed time and freshness.

Raw input must not be silently overwritten.

### Schema/value validity
Validate field types and football constraints. Examples:
- starts <= appearances;
- minutes >= 0;
- appearances >= 0;
- valid P/D/C/A or POR/DIF/CEN/ATT role;
- no blank current identity;
- impossible values quarantined, not silently converted.

`NULL` and zero are different states.

### Duplicate integrity
Audit all grains actually used, including where available:
- source + source_player_id;
- canonical_player_id + season;
- season + fixture_id;
- season + team + fixture_id;
- season + canonical_player_id + fixture_id.

Also detect suspicious near-duplicates created by joins/concatenation.

### Fixture/match coverage
For each completed match-level Serie A season used in training:
- derive expected competition structure;
- for a standard 20-team double round-robin season, expected matches = 380;
- compare expected vs observed fixtures, teams, matchdays and per-team matches;
- explicitly list missing/duplicate fixtures.

For current 2026/27 data, compare only with fixtures completed up to the declared data cutoff.

A materially incomplete match-level season must be repaired or excluded rather than silently trained.

### Player-match coverage
Where player-match data exists:
- fixture exists;
- player's team participated;
- one player-fixture row at the intended grain;
- minutes/starts/sub appearances plausible;
- no orphan mappings.

### Missingness semantics
For every important field report missing percentage and classify missingness when possible as:
- EXPECTED;
- NEW_PLAYER;
- NO_APPEARANCE;
- SOURCE_UNAVAILABLE;
- JOIN_FAILURE;
- UNKNOWN.

Critical current identity/club/role/eligibility fields may not be silently missing.

### Cross-source consistency
For overlapping sources compare identity, club, season, appearances, starts, minutes, goals and assists where definitions permit.

Document provider-definition differences. Do not average contradictory values blindly.

### Temporal/leakage classification
Every modelling field must be tagged:
- `BACKTEST_SAFE`;
- `CURRENT_ONLY`;
- `TARGET_ONLY`;
- `UNSAFE`.

Historical rows must satisfy:

```text
feature_max_timestamp <= prediction_cutoff
prediction_cutoff < target_start_timestamp
```

Current-only snapshots may improve tonight's live ranking but cannot enter historical backtests unless equivalent historical as-of snapshots exist.

### Chronological evaluation
Random train/test split is not acceptable.

Use future-like chronological validation with:
- stable sample keys;
- zero train/test overlap;
- train-only preprocessing;
- later-season holdout;
- explicit cutoff dates.

### Negative controls
Any trained statistical model must include:
- shuffled-target control;
- random/noise-feature control;
- simple baseline comparison.

If nonsense controls perform similarly to the real model, stop and investigate leakage/evaluation failure.

## Required release report

Before FM-S begins, create a machine-readable and human-readable quality report containing at least:

- source integrity status;
- current-player identity status;
- duplicate counts/resolution;
- fixture coverage by season;
- player-match coverage where used;
- missingness table;
- cross-source reconciliation warnings;
- temporal leakage violations;
- target leakage violations;
- split-overlap violations;
- component DQ scores;
- overall DQ score;
- `AUCTION_POOL_READY` YES/NO;
- `MODEL_READY` YES/NO;
- exact blockers/warnings.

FM-S may begin only when `MODEL_READY = YES`.
