# Phase 5 benchmark results

All numbers below are generated from real archived data, not fixtures. Development values are means over the 2023/24 and 2024/25 chronological folds. The final column set/model was frozen before 2025/26 evaluation.

## Executive result

Ridge was the best development ranking model at every horizon. The frozen candidate uses position-specific Ridge models. Draft-day retains prior-match bookmaker/team context because it produced a meaningful development NDCG@25 lift; in-season uses FPL-only signals because bookmaker and Understat gains were inconsistent and operationally unjustified.

| Task | Selected development NDCG@25 | Development Spearman | Development RMSE | 2025/26 NDCG@25 | 2025/26 Spearman | 2025/26 RMSE |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Draft season total | 0.763 | 0.554 | 41.208 | 0.532 | 0.595 | 44.629 |
| Next 1 GW | 0.393 | 0.656 | 2.005 | 0.351 | 0.694 | 1.985 |
| Next 3 GWs | 0.568 | 0.734 | 4.061 | 0.509 | 0.766 | 4.046 |
| Next 5 GWs | 0.631 | 0.753 | 5.911 | 0.567 | 0.783 | 5.926 |

## 1. Best FPL-only model

Position-specific Ridge with FPL base, expected, ICT and rolling-form families was strongest for all in-season horizons. Development NDCG@25 was 0.393/0.568/0.631 for 1/3/5 GWs.

## 2. Best FPL plus external-data model

For draft-day value, position-specific Ridge using FPL base/expected/ICT plus prior completed-match team context and market strength reached development NDCG@25 0.763. Understat was not holdout-capable.

## 3. Best source combination

With fixed HistGradientBoosting parameters, draft FPL+bookmaker scored NDCG@25 0.706 versus 0.678 FPL-only. In-season results were inconsistent: FPL-only led at 1 GW (0.364 versus 0.358) and 5 GWs (0.579 versus 0.571); FPL+bookmaker led by only 0.001 at 3 GWs. The production-minded winner is therefore bookmaker-enhanced draft-day and FPL-only in-season.

## 4. Best model family

On the holdout-capable full development features, pooled Ridge had NDCG@25 0.732/0.387/0.553/0.617 for draft/1/3/5, higher than Random Forest (0.693/0.371/0.506/0.559) and fixed boosting (0.706/0.358/0.514/0.571). XGBoost was not used: the required linear and tree suites already established a stable winner without another compiled dependency.

## 5–7. Best 1/3/5-GW configurations

All three use FPL base, native expected values, ICT and rolling form with position-specific Ridge. The longer horizons rank more reliably than one GW because single-match points are noisier.

## 8. Best draft-day configuration

FPL prior-season base/expected/ICT plus completed prior-season team shot/goal context and overround-normalized bookmaker market strength; FORM was removed because its ablation improved development NDCG. Separate Ridge models are fitted for GK/DEF/MID/FWD.

## 9. Best by position

On 2025/26, selected-model position NDCG@25 was 0.682 GK, 0.679 DEF, 0.672 MID and 0.590 FWD for draft-day. At the 5-GW horizon it was 0.835 GK, 0.621 DEF, 0.619 MID and 0.768 FWD. Forward draft-day value remains the weakest position result.

## 10. External source adding most value

Football-Data bookmaker/team context added the clearest development value for draft-day ranking (+0.028 NDCG@25 over FPL-only under the fixed source-comparison model). It did not consistently add in-season value.

## 11. Source adding almost no value

Understat did not produce a stable incremental gain over modern native FPL expected data: development NDCG@25 changed from FPL-only 0.678/0.364/0.513/0.579 to 0.673/0.365/0.513/0.577. Its incomplete exact identity coverage and missing 2025/26 data further weaken the case.

## 12. Feature families that mattered

Rolling form was essential in-season: removing it reduced NDCG@25 by about 0.023, 0.031 and 0.034 for 1/3/5 GWs under the fixed ablation model. Permutation analysis highlighted cumulative expected goal involvement, recent minutes and BPS. Draft permutation importance emphasized prior expected assists/xGI, starts and BPS.

## 13. Redundant or unstable families

Native expected and ICT families were not uniformly additive in every fixed boosting ablation, reflecting overlap. Understat largely duplicated native expected data. Bookmaker context was redundant in-season. Draft final-five-GW form was harmful in the selected development comparison.

## 14. Locked 2025/26 result

The selected draft ranking degraded from development NDCG@25 0.763 to 0.532, although Spearman increased to 0.595. The 2025/26 scoring regime added defensive contributions and changed assists/BPS, so early-draft top-K ordering shifted more than global ordering. In-season Spearman improved at all horizons and RMSE remained close to development.

## 15. Cold-start weakness

Of 690 2025/26 draft-universe players, 512 were returning by stable code, 100 were classified as promoted-club cold starts and 78 as unknown cold starts. Promoted-club players had Spearman 0.002 versus 0.650 for returning players, the clearest unresolved weakness. The source set cannot responsibly distinguish all foreign signings, academy players and long absences.

## 16. Recommended production inputs

Research supports native FPL points/minutes/starts/BPS, expected statistics, ICT and rolling 3/5-GW form for future in-season enrichment. Prior-match market/team context is a research candidate for preseason ranking, but should not block a production release. No prediction model or Best Fit score is integrated into the app in Phase 5.

## Baselines

Previous-season total and points-per-90/minutes baselines achieved draft NDCG@25 0.702 and 0.705. The minutes-adjusted in-season baseline achieved 0.370/0.533/0.599 for 1/3/5 GWs. The selected models improved ranking modestly and RMSE materially, but not enough to erase top-K uncertainty.

## Retrospective holdout comparison

Retrospectively, position-specific boosting produced the best draft NDCG@25 (0.588) versus the preselected 0.532, while Ridge generally remained strongest on in-season NDCG. This is reported only as model-risk evidence. The winner was not changed after viewing 2025/26.
