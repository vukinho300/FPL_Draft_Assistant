# Phase 5B leakage audit

This audit applies after the Phase 5A source gate. The current required-source status is **PASS WITH EXCLUSIONS** with no blocking failure. All evidence is offline research; no model or score is integrated into the application.

## 1. Prediction cutoff semantics

For an in-season sample “after GW `t`” means every quality-approved player-fixture observation assigned to events `<= t` has been incorporated and `prediction_cutoff` is the latest actual kickoff among those observations. A target may use labels `t < GW <= t+h` only when its actual kickoff is strictly after that cutoff. This preserves Double Gameweek rows, treats Blank Gameweeks as empty target intervals, and excludes a postponed/rescheduled future-labelled fixture if its actual timestamp is already at or before the cutoff.

For a league-wide blank target interval, there is no fixture timestamp. The dataset records `target_has_observations = false` and uses the first instant strictly after the cutoff as an explicit empty-interval sentinel; it does not invent a match event.

## 2. Feature timestamp contract

Every sample exposes `prediction_cutoff`, `feature_max_timestamp`, `target_start_timestamp`, and `target_end_timestamp`. Blocking invariants are:

```text
feature_max_timestamp <= prediction_cutoff
prediction_cutoff < target_start_timestamp <= target_end_timestamp
```

All 402,163 rows in the 23 rebuilt datasets pass. Temporal violations: **0**. Unit canaries reject a GW11 feature timestamp at a GW10 cutoff and accept equality at the cutoff.

## 3. Rolling-window validation

In-season `last3_points`, `last3_minutes`, `last5_points`, `last5_minutes`, `last5_points_per_appearance`, cumulative points/minutes/starts, and shrunk points-per-90 use only `GW <= t`. Tiny fixtures prove cutoff GW5 yields last-three GWs 3–5 and last-five GWs 1–5 while a large GW6 value appears only in the target. Draft last-three/last-five values come only from the completed prior season.

## 4. Draft-day temporal validation

To predict target season `S`, the player universe is the pre-kickoff GW1 registration snapshot, predictive football statistics come only from season `S-1`, prior-team/bookmaker context comes only from completed matches in `S-1`, and Understat—where benchmarkable—uses `S-1` only. The prediction cutoff is one nanosecond before the target season’s first archived kickoff. Target-season GW1 output and final records are never predictors.

## 5. Target leakage

Targets are retained only as `target` for fitting/evaluation. The allowlist cannot contain `target`, `prediction`, `next_1_gameweek_points`, `next_3_gameweek_points`, `next_5_gameweek_points`, or `upcoming_season_total_points`. Naming-pattern guards also reject future-, target-, and final-season classes. A future-feature canary fails before estimator fitting.

The Phase 5A hardening also requires every raw `GW` to be a finite integer in `1..38`; `1.5`, `10.2`, and `37.9` are rejected. Historical fractional-gameweek violations: **0**, so legitimate benchmark rows and metrics did not change.

## 6. Forbidden features

Formal forbidden classes cover targets/outcomes, future values, final-season information, evaluation metadata, stable sample keys, and entity identifiers. Exact identifier blocks include `code`, `element`, `fixture`, `id`, `name`, `understat_id`, `sample_key`, `team`, and `prior_team`. Regex canaries also catch player/fixture/source ID forms. The registry is enforced in `model_safety.py` before every fit.

## 7. Model-input manifests

Every fit receives an immutable manifest containing task, horizon, model, numeric features, categorical features, metadata-only columns, and forbidden columns. The estimator input sequences must exactly equal the declared sequences. Development persisted **54** unique manifests; selected sanity controls persisted **4**. Undeclared, duplicate, or forbidden predictors are blocking.

## 8. Train/test overlap

Stable keys are `(season, code)` for draft-day and `(season, code, cutoff_gw, horizon)` for in-season. All eight development folds and all four 2025/26 re-evaluations are chronological with overlap **0**. Latest negative-control folds contain:

| Task | Train | Test | Overlap |
| --- | ---: | ---: | ---: |
| Draft 2024/25 | 1,785 | 616 | 0 |
| In-season 5-GW 2024/25 | 80,144 | 20,822 | 0 |

Repeated players across different seasons/cutoffs remain legitimate distinct observations.

## 9. Duplicate target observations

Before every audited split, row count must equal unique sample-key count. All 23 processed artifacts pass; duplicate modeling observations: **0**. The Phase 5A join-explosion canary separately proves row-multiplying one-to-many joins are blocked.

