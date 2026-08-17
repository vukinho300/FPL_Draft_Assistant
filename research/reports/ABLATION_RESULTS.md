# Phase 5A quality-corrected ablation results

Values are corrected development means from a fixed HistGradientBoosting model. `FULL` is FPL base + expected + ICT + form + team context + bookmaker. A family is not retained solely because it sounds useful.

| Task | Full NDCG@25 | −Expected | −ICT | −Form | −Team context | −Bookmaker |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Draft | 0.677399 | 0.694480 | 0.697933 | 0.691724 | 0.718764 | 0.670573 |
| Next 1 GW | 0.361078 | 0.366006 | 0.365268 | 0.328587 | 0.364852 | 0.374178 |
| Next 3 GWs | 0.529356 | 0.517354 | 0.528691 | 0.498161 | 0.524660 | 0.531326 |
| Next 5 GWs | 0.580359 | 0.574712 | 0.590187 | 0.570981 | 0.584607 | 0.586429 |

Conclusions:

- FORM remains consistently important in-season.
- Expected and ICT families overlap; neither has universal isolated lift in a fixed nonlinear model.
- Team/bookmaker context is unstable. The source-combination comparison now has draft FPL-only slightly ahead of the full external-data configuration.
- In-season Understat ablations are not treated as trustworthy evidence because 2020/21 has no player-level archive; affected rows are quality-blocked.
- The complete per-fold corrected values and `blocked_by_data_quality` statuses are in the CSV result tables.
