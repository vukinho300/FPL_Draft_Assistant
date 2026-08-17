# Phase 5A data quality report

Generated from the pinned raw artifacts at `2026-08-17T16:50:34.605217+00:00`. The machine-readable evidence is `data_quality_results.json`. This gate runs before feature generation; a blocking failure prevents FPL or Football-Data inputs from entering the benchmark. Understat is optional and a failed/unavailable Understat season is excluded from configurations requiring it.

## Gate architecture

```text
RAW DATA
  -> SCHEMA -> GRAIN -> DUPLICATES -> REFERENTIAL INTEGRITY
  -> IDENTITY -> JOIN CARDINALITY -> MISSINGNESS / DISTRIBUTIONS
  -> TEMPORAL / LEAKAGE -> FEATURE DATASET -> MODEL
```

**Data-quality validation** decides whether data can be trusted and blocks unsafe inputs. **Data cleaning** is a declared transformation applied only after that decision. This run permits only exact-copy removal, the documented `GKP` -> `GK` label normalization, and exclusion of assistant-manager chip rows from the football-player grain.

Overall gate status: **PASS WITH EXCLUSIONS**. Manifest artifacts verified: 41/41.

## Dataset grain contracts

| Source | Dataset | Expected grain | Candidate key |
| --- | --- | --- | --- |
| Vaastav FPL | players_raw | one row per registered player-season | id |
| Vaastav FPL | gw1 | one row per registered player-fixture observation in GW1 | element, fixture |
| Vaastav FPL | merged_gw | one row per registered player-fixture observation | element, fixture |
| Vaastav FPL | fixtures | one row per league fixture | id |
| Vaastav FPL | teams | one row per team-season | id |
| Football-Data.co.uk | E0 match results and odds | one row per Premier League fixture | Date, HomeTeam, AwayTeam |
| Understat via Vaastav | player match files | one row per external player-match | external_player_id, id |

Player + GW is deliberately not a candidate key. Same-player/same-GW rows with different fixture IDs are valid Double Gameweek observations and remain. Same-player/same-fixture repetition is invalid.

## Duplicate audit

Counts below are excess copies beyond the first valid key row; the JSON also records all participating duplicate rows.

| Source | Season | Dataset | Raw rows | Exact excess | Logical-key excess | Conflicting groups |
| --- | --- | --- | ---: | ---: | ---: | ---: |
| Vaastav FPL | 2020-21 | players_raw | 713 | 0 | 0 | 0 |
| Vaastav FPL | 2020-21 | gw1 | 425 | 0 | 0 | 0 |
| Vaastav FPL | 2020-21 | merged_gw | 24365 | 0 | 0 | 0 |
| Vaastav FPL | 2020-21 | fixtures | 380 | 0 | 0 | 0 |
| Vaastav FPL | 2020-21 | teams | 20 | 0 | 0 | 0 |
| Football-Data.co.uk | 2020-21 | E0 match results and odds | 380 | 0 | 0 | 0 |
| Understat via Vaastav | 2020-21 | player match files | 0 | 0 | 0 | 0 |
| Vaastav FPL | 2021-22 | players_raw | 737 | 0 | 0 | 0 |
| Vaastav FPL | 2021-22 | gw1 | 554 | 0 | 0 | 0 |
| Vaastav FPL | 2021-22 | merged_gw | 25447 | 0 | 0 | 0 |
| Vaastav FPL | 2021-22 | fixtures | 380 | 0 | 0 | 0 |
| Vaastav FPL | 2021-22 | teams | 20 | 0 | 0 | 0 |
| Football-Data.co.uk | 2021-22 | E0 match results and odds | 380 | 0 | 0 | 0 |
| Understat via Vaastav | 2021-22 | player match files | 70102 | 0 | 0 | 0 |
| Vaastav FPL | 2022-23 | players_raw | 778 | 0 | 0 | 0 |
| Vaastav FPL | 2022-23 | gw1 | 573 | 0 | 0 | 0 |
| Vaastav FPL | 2022-23 | merged_gw | 26505 | 0 | 0 | 0 |
| Vaastav FPL | 2022-23 | fixtures | 380 | 0 | 0 | 0 |
| Vaastav FPL | 2022-23 | teams | 20 | 0 | 0 | 0 |
| Football-Data.co.uk | 2022-23 | E0 match results and odds | 380 | 0 | 0 | 0 |
| Understat via Vaastav | 2022-23 | player match files | 62319 | 0 | 0 | 0 |
| Vaastav FPL | 2023-24 | players_raw | 865 | 0 | 0 | 0 |
| Vaastav FPL | 2023-24 | gw1 | 658 | 0 | 0 | 0 |
| Vaastav FPL | 2023-24 | merged_gw | 29725 | 0 | 0 | 0 |
| Vaastav FPL | 2023-24 | fixtures | 380 | 0 | 0 | 0 |
| Vaastav FPL | 2023-24 | teams | 20 | 0 | 0 | 0 |
| Football-Data.co.uk | 2023-24 | E0 match results and odds | 380 | 0 | 0 | 0 |
| Understat via Vaastav | 2023-24 | player match files | 81900 | 0 | 0 | 0 |
| Vaastav FPL | 2024-25 | players_raw | 804 | 0 | 0 | 0 |
| Vaastav FPL | 2024-25 | gw1 | 616 | 0 | 0 | 0 |
| Vaastav FPL | 2024-25 | merged_gw | 27605 | 0 | 0 | 0 |
| Vaastav FPL | 2024-25 | fixtures | 380 | 0 | 0 | 0 |
| Vaastav FPL | 2024-25 | teams | 20 | 0 | 0 | 0 |
| Football-Data.co.uk | 2024-25 | E0 match results and odds | 380 | 0 | 0 | 0 |
| Understat via Vaastav | 2024-25 | player match files | 78718 | 0 | 0 | 0 |
| Vaastav FPL | 2025-26 | players_raw | 841 | 0 | 0 | 0 |
| Vaastav FPL | 2025-26 | gw1 | 692 | 2 | 2 | 0 |
| Vaastav FPL | 2025-26 | merged_gw | 29757 | 10 | 10 | 0 |
| Vaastav FPL | 2025-26 | fixtures | 380 | 0 | 0 | 0 |
| Vaastav FPL | 2025-26 | teams | 20 | 0 | 0 | 0 |
| Football-Data.co.uk | 2025-26 | E0 match results and odds | 380 | 0 | 0 | 0 |
| Understat via Vaastav | 2025-26 | player match files | 0 | 0 | 0 | 0 |