## 10. Preprocessing leakage

Numeric median imputation and optional scaling, plus categorical mode imputation and one-hot vocabulary, live inside scikit-learn `Pipeline`/`ColumnTransformer`. `fit` receives training rows only; evaluation rows are transformed afterward. A deterministic extreme-test-value canary confirms the training median remains `1.0` despite test value `1000`, and an unseen category is handled without refitting.

Model hyperparameters and position handling remain the original development-selected configuration. Phase 5B did not tune against 2025/26.

## 11. Identity/ID memorization

FPL code, element/player IDs, names, Understat IDs, fixture IDs, source IDs, and sample keys are metadata only. They are not numeric or categorical predictors in any persisted manifest. `position` and draft `cold_start_category` are the only categorical predictors in the selected models.

## 12. Missingness timing

`history_missing`, `low_minutes`, expected/ICT missingness, and Understat missingness are derived only from sources at or before the cutoff. Draft cold-start categories use prior-season player history and the pre-target-season registered team; later target-season performance, transfers, exits, or availability do not determine them. Missing source fields remain missing until training-fold imputation and are never rewritten globally as zero.

Team and bookmaker features summarize only completed matches strictly before `cutoff_time`; future target-fixture odds are not used. Understat uses prior season for draft and match dates at/before the in-season cutoff. Day-level Understat timestamps remain a documented limitation.

## 13. Holdout freeze verification

`final_holdout_candidate.json` retains status `SELECTED BEFORE HOLDOUT`, config SHA-256 `f3357fe2f7762efebe0dbf84dce6eb101def5404375f666042bd20c2b615a5dd`, development-results SHA-256 `c17d9d9c528beca782bbdb43ef5aa9a281751f28845e9c4ce3274e998708257f`, selection timestamp `2026-08-17T15:35:30.731969+00:00`, and locked season `2025-26`. Its self-hash is recomputed before use. The development digest was reproduced exactly from the five pre-holdout CSV artifacts in baseline commit `bf5bc2c278b4138caade3251528bd10216ee9b5d`, accounting for their original Windows CSV line endings.

2025/26 has already been observed. Any Phase 5C model must call it a **previously exposed external benchmark**, not an untouched holdout. Truly prospective validation requires unseen 2026/27 data.

## 14. Negative-control results

Fixed seed `20250817` shuffles training targets within season and position.

| Task | Run | MAE | RMSE | Spearman | NDCG@25 |
| --- | --- | ---: | ---: | ---: | ---: |
| Draft | Real | 31.073423 | 41.463734 | 0.587206 | 0.806685 |
| Draft | Shuffled | 43.873538 | 55.554009 | -0.182284 | 0.213094 |
| In-season 5-GW | Real | 3.714639 | 5.903702 | 0.755674 | 0.637089 |
| In-season 5-GW | Shuffled | 6.284462 | 8.197077 | -0.013431 | 0.430817 |

Real signal materially exceeds both shuffled controls. A deterministic random feature changes NDCG@25 by `-0.000086` draft and `-0.000013` in-season, with no stable apparent value.

## 15. Metric validation

Deterministic tests cover perfect numeric prediction, perfect/reverse/partial/tied/constant ranking, `K` above eligible count, MAE, RMSE, Spearman, NDCG, and Top-K recall. Draft ranking groups by season. In-season ranking groups by season plus cutoff GW, never one giant cross-cutoff list. Six-manager tests independently validate GK 12, DEF 30, MID 30, and FWD 18 for perfect, reverse, and partial rankings.

## 16. Suspicious-performance investigation

The review compares simple baselines, alternative families, separate 2023/24 and 2024/25 folds, per-position results, train/development gaps, shuffled targets, and random features. No target-derived predictor, future timestamp, overlap, duplicate sample, join multiplication, identity predictor, test-fitted preprocessing, or ranking-group error was found. Real controls collapse as expected and train NDCG does not suspiciously exceed development. `SUSPICIOUS_PERFORMANCE_REVIEW_REQUIRED` is **false**.

## 17. Remaining uncertainty

Archived GW files are post-event extracts rather than deadline snapshots, so mutable availability, transfers, selection, FDR, and future closing odds remain excluded. Understat dates have day rather than capture-time precision and source coverage exclusions remain. 2025/26 contains scoring/field changes that can cause genuine distribution shift. Feature importance is diagnostic, non-causal, and unstable among correlated signals. No result authorizes a production model, Best Fit score, or new source integration.

LEAKAGE STATUS = PASS
