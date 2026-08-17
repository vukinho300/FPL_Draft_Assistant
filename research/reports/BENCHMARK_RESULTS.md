# Phase 5/5A/5B benchmark results

All numbers are generated from real archived data, not fixtures. Phase 5A rebuilt every dataset after the blocking quality gate, reran the chronological development benchmark, and reevaluated the original frozen Phase 5 candidate on 2025/26. It did not retune after the holdout had already been observed.

Phase 5B rebuilt and reran the benchmark through explicit temporal contracts, feature manifests, sample-key uniqueness, zero-overlap chronological splits and train-only preprocessing. No historical row violated the new integer-GW or actual-chronology invariants, so benchmark values below are unchanged. Leakage status is **PASS** and model sanity status is **PASS**; real-target results materially outperform fixed-seed shuffled controls.

## Executive result

The selected holdout metrics changed slightly after explicit duplicate removal, position/grain corrections, and exact team-name reconciliation. Ranking conclusions for FPL-only in-season signals remain broadly stable. The earlier claim that Football-Data improved draft-day HGB ranking does **not** survive the corrected run.

| Task | Original selected NDCG@25 | Corrected NDCG@25 | Corrected Spearman | Corrected RMSE |
| --- | ---: | ---: | ---: | ---: |
| Draft season total | 0.532190 | 0.531499 | 0.599461 | 44.444999 |
| Next 1 GW | 0.351209 | 0.354837 | 0.693860 | 1.979168 |
| Next 3 GWs | 0.508978 | 0.514533 | 0.765676 | 4.032058 |
| Next 5 GWs | 0.566848 | 0.570456 | 0.783200 | 5.912731 |

Exact deltas and the baseline commit are in `quality_gate_benchmark_comparison.csv`.

## Corrected development evidence

The original frozen configuration remains position-specific Ridge. Its corrected development means are:

| Task | NDCG@25 | Spearman | RMSE |
| --- | ---: | ---: | ---: |
| Draft season total | 0.756598 | 0.564040 | 40.721512 |
| Next 1 GW | 0.390434 | 0.655513 | 2.002528 |
| Next 3 GWs | 0.569667 | 0.734067 | 4.046211 |
| Next 5 GWs | 0.635252 | 0.754441 | 5.875677 |

For one-GW development, pooled Ridge now scores NDCG@25 0.394454 versus 0.390434 position-specific. That sensitivity is reported rather than used to change the frozen candidate after holdout exposure.

## Source combinations

With fixed HistGradientBoosting parameters, corrected draft FPL-only NDCG@25 is 0.678141 and FPL+team/bookmaker is 0.677399. The old run reported 0.678 versus 0.706. The explicit `Man Utd`/`Man United` mapping filled a previously unmatched team-history path and removed the apparent lift. This materially changes the source conclusion even though final selected-model metrics moved little.

Corrected in-season FPL-only versus FPL+bookmaker NDCG@25 is:

- 1 GW: 0.367880 versus 0.361078
- 3 GWs: 0.525481 versus 0.529356
- 5 GWs: 0.592940 versus 0.580359

The 3-GW difference is small and not enough to justify an external production dependency. Understat-dependent in-season rows are `blocked_by_data_quality` because the 2020/21 archive has no player-level files. Draft Understat comparisons use only benchmarkable 2021/22–2024/25 source-seasons and remain weaker than FPL-only (0.672466 versus 0.678141).

## Model families

On the corrected holdout-capable full features, pooled model development NDCG@25 is:

| Task | Ridge | Random Forest | HGB | Tuned HGB |
| --- | ---: | ---: | ---: | ---: |
| Draft | 0.732333 | 0.685820 | 0.677399 | 0.689208 |
| 1 GW | 0.394454 | 0.371647 | 0.361078 | 0.380734 |
| 3 GWs | 0.566000 | 0.525401 | 0.529356 | 0.532743 |
| 5 GWs | 0.630687 | 0.572709 | 0.580359 | 0.596389 |

Ridge remains the strongest ranking family. XGBoost and deep learning remain unjustified additions.

## Feature and ablation conclusions

Rolling form remains essential in-season. Removing it reduces fixed-model NDCG@25 to 0.328587/0.498161/0.570981 at 1/3/5 GWs. Expected and ICT families overlap, so individual removals are not uniformly harmful. Team/bookmaker context is not consistently additive after the corrected mapping.

## Corrected holdout by position

Draft NDCG@25 is 0.695 GK, 0.682 DEF, 0.672 MID, and 0.610 FWD. Five-GW NDCG@25 is 0.835 GK, 0.621 DEF, 0.619 MID, and 0.774 FWD. Forward draft ranking remains the weakest broad position result despite its small correction.

## Cold-start weakness

The 690-player 2025/26 draft universe remains 512 returning players, 100 promoted-club players, and 78 unknown cold starts. Corrected Spearman is 0.656 for returning players, 0.356 for unknown players, and 0.002 for promoted-club players. The source set still cannot responsibly distinguish every new foreign signing, academy player, or long absence.

## Quality corrections and sample counts

- 2025/26: removed 10 excess exact player-fixture copies from merged GWs and 2 from the separate GW1 file.
- 2024/25: excluded 322 assistant-manager chip observations from football-player datasets.
- 2021/22: normalized 101 legacy `GKP` observations to the known goalkeeper label `GK`.
- Cross-source team identity: added exact aliases for `Man Utd` and `Sheffield Utd`; all 2,280 FPL/Football-Data fixtures now match on date, teams, and score.
- Understat: excluded team/generic directory files from player-match ingestion and blocked source-seasons with no player files.

Final selected holdout sample counts remain unchanged at 690 draft players and 26,059/24,381/22,719 in-season rows. The corrections changed features and target values, not the evaluation universe.

## Production interpretation

Research still supports verified native FPL points, minutes, starts, BPS, expected statistics, ICT, and rolling form as future enrichment facts. It no longer supports Football-Data/bookmaker context as an evidence-backed production addition. No prediction model, Best Fit score, player selection, roster, health analysis, or persistence is integrated into the application.

## Holdout limitation

2025/26 cannot become an untouched holdout again. The quality-corrected run is labelled a re-evaluation of the original frozen candidate, not a new pre-holdout selection. Any future model-choice change—such as pooled versus position-specific one-GW Ridge—needs a fresh prospective season.

For Phase 5C, 2025/26 must be described as a **previously exposed external benchmark**. The first genuinely prospective validation requires unseen 2026/27 data.
