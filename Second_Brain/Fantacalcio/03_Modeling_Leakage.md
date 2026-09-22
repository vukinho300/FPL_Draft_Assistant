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
