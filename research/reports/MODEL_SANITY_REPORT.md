# Phase 5B model sanity report

Generated at `2026-08-17T19:05:26.234376+00:00` from quality-gated historical datasets. This is offline validation evidence, not a production model or Best Fit implementation.

## Current selected models

These remain the original pre-2025/26 frozen choices; Phase 5B did not retune them.

| Task | Model | Position handling | Feature groups |
| --- | --- | --- | --- |
| draft_day | ridge | position_specific | FPL_BASE, FPL_EXPECTED, FPL_ICT, TEAM_CONTEXT, BOOKMAKER |
| inseason_h1 | ridge | position_specific | FPL_BASE, FPL_EXPECTED, FPL_ICT, FORM |
| inseason_h3 | ridge | position_specific | FPL_BASE, FPL_EXPECTED, FPL_ICT, FORM |
| inseason_h5 | ridge | position_specific | FPL_BASE, FPL_EXPECTED, FPL_ICT, FORM |

## Baseline and shuffled-target comparison

The fixed-seed shuffled control permutes training targets within season and position. Evaluation features and targets remain unchanged.

| Task | Run | MAE | RMSE | Spearman | NDCG@25 |
| --- | --- | ---: | ---: | ---: | ---: |
| draft_day | real | 31.073423 | 41.463734 | 0.587206 | 0.806685 |
| draft_day | shuffled target | 43.873538 | 55.554009 | -0.182284 | 0.213094 |
| draft_day | best simple baseline: previous_season_pp90_minutes | 30.461926 | 43.601565 | 0.557124 | 0.713113 |
| inseason_h5 | real | 3.714639 | 5.903702 | 0.755674 | 0.637089 |
| inseason_h5 | shuffled target | 6.284462 | 8.197077 | -0.013431 | 0.430817 |
| inseason_h5 | best simple baseline: minutes_adjusted_points_rate | 3.478135 | 6.061871 | 0.794951 | 0.638171 |

Real rankings materially exceed their shuffled controls. The draft model's best simple baseline remains competitive. For five-GW prediction, the minutes-adjusted baseline is slightly stronger on NDCG@25 and Spearman while Ridge has slightly lower RMSE. Complexity is therefore not automatically preferred.

## Training versus development and random-feature controls

| Task | Train NDCG@25 | Development NDCG@25 | Train - development | Random-feature delta |
| --- | ---: | ---: | ---: | ---: |
| draft_day | 0.792142 | 0.806685 | -0.014542 | -8.6e-05 |
| inseason_h5 | 0.628044 | 0.637089 | -0.009044 | -1.3e-05 |

The deterministic Gaussian feature changes NDCG@25 by less than 0.0001 in both controls and does not appear as stable useful signal. Training does not show a suspicious advantage over the latest chronological fold.

## Metric validation

Tiny deterministic tests cover exact MAE/RMSE, perfect and reverse Spearman, NDCG, partial and tied rankings, constant predictions, Top-K with `K` above eligibility, and decision-moment grouping. NDCG relevance is nonnegative observed target points. Draft rankings group by season; in-season rankings group by season plus cutoff GW. Missing targets are not scored: the feature builder creates explicit zero targets for eligible players with no appearance.

## Six-manager Draft metric validation

Independent synthetic tests prove position isolation and perfect, reverse, and 50%-correct rankings for GK 12, DEF 30, MID 30, and FWD 18. Latest draft-fold evidence:

| Position | Demand | Eligible | Recall | NDCG | Spearman |
| --- | ---: | ---: | ---: | ---: | ---: |
| GK | 12 | 66 | 0.5 | 0.758998 | 0.482535 |
| DEF | 30 | 203 | 0.433333 | 0.748178 | 0.543842 |
| MID | 30 | 276 | 0.433333 | 0.782723 | 0.641174 |
| FWD | 18 | 71 | 0.611111 | 0.767096 | 0.542706 |

## Season stability

| Task | Evaluation season | RMSE | Spearman | NDCG@25 | Classification |
| --- | --- | ---: | ---: | ---: | --- |
| draft_day | 2023-24 | 40.982448 | 0.514713 | 0.720167 | MIXED |
| draft_day | 2024-25 | 41.463734 | 0.587206 | 0.806685 | MIXED |
| inseason_h5 | 2023-24 | 5.917884 | 0.749918 | 0.62542 | CONSISTENT |
| inseason_h5 | 2024-25 | 5.903702 | 0.755674 | 0.637089 | CONSISTENT |

Draft ranking improved in 2024/25 relative to 2023/24; this is mixed magnitude rather than proof of a uniformly stable effect. Five-GW in-season results are consistent across the two development seasons.

## Position stability

| Task | Position | Samples | RMSE | Spearman | NDCG@25 |
| --- | --- | ---: | ---: | ---: | ---: |
| draft_day | DEF | 203 | 35.354458 | 0.543842 | 0.747077 |
| draft_day | FWD | 71 | 53.212976 | 0.542706 | 0.729539 |
| draft_day | GK | 66 | 43.244687 | 0.482535 | 0.743288 |
| draft_day | MID | 276 | 41.739504 | 0.641174 | 0.786305 |
| inseason_h5 | DEF | 6982 | 5.575737 | 0.698202 | 0.611249 |
| inseason_h5 | FWD | 2292 | 7.07844 | 0.801706 | 0.776746 |
| inseason_h5 | GK | 2188 | 5.428118 | 0.70216 | 0.789119 |
| inseason_h5 | MID | 9360 | 5.931897 | 0.815488 | 0.696578 |

Position results differ materially, so no one position-independent football conclusion is inferred. These diagnostics do not implement production position-specific Best Fit.

## Suspicious-performance review

All audited splits have zero sample overlap, no duplicate target observations, strict chronology, declared estimator inputs, and train-only preprocessing. Real models beat shuffled controls across MAE, RMSE, Spearman, and NDCG@25; random features are neutral; train/development gaps are not suspicious. Flags: **none**. Warnings: **none**.

## Holdout terminology and limitations

The frozen config hash is `f3357fe2f7762efebe0dbf84dce6eb101def5404375f666042bd20c2b615a5dd` and its development digest is `c17d9d9c528beca782bbdb43ef5aa9a281751f28845e9c4ce3274e998708257f`. The digest was reproduced from the five pre-holdout CSV artifacts in baseline commit `bf5bc2c278b4138caade3251528bd10216ee9b5d` (accounting for their original Windows CSV line endings). It was selected at `2026-08-17T15:35:30.731969+00:00`, before the recorded 2025/26 evaluation. Because 2025/26 has now been exposed, Phase 5C must call it a **previously exposed external benchmark**, never an untouched holdout. The first genuinely prospective validation requires unseen 2026/27 data.

2025/26 scoring and field changes are genuine distribution-shift candidates, but they do not excuse quality, temporal, or metric failures. Importance remains diagnostic: standardized Ridge coefficients and evaluation-set permutation importance are not causal, and correlated features may exchange importance.

No XGBoost, deep learning, production React code, Best Fit score, live model, player drafting, roster, health analysis, persistence, scraping, or new data source is introduced.

MODEL SANITY STATUS = PASS