### Approved exclusions

- **Understat via Vaastav 2020-21 Understat directory**: 24 file(s) — team aggregate/generic CSV files are not player-match datasets and have no external player ID
- **Understat via Vaastav 2021-22 Understat directory**: 24 file(s) — team aggregate/generic CSV files are not player-match datasets and have no external player ID
- **Understat via Vaastav 2022-23 Understat directory**: 21 file(s) — team aggregate/generic CSV files are not player-match datasets and have no external player ID
- **Understat via Vaastav 2023-24 Understat directory**: 24 file(s) — team aggregate/generic CSV files are not player-match datasets and have no external player ID
- **Vaastav FPL 2024-25 merged_gw**: 322 row(s) — assistant-manager chip observations are outside the football-player benchmark scope
- **Understat via Vaastav 2024-25 Understat directory**: 24 file(s) — team aggregate/generic CSV files are not player-match datasets and have no external player ID
- **Vaastav FPL 2025-26 gw1**: 2 row(s) — exact duplicate player-fixture observations; one identical copy retained
- **Vaastav FPL 2025-26 merged_gw**: 10 row(s) — exact duplicate player-fixture observations; one identical copy retained

## Source-season status

| Source | Season | Status | Exact exclusions |
| --- | --- | --- | --- |
| Vaastav FPL | 2020-21 | PASS | None |
| Football-Data.co.uk | 2020-21 | PASS | None |
| Understat via Vaastav | 2020-21 | FAIL | team aggregate/generic CSV files are not player-match datasets and have no external player ID |
| Vaastav FPL | 2021-22 | PASS | None |
| Football-Data.co.uk | 2021-22 | PASS | None |
| Understat via Vaastav | 2021-22 | PASS WITH EXCLUSIONS | team aggregate/generic CSV files are not player-match datasets and have no external player ID |
| Vaastav FPL | 2022-23 | PASS | None |
| Football-Data.co.uk | 2022-23 | PASS | None |
| Understat via Vaastav | 2022-23 | PASS WITH EXCLUSIONS | team aggregate/generic CSV files are not player-match datasets and have no external player ID |
| Vaastav FPL | 2023-24 | PASS | None |
| Football-Data.co.uk | 2023-24 | PASS | None |
| Understat via Vaastav | 2023-24 | PASS WITH EXCLUSIONS | team aggregate/generic CSV files are not player-match datasets and have no external player ID |
| Vaastav FPL | 2024-25 | PASS WITH EXCLUSIONS | assistant-manager chip observations are outside the football-player benchmark scope |
| Football-Data.co.uk | 2024-25 | PASS | None |
| Understat via Vaastav | 2024-25 | PASS WITH EXCLUSIONS | team aggregate/generic CSV files are not player-match datasets and have no external player ID |
| Vaastav FPL | 2025-26 | PASS WITH EXCLUSIONS | exact duplicate player-fixture observations; one identical copy retained; exact duplicate player-fixture observations; one identical copy retained |
| Football-Data.co.uk | 2025-26 | PASS | None |
| Understat via Vaastav | 2025-26 | FAIL | None |

