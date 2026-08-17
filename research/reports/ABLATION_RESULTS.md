# Phase 5 ablation results

Values are development means from a fixed HistGradientBoosting model. `FULL` is FPL base + expected + ICT + form + team context + bookmaker. Positive interpretation requires consistency across ranking and error metrics; a sophisticated family is not retained solely because it sounds useful.

| Task | Full NDCG@25 | −Expected | −ICT | −Form | −Team context | −Bookmaker |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Draft | 0.706 | 0.710 | 0.663 | 0.741 | 0.680 | 0.695 |
| Next 1 GW | 0.358 | 0.350 | 0.358 | 0.335 | 0.360 | 0.361 |
| Next 3 GWs | 0.514 | 0.512 | 0.524 | 0.483 | 0.514 | 0.515 |
| Next 5 GWs | 0.571 | 0.565 | 0.574 | 0.537 | 0.564 | 0.567 |

Conclusions:

- FORM is consistently important in-season but harmful for draft-day when appended to the full configuration.
- ICT supplies useful draft-day rank information, while its in-season value overlaps other families.
- Expected statistics improve some horizons and dominate permutation importance, but fixed-model ablations show overlap rather than universal gain.
- Team and bookmaker context are useful together for draft-day development; each alone is unstable.
- Bookmaker context is not justified in-season because removal is neutral or slightly beneficial.
- Understat source comparisons were effectively neutral and it lacks locked-holdout coverage, so it is not selected.

The complete per-fold values are in `feature_ablation_results.csv`; incremental additions are in `feature_family_results.csv`.
