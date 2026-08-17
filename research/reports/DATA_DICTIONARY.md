# Phase 5 data dictionary

## Row contracts

### Acquired source grains

| Source dataset | Expected grain | Candidate key |
| --- | --- | --- |
| FPL `players_raw.csv` | one registered player-season | `id` (with `code` also unique within season) |
| FPL `gws/gw1.csv` | one registered player-fixture observation in GW1 | `element`, `fixture` |
| FPL `gws/merged_gw.csv` | one registered player-fixture observation | `element`, `fixture` |
| FPL `fixtures.csv` | one league fixture | `id` |
| FPL `teams.csv` | one team-season | `id` |
| Football-Data E0 | one league fixture | parsed date, canonical home team, canonical away team |
| Understat player extract | one external player-match | filename external player ID, match `id` |

`player + GW` is not unique: a Double Gameweek legitimately has two fixture rows. Only repeated `player + fixture` is a logical duplicate. Team aggregate and generic files found in Understat directories do not satisfy player-match grain and are explicitly excluded.

### Draft-day dataset

One row represents one player present in the target season's archived GW1 player universe. Only identity, position, team and the scheduled first kickoff are taken from the target GW1 file; no target-season match output is a feature. The target is the sum of that player's target-season GW `total_points`. Features are built from the immediately preceding season.

`players_raw.csv.code` is the cross-season FPL identity. `element`/`id` is season-local. Final `players_raw` values are not preseason statistics; this research uses that file only to translate season-local IDs to `code`.

### In-season dataset

One row represents a player known by the end of cutoff GW `t`. All FPL features contain only rows with `GW <= t`. Targets are sums over `t < GW <= t+h`, where `h` is 1, 3 or 5, and only actual kickoffs strictly after the prediction cutoff qualify. The cutoff is the latest actual kickoff across incorporated rows. Blank and double gameweeks are handled by explicit GW labels and fixture rows, not array offsets; rescheduled chronology overrides a misleading future event label.

The horizon unit is **gameweeks, not matches**. Both fixtures in a DGW are summed; a blank GW adds no match rows; rescheduled fixtures follow their archived fixture `event`; and a player in the cutoff universe with no target-window appearance receives zero target points. Missing feature fields still remain missing.

## Common identifiers and labels

| Field | Meaning |
| --- | --- |
| `code` | Stable FPL player code used for cross-season identity |
| `element` | Season-local FPL player ID; never joined across seasons |
| `season` | Target/evaluation season, e.g. `2024-25` |
| `position` | FPL position: GK, DEF, MID or FWD |
| `team` | Team name at the row's cutoff |
| `cutoff_gw` | Last completed GW included in an in-season feature row |
| `cutoff_time` | Maximum timestamp allowed in that feature row |
| `prediction_cutoff` | Decision timestamp after incorporated observations are complete |
| `feature_max_timestamp` | Latest actual information timestamp used by predictive features |
| `target_start_timestamp` | First actual target timestamp, or strict post-cutoff sentinel for an empty blank interval |
| `target_end_timestamp` | Last actual target timestamp; equals start for an empty interval |
| `target_has_observations` | Whether the target gameweek interval contains archived fixture rows |
| `sample_key` | Integrity-only stable key; `(season, code)` draft or `(season, code, cutoff_gw, horizon)` in-season |
| `target` | Future points only, according to the task contract |

Gameweek labels must be finite integral values in `1..38`; fractional numeric labels are invalid. `code`, `element`, names, source IDs and `sample_key` remain metadata and are forbidden estimator inputs.

## Feature families

| Family | Fields and semantics |
| --- | --- |
| `FPL_BASE` | Prior/cumulative points, minutes, starts, goals, assists, clean sheets, bonus, BPS, saves; plus history/low-minute flags and a 450-minute-shrunk points-per-90 rate |
| `FPL_EXPECTED` | xG, xA, xGI and xGC sums available by the cutoff, plus a missingness flag |
| `FPL_ICT` | Influence, creativity, threat and ICT sums available by the cutoff, plus a missingness flag |
| `FORM` | Last 3/5 GW points and minutes and five-GW points per appearance |
| `TEAM_CONTEXT` | Mean goal and shot differences from the team's last 10 completed league matches plus observed-match count |
| `BOOKMAKER` | Mean overround-normalized market win probability from the team's last 10 completed matches |
| `UNDERSTAT_PLAYER` | Last/prior Understat xG, xA, npxG, shots, key passes, xGChain and xGBuildup where an exact identity match exists |

`xP`, `modified`, assistant-manager `mng_*` fields and final-season aggregate columns are never model features.

## Missing values and cold starts

Missing because a statistic or scoring rule did not exist is retained as missing, not converted to zero. Model preprocessing learns numeric medians on the training fold and adds missingness indicators. Categorical values use a training-fold mode and one-hot encoding. Ridge scaling is fitted only on training data.

Every model call receives a machine-readable manifest whose numeric and categorical lists must exactly match the estimator input. Metadata, targets, future/final-season fields and identifiers are rejected before fitting. All chronological splits independently require unique sample keys and zero train/test overlap.

Draft-day players are classified conservatively:

- `RETURNING EPL PLAYER`: stable FPL code appears in the prior season.
- `PROMOTED-CLUB PLAYER`: no prior code and the current club was absent from the prior EPL season.
- `UNKNOWN`: no prior code but the club was present; this may include a new foreign signing, academy player or long absence.

The available sources cannot reliably split every `UNKNOWN` into foreign signing, academy/rookie or long-absence categories. No category is inferred from fuzzy names and no missing history is treated as poor performance.

## External fields

Football-Data decimal home/draw/away odds `o_i` are converted to `q_i = 1/o_i`, then normalized as `p_i = q_i / sum(q)`. Only already-completed matches enter the aggregate.

Understat date filtering includes `date <= cutoff_time`. Cross-source mappings require a unique exact NFKC/casefold/alphanumeric-normalized full name. Unmatched and ambiguous players remain missing.

## Scoring/schema compatibility

- 2020/21 and 2021/22 lack several modern native FPL expected-stat/start fields. They remain missing.
- 2022/23 has no GW7 match rows because the round was postponed; GW labels are not assumed contiguous.
- 2024/25 files add assistant-manager fields; those are outside the player problem and excluded.
- 2025/26 adds official defensive-contribution points and archived recoveries, tackles and clearance/block/interception fields. Official assist and BPS rules also changed. These fields are not backfilled into earlier seasons and were not selected using the holdout.
- Understat directories contain 24/736/575/798/789/0 CSVs for 2020/21 through 2025/26, but 2020/21's 24 files are team/generic aggregates rather than player-ID files. Player-level counts are therefore 0/712/554/774/765/0. Understat-dependent in-season configurations touching 2020/21 and every 2025/26 Understat configuration fail the quality gate.