Understat 2025/26 is **FAIL** because the pinned archive contains no files; no holdout configuration uses it. Low coverage in available seasons remains missing and is measured rather than zero-filled.

### Benchmark configuration eligibility

| Configuration | Sources | Status | Blocking source-seasons |
| --- | --- | --- | --- |
| development FPL-only | Vaastav FPL | PASS | None |
| development FPL + Football-Data | Vaastav FPL, Football-Data.co.uk | PASS | None |
| development draft Understat | Vaastav FPL, Understat via Vaastav | PASS | None |
| development in-season Understat | Vaastav FPL, Understat via Vaastav | FAIL | Understat via Vaastav 2020-21: FAIL |
| 2025-26 selected holdout | Vaastav FPL, Football-Data.co.uk | PASS | None |
| 2025-26 Understat configuration | Vaastav FPL, Understat via Vaastav | FAIL | Understat via Vaastav 2020-21: FAIL; Understat via Vaastav 2025-26: FAIL |

Failed configurations are recorded as `blocked_by_data_quality`, not scored. In particular, in-season Understat comparisons are blocked by the lack of a 2020/21 player-level archive; draft Understat comparisons can use the benchmarkable 2021/22–2024/25 seasons.

## Join cardinality and row preservation

| Join | Declared | Left | Right | Output | Matched left | Unmatched left | Unmatched right |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 2020-21 gameweek observations -> FPL player identity | many_to_one | 24365 | 713 | 24365 | 24365 | 0 | 0 |
| 2020-21 gameweek observations -> fixtures | many_to_one | 24365 | 380 | 24365 | 24365 | 0 | 0 |
| 2020-21 FPL fixtures -> Football-Data match facts | one_to_one | 380 | 380 | 380 | 380 | 0 | 0 |
| 2021-22 gameweek observations -> FPL player identity | many_to_one | 25447 | 737 | 25447 | 25447 | 0 | 0 |
| 2021-22 gameweek observations -> fixtures | many_to_one | 25447 | 380 | 25447 | 25447 | 0 | 0 |
| 2021-22 FPL fixtures -> Football-Data match facts | one_to_one | 380 | 380 | 380 | 380 | 0 | 0 |
| 2022-23 gameweek observations -> FPL player identity | many_to_one | 26505 | 778 | 26505 | 26505 | 0 | 0 |
| 2022-23 gameweek observations -> fixtures | many_to_one | 26505 | 380 | 26505 | 26505 | 0 | 0 |
| 2022-23 FPL fixtures -> Football-Data match facts | one_to_one | 380 | 380 | 380 | 380 | 0 | 0 |
| 2023-24 gameweek observations -> FPL player identity | many_to_one | 29725 | 865 | 29725 | 29725 | 0 | 0 |
| 2023-24 gameweek observations -> fixtures | many_to_one | 29725 | 380 | 29725 | 29725 | 0 | 0 |
| 2023-24 FPL fixtures -> Football-Data match facts | one_to_one | 380 | 380 | 380 | 380 | 0 | 0 |
| 2024-25 gameweek observations -> FPL player identity | many_to_one | 27283 | 804 | 27283 | 27283 | 0 | 20 |
| 2024-25 gameweek observations -> fixtures | many_to_one | 27283 | 380 | 27283 | 27283 | 0 | 0 |
| 2024-25 FPL fixtures -> Football-Data match facts | one_to_one | 380 | 380 | 380 | 380 | 0 | 0 |
| 2025-26 gameweek observations -> FPL player identity | many_to_one | 29747 | 841 | 29747 | 29747 | 0 | 0 |
| 2025-26 gameweek observations -> fixtures | many_to_one | 29747 | 380 | 29747 | 29747 | 0 | 0 |
| 2025-26 FPL fixtures -> Football-Data match facts | one_to_one | 380 | 380 | 380 | 380 | 0 | 0 |

All listed joins passed their declarations. A preserve-left join that expands rows and every unjustified many-to-many join are blocking failures. Transformation row counts and reasons are in the JSON `row_reconciliation` ledger.

