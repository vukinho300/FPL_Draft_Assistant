# FM-S: qualified event-window baseline projections

This research-local release separates expected rated appearances (PV) from production per rated
appearance (source FM). Its forecast is **remaining source fantavoto-sum proxy**, not exact league
points, lineup utility or auction value. Source FM is rounded; PV is not minutes or starts.

Historical features are the eleven FD2-QA2-certified prior-season event fields: PV, goals, assists,
yellow/red cards, goals conceded, penalties taken/scored/missed/saved and own goals. Event rates
divide counts by max(PV, 1). Prior MV/FM, market values, club, role and current snapshots cannot
enter the feature matrix. Target PV/FM are separate supervised outcomes. Targets with zero PV
have zero total proxy; missing FM for positive PV fails. Retrospective source revision risk remains.

## Small, fixed comparison

- Naive: persist prior PV; use prior net event rate plus an intercept fitted only on training labels.
- Shrinkage: fit a bounded affine PV regression and shrink prior net event rate toward its training
  population mean with k = 5, 15 or 30 rated appearances. The FM intercept uses target-PV weights.
- One fixed Ridge challenger (alpha 10), with separate PV/FM regressions and training-only scaling.
  It must improve validation MAE by at least 2% without materially worse rank correlation to replace
  the best baseline. There is no alpha search or model tournament.

The event signal uses goal +3, assist +1, yellow -0.5, red -1, conceded -1, missed penalty -3,
saved penalty +3. Converted penalties already count as goals. Own-goal penalties are omitted from
the baseline signal because a league coefficient was not established in the scoped rules; attempts,
converted penalties and own goals remain available to the rejected Ridge challenger. Clean sheets
and defense modifiers are unmodeled. No historical role is inferred from today's role.

Train: target 2022/23–2023/24 (876); validation: 2024/25 (424). Selection writes a content-addressed
immutable artifact before the holdout phase can run. That phase verifies input, protocol and model
code hashes, refits the fixed winner on 1,300 development samples, then evaluates 2025/26 (435).
Only after this final evaluation does the current forecast fit the same fixed configuration on all
1,735 completed samples. Holdout results never change selection or current-update strengths.

Selected k=30 improved validation MAE only modestly (55.954 versus 56.665 naive). Holdout MAE was
slightly worse than naive (56.114 versus 55.743), although RMSE was better (68.552 versus 77.013).
Holdout top-50 recall was only 26%. This release does not establish superiority over persistence.

Twenty seeded repetitions each of shuffled training targets, random/noise feature columns and
shuffled validation outcomes passed the predeclared control gate. All use validation only.

## Current 2026/27 update

Five elapsed opportunities come from the current PV envelope, **not verified team fixtures**;
33 opportunities remain. The update is explicit:

```
p = (a * prior_full_season_PV / 38 + current_PV) / (a + 5)
remaining_PV = 33 * p
FM = (k * prior_FM + current_PV * current_FM) / (k + current_PV)
projection = remaining_PV * FM
```

When current PV=0, use prior FM. Training residual moments set a=2, at the predeclared lower bound;
current exposure therefore receives 71.43% of the availability estimate. Validation selects k=30,
so five rated appearances receive at most 14.29% of the production estimate. Reusing season-level
shrinkage for in-season updates is an approximation that these aggregate data cannot backtest.
Do not interpret the appearance estimate as calibrated injury or starter probability.

The 171 players without a previous-season row receive population priors. Historical evaluation
conditions on adjacent-season presence and does not validate cold starts or league exits. There
are 306 LOW and 228 MEDIUM confidence labels. Bands use validation's 80th-percentile absolute error,
scaled by 33/38 and widened 1.5x for absent prior rows or 1.25x for prior PV<10. These are heuristic
live bands, not calibrated probabilities; the unscaled band covered 77.93% of holdout outcomes.

Current MV is descriptive only; FVM and quotation are benchmarks only. Club and role label outputs
and partition position ranks. No injuries, tactical evidence or market values influence predictions.

## Reproduce and inspect

Install `modelling/requirements.txt` in the research Python environment, alongside the data pipeline
requirements. Run from the repository root with the preserved local input release:

```powershell
python -B -m research.fantacalcio.modelling.experiment select --input-release research/fantacalcio/releases/fd2qa-2026-09-22-c8ce1b1e8b5f --output-root research/fantacalcio/releases --reports research/fantacalcio/reports
python -B -m research.fantacalcio.modelling.experiment release --input-release research/fantacalcio/releases/fd2qa-2026-09-22-c8ce1b1e8b5f --selection research/fantacalcio/releases/fms-selection-30a59dafd793/selection.json --output-root research/fantacalcio/releases --reports research/fantacalcio/reports
```

The second command reproduces an already evaluated holdout; it does not create a fresh untouched
test set. Never change the selection after inspecting its result. Existing release bytes are immutable.

Release `fms-2026-09-22-b87cf673a837` contains projections CSV/JSON, parameters, frozen selection,
holdout rows, evaluation, manifest and checksums. It covers exactly all 534 current players with
identity, role/club, ranks, uncertainty and components. Player-level data and parameters remain in
ignored local storage; rights for redistribution/product reuse are unresolved. Only authored code,
protocol and aggregate reports enter Git. No app, Supabase, prices or Second Brain changes.
