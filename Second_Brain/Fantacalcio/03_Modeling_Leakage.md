# Fantacalcio — Modelling and Leakage

## Prediction target

Rank/value players by their realistic expected Fantacalcio contribution **from the prediction date through the remainder of the current season**, under the league's exact scoring rules.

Do not optimize historical reputation or short-term form in isolation.

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
- scarcity;
- risk;
- confidence.

Player explanations must be grounded in actual features/evidence rather than generic generated prose.

Avoid unsupported precision, especially for injury risk and uncertain new signings.