## Referential integrity and historical team membership

Across all six FPL seasons there are zero broken player, fixture, opponent, home-team, or away-team references; zero home=away fixtures; zero player-team/fixture participation disagreements; and zero GW/event disagreements. Historical team validation uses the team participating in that fixture and `was_home`, never the player's end-of-season club.

Cross-field checks found 0 rows with `starts > 0` and zero minutes across all seasons. Positive minutes with `starts = 0` are valid substitute appearances and are counted in JSON; neither class is silently removed.

## Cross-source match facts

| Season | Matched | Unmatched FPL | Unmatched Football-Data | Score disagreements | Status |
| --- | ---: | ---: | ---: | ---: | --- |
| 2020-21 | 380 | 0 | 0 | 0 | PASS |
| 2021-22 | 380 | 0 | 0 | 0 | PASS |
| 2022-23 | 380 | 0 | 0 | 0 | PASS |
| 2023-24 | 380 | 0 | 0 | 0 | PASS |
| 2024-25 | 380 | 0 | 0 | 0 | PASS |
| 2025-26 | 380 | 0 | 0 | 0 | PASS |

Team aliases are explicit, exact provider-name translations. No fuzzy team or player match is authoritative.

## Missingness, zero, and field absence

The JSON reports adopted FPL/model fields by season and position with separate `field_existed`, `missing`, and `zero` values. Older-season fields that did not exist remain missing. Processed feature missingness is also split by season/position and, for draft data, cold-start category. Model preprocessing may impute inside a training fold; the raw gate never turns field absence into zero.

## Schema drift

| Dataset | Seasons | Added | Removed | Type changes | Nullability changes |
| --- | --- | --- | --- | --- | --- |
| FPL players_raw | 2020-21 -> 2021-22 | — | — | — | — |
| FPL players_raw | 2021-22 -> 2022-23 | clean_sheets_per_90, expected_assists, expected_assists_per_90, expected_goal_involvements, expected_goal_involvements_per_90, expected_goals, expected_goals_conceded, expected_goals_conceded_per_90, expected_goals_per_90, form_rank, form_rank_type, goals_conceded_per_90, now_cost_rank, now_cost_rank_type, points_per_game_rank, points_per_game_rank_type, saves_per_90, selected_rank, selected_rank_type, starts, starts_per_90 | — | — | — |
| FPL players_raw | 2022-23 -> 2023-24 | — | — | — | — |
| FPL players_raw | 2023-24 -> 2024-25 | birth_date, can_select, can_transact, has_temporary_code, mng_clean_sheets, mng_draw, mng_goals_scored, mng_loss, mng_underdog_draw, mng_underdog_win, mng_win, opta_code, region, removed, team_join_date | — | — | — |
| FPL players_raw | 2024-25 -> 2025-26 | clearances_blocks_interceptions, defensive_contribution, defensive_contribution_per_90, known_name, price_change_percent, recoveries, scout_news_link, scout_risks, tackles | mng_clean_sheets, mng_draw, mng_goals_scored, mng_loss, mng_underdog_draw, mng_underdog_win, mng_win | — | — |
| FPL gameweeks | 2020-21 -> 2021-22 | — | — | — | — |
| FPL gameweeks | 2021-22 -> 2022-23 | expected_assists, expected_goal_involvements, expected_goals, expected_goals_conceded, starts | — | — | — |
| FPL gameweeks | 2022-23 -> 2023-24 | — | — | — | — |
| FPL gameweeks | 2023-24 -> 2024-25 | mng_clean_sheets, mng_draw, mng_goals_scored, mng_loss, mng_underdog_draw, mng_underdog_win, mng_win, modified | — | — | — |
| FPL gameweeks | 2024-25 -> 2025-26 | clearances_blocks_interceptions, defensive_contribution, recoveries, tackles | mng_clean_sheets, mng_draw, mng_goals_scored, mng_loss, mng_underdog_draw, mng_underdog_win, mng_win | — | — |
| FPL fixtures | 2020-21 -> 2021-22 | — | — | — | — |
| FPL fixtures | 2021-22 -> 2022-23 | — | — | — | — |
| FPL fixtures | 2022-23 -> 2023-24 | — | — | — | — |
| FPL fixtures | 2023-24 -> 2024-25 | — | — | — | — |
| FPL fixtures | 2024-25 -> 2025-26 | — | — | — | — |
| FPL teams | 2020-21 -> 2021-22 | — | — | — | — |
| FPL teams | 2021-22 -> 2022-23 | — | — | — | — |
| FPL teams | 2022-23 -> 2023-24 | — | — | — | — |
| FPL teams | 2023-24 -> 2024-25 | — | — | — | — |
| FPL teams | 2024-25 -> 2025-26 | link_url | — | — | — |
| Football-Data E0 | 2020-21 -> 2021-22 | — | — | — | B365<2.5, B365>2.5, B365CAHA, B365CAHH, IWCA, IWCD, IWCH |
| Football-Data E0 | 2021-22 -> 2022-23 | — | — | — | B365<2.5, B365>2.5, B365CAHA, B365CAHH, IWCA, IWCD, IWCH, P<2.5, P>2.5, PC<2.5, PC>2.5 |
| Football-Data E0 | 2022-23 -> 2023-24 | — | — | — | BWA, BWCA, BWCD, BWCH, BWD, BWH, IWA, IWCA, IWCD, IWCH, IWD, IWH, MaxCAHA, MaxCAHH |
| Football-Data E0 | 2023-24 -> 2024-25 | 1XBA, 1XBCA, 1XBCD, 1XBCH, 1XBD, 1XBH, BFA, BFCA, BFCD, BFCH, BFD, BFE<2.5, BFE>2.5, BFEA, BFEAHA, BFEAHH, BFEC<2.5, BFEC>2.5, BFECA, BFECAHA, BFECAHH, BFECD, BFECH, BFED, BFEH, BFH | IWA, IWCA, IWCD, IWCH, IWD, IWH, VCA, VCCA, VCCD, VCCH, VCD, VCH | — | MaxCAHA, MaxCAHH, WHA, WHCA, WHCD, WHCH, WHD, WHH |
| Football-Data E0 | 2024-25 -> 2025-26 | BFDA, BFDCA, BFDCD, BFDCH, BFDD, BFDH, BMGMA, BMGMCA, BMGMCD, BMGMCH, BMGMD, BMGMH, BVA, BVCA, BVCD, BVCH, BVD, BVH, CLA, CLCA, CLCD, CLCH, CLD, CLH, LBA, LBCA, LBCD, LBCH, LBD, LBH | 1XBA, 1XBCA, 1XBCD, 1XBCH, 1XBD, 1XBH, BFA, BFCA, BFCD, BFCH, BFD, BFH, WHA, WHCA, WHCD, WHCH, WHD, WHH | — | AHh, BFEA, BFEAHA, BFEAHH, BFEC<2.5, BFEC>2.5, BFECA, BFECAHA, BFECAHH, BFECD, BFECH, BFED, BFEH, BWA, BWCA, BWCD, BWCH, BWD, BWH, PAHA, PAHH, PCAHA, PCAHH, PSA, PSCA, PSCD, PSCH, PSD, PSH |
| Understat player matches | 2021-22 -> 2022-23 | — | — | — | — |
| Understat player matches | 2022-23 -> 2023-24 | — | — | — | — |
| Understat player matches | 2023-24 -> 2024-25 | — | — | — | — |

