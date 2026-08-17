# Phase 5 leakage audit

Leakage is treated as a blocking error. All development choices were made on 2023/24 and 2024/25 chronological folds. `final_holdout_candidate.json` was written with a digest of the development tables before 2025/26 targets were built or evaluated.

## Feature timestamp rules

| Family | Maximum information time | Target begins | Why safe |
| --- | --- | --- | --- |
| Draft FPL history | End of prior season | Target season GW1 | Only immediately prior-season rows are aggregated |
| In-season FPL history | End of GW `t` | GW `t+1` | Filters are `GW <= t`; regression tests inject a large future value and prove exclusion |
| Form | End of GW `t` | GW `t+1` | Windows select only labels in `(t-window, t]` |
| Understat | Match date at/before cutoff | After cutoff | Date filter is `date <= cutoff_time`; exact identity only |
| Team results/shots | Match date strictly before cutoff | After cutoff | Future or same-cutoff matches are not included by `team_features_before` |
| Bookmaker market | Odds attached to already-completed prior matches | After cutoff | No future-fixture closing odds are exposed, avoiding unknown capture/deadline timing |
| Elo helper | Latest rating date at/before cutoff | After cutoff | `merge_asof(..., direction='backward')` plus assertion; ClubElo was unavailable and not benchmarked |

## Explicit exclusions

- Vaastav `xP`: the source warns it may be updated post-match and contain lookahead.
- End-of-season `players_raw`/`cleaned_players` performance values as preseason or midseason features.
- Target-season GW1 performance in the draft-day task.
- Current-season final totals at earlier in-season cutoffs.
- Closing odds for a future target match, because capture time relative to the FPL deadline is not recorded.
- Mutable official FDR and availability fields without historical snapshots.
- Future team information to resolve ambiguous player identity.
- 2025/26 defensive fields in development model selection.

## Split and preprocessing safeguards

There is no random train/test split. Development fold 1 trains on seasons through 2022/23 and tests 2023/24; fold 2 trains through 2023/24 and tests 2024/25. The final fit trains through 2024/25 and tests locked 2025/26. Imputation, one-hot categories and Ridge scaling are fitted inside each training pipeline. Ranking metrics are computed within a draft season or within each in-season cutoff, then averaged.

## Holdout evidence

The frozen config has status `SELECTED BEFORE HOLDOUT`, a SHA-256 of all development result files and its own config digest. `build_dataset --include-holdout` refuses to run unless that config exists. Retrospective 2025/26 alternatives are labelled `RETROSPECTIVE; NOT USED TO CHANGE WINNER` and do not replace the selected result.

## Known limitations

GW files are post-GW extracts rather than snapshots captured precisely at the deadline. This prevents reliable use of mutable availability, FDR, selection and transfer fields. Understat dates have day precision rather than capture timestamps. Those limitations are handled by excluding uncertain features rather than asserting precision the archives do not provide.
