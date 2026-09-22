# FM-S projection release

Release: `fms-2026-09-22-b87cf673a837`. Input: `fd2qa-2026-09-22-c8ce1b1e8b5f`.
Data as of 2026-09-22T15:27:24.030803+00:00. Selected model: **shrink_k30**.

Projection unit: remaining source fantavoto-sum proxy. No auction credits.

## Validation comparisons

| Model | Total proxy MAE | PV MAE | FM weighted MAE | Spearman | Top-50 recall |
|---|---:|---:|---:|---:|---:|
| naive_prior | 56.6650 | 8.9505 | 0.3095 | 0.5114 | 0.400 |
| ridge_a10 | 56.0703 | 8.9188 | 0.3072 | 0.5067 | 0.380 |
| shrink_k15 | 55.9791 | 8.8699 | 0.3158 | 0.5121 | 0.400 |
| shrink_k30 | 55.9536 | 8.8699 | 0.3414 | 0.5125 | 0.380 |
| shrink_k5 | 55.9874 | 8.8699 | 0.3036 | 0.5103 | 0.400 |

Train targets 2022/23–2023/24 (876); validation 2024/25 (424); final holdout 2025/26 (435). Only certified previous-season events enter features. MV/FM are target outcomes, never previous-season inputs.

## Frozen-selection final holdout

Selected: {"FM_weighted_mae": 0.33092708565981277, "PV_mae": 8.985058417292622, "n": 435, "rated_n": 364, "spearman": 0.5159124836880598, "top50_recall": 0.26, "total_proxy_mae": 56.11410397261667, "total_proxy_rmse": 68.55157016951635}

Naive reference: {"FM_weighted_mae": 0.3359495036165021, "PV_mae": 8.875862068965517, "n": 435, "rated_n": 364, "spearman": 0.5163010897741155, "top50_recall": 0.32, "total_proxy_mae": 55.74320424250165, "total_proxy_rmse": 77.01280237948797}

Validation-derived 80% error-band coverage on holdout: 0.7793. No selection change followed the holdout result.

## Negative controls (validation only)

- random_feature_columns: 20 repeats; median total MAE 70.5042; median Spearman -0.0106; 95th-percentile Spearman 0.0449.
- shuffled_training_targets: 20 repeats; median total MAE 70.1724; median Spearman 0.0733; 95th-percentile Spearman 0.3898.
- shuffled_validation_outcomes: 20 repeats; median total MAE 76.0969; median Spearman 0.0142; 95th-percentile Spearman 0.0828.

Control gate passed: True.
Shuffling training labels cannot erase a fixed prior-PV rule; outcome-pairing and noise controls test that rule.

## Current forecast and uncertainty

All 534 selectable players ranked within position and overall. Missing previous-season row: 171. Confidence: {'LOW': 306, 'MEDIUM': 228}.
Availability prior strength: 2.0000 equivalent opportunities; production prior strength: 30 rated appearances.
Current PV updates expected participation with beta-style shrinkage. Current FM updates production by rated-appearance exposure. MV and market quotations/FVM are output-only descriptive evidence/benchmarks.
A fixed selected model is refit on all 1,735 completed historical samples after final holdout evaluation. The current update is not included in historical full-season metrics.

## Limitations

- RETROSPECTIVE_SOURCE_REVISION_RISK
- PV measures rated appearances, not minutes/starts or medical availability.
- PV times rounded FM is an approximate source fantasy total, not exact league points.
- Clean-sheet bonus and defense modifier are unmodeled; current MV is descriptive evidence only.
- The baseline event signal omits own-goal penalties because their league coefficient was not established in the scoped rules; source FM is the observed target.
- Historical evaluation is conditional on a player existing in both adjacent source seasons; exits and cold starts are not validated.
- Five elapsed/33 remaining opportunities are a source-PV proxy, not verified per-team fixtures or transfer exposure.
- Current shrinkage is explicit but cannot be historically validated within-season from season aggregates.
- Intervals use validation residuals and heuristic current scaling; they are not calibrated live probabilities.
- No verified injuries, starts, minutes or tactical/set-piece evidence; role/club only label and rank outputs.
- Overall rank is contribution order, not positional scarcity, lineup utility or auction credit value.
- Source data and derived predictions remain local; product reuse rights unresolved.

## Reproducibility and safety

Selection SHA-256: `30a59dafd7937be276a95fc7410e84756607e994c8beada094876e68142bc16a`. Input checksums, model/protocol hashes and deterministic seeds are pinned. No app, Supabase or Second Brain mutation.
Player-level projections, evaluation rows and model parameters remain in ignored local release storage. Only authored code/protocol and aggregate reports are committed.