Notable semantic drift includes expected/start fields arriving after early seasons, 2024/25 assistant-manager fields, and 2025/26 defensive-contribution fields. Added fields are not treated as renamed equivalents without evidence.

## Distribution flags

Each important numeric field has count/missing/min/p01/p05/median/p95/p99/max by season and position in JSON. Flags are investigative, not automatic outlier deletion:

- No threshold-level shifts were flagged.

## Coverage and cold starts

Understat exact-match coverage is reported by season, position, team, and the derivable categories `RETURNING EPL PLAYER`, `PROMOTED-TEAM PLAYER`, and `UNKNOWN`. The archives cannot reliably distinguish new foreign-league signings from academy/rookie players, so those remain explicitly unresolved rather than guessed. This is a material draft-day coverage bias.

## Target and aggregate validation

The 1/3/5 horizons mean **gameweeks**, not matches: features use `GW <= t`, while targets use `t < GW <= t+h`. Double Gameweek fixtures are summed within their assigned GW, blank GWs contribute no fixture rows, rescheduled fixtures follow fixture event metadata, and a player with no future appearance receives a zero target through the left join. Exact fixture and aggregate results are in JSON.

Player-GW sums reconcile exactly to published season totals in every season except one 2024/25 football player with a one-point archived-GW/final-snapshot difference. That scoped source correction is reported, not silently forced. All seasons contain 380 fixtures and FPL/Football-Data scores agree for all 2,280 matches.

## Non-features and trust boundary

This gate does not create projections, production models, Best Fit, player health, or live integration. It does not scrape. A PASS means the audited source contract passed these checks, not that provider coverage or football metrics are perfect.
