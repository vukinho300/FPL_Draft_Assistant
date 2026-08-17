# Phase 5 source audit

Audit date: 2026-08-17. This audit was completed before model training. Source coverage was inspected directly; optional sources were not assumed usable merely because a website or API exists.

## Decision summary

| Source | Decision | Unique candidate signal | Main constraint |
| --- | --- | --- | --- |
| Vaastav FPL Historical Dataset | Use as mandatory core | Player/gameweek FPL outcomes, expected statistics and ICT | Snapshot semantics vary by file; `xP` is explicitly unsafe unshifted |
| Vaastav Understat extracts | Quality-gated development-only benchmark | npxG, shots, key passes, xGChain and xGBuildup | No player-level 2020/21 or 2025/26 files; affected configurations are blocked |
| Football-Data.co.uk | Use | Historical match results, shots and bookmaker market probabilities | No explicit open-data redistribution licence was identified; raw files stay local |
| ClubElo | Exclude from executed benchmark | Date-specific team strength | Documented read-only endpoints timed out in all clean access probes |
| Archived official FPL fixture context | Partial use | Home/away and opponent identity | No trustworthy historical snapshots of changing official FDR were found |
| Historical official FPL Draft rank | Exclude | Direct draft-market baseline | No reproducible preseason archive for all evaluation seasons was found |
| OpenFPL | Methodology reference only | Published public-data benchmark design | It is not an additional data source and its binaries are not reused |
| Secondary/scraped sources | Exclude | Potential availability or richer event context | No clean source justified scraping, legal uncertainty, or operational burden |

## A. Vaastav FPL Historical Dataset

- **Owner:** Vaastav Anand and contributors; underlying data is attributed to Fantasy Premier League and Understat.
- **Access:** [GitHub repository](https://github.com/vaastav/Fantasy-Premier-League), pinned locally at commit `8c97b2adb123863c3dd581e730f1360e89815ac2`.
- **Observed seasons:** 2020/21 through 2025/26 were inspected. The required 2022/23, 2023/24, 2024/25 and 2025/26 folders are present.
- **Granularity:** player-season snapshots, player-gameweek rows, fixtures and teams. Separate Understat player-match extracts exist in some seasons.
- **Verified coverage:** 38 source GW files exist for each primary season. Merged rows were 26,505 (2022/23), 29,725 (2023/24), 27,605 (2024/25) and 29,757 (2025/26). Fixtures contain 380 unique, finished Premier League matches in each of those seasons. The merged 2022/23 data has no GW7 rows because that round was postponed; code must not assume every integer GW has matches.
- **2025/26 verification:** 38 GW files through GW38, 29,757 merged player-fixture rows, 841 final player records and 380 finished fixtures were observed. This confirms the requested coverage independently.
- **Identity:** `element`/`id` is season-local. `players_raw.csv.code` had no blanks or within-season duplicates in the six inspected seasons and is the authoritative cross-season FPL key for this research. A target-season GW1 `element` is mapped to `code` through that season's `players_raw.csv`; names are never authoritative.
- **Historical snapshots:** a GW file is a post-GW result extract. `players_raw.csv` and `cleaned_players.csv` are end/current-snapshot files, not preseason feature snapshots. They may supply identity or final targets only under explicit timestamp rules.
- **Availability:** weekly updates stopped after 2024/25; the maintainer now promises three major snapshots per season. This reduces live-maintenance suitability.
- **Licence/redistribution:** repository code is MIT, but its licence explicitly says the data belongs to FPL and Understat. Raw data is downloaded locally, checksummed, gitignored and not redistributed here.
- **Cost/authentication:** free; no authentication for GitHub raw files.
- **Stability:** high for archived seasons, lower for future weekly use because the update policy changed.
- **Important leakage finding:** the repository warns that `xP` is scraped after the gameweek and may contain post-match information. Phase 5 excludes `xP` entirely. End-of-season `modified` and assistant-manager `mng_*` fields are also excluded.
- **Unique value:** mandatory target data plus native FPL minutes, starts, points events, bonus/BPS, expected metrics and ICT.

## B. Understat

- **Owner:** Understat; the inspected copies are maintained in the Vaastav dataset.
- **Access:** per-player CSV files under Vaastav season folders. Direct Understat pages are public, but no official documented bulk API or explicit data licence was identified.
- **Observed coverage:** 24 files in 2020/21, 736 in 2021/22, 575 in 2022/23, 798 in 2023/24, 789 in 2024/25 and none in 2025/26. The 2020/21 count is insufficient for a usable league-wide feature family.
- **Granularity:** player-match. Observed fields include goals, shots, xG, minutes, position, teams, match date, Understat identifiers, xA, assists, key passes, npxG, xGChain and xGBuildup.
- **Quality finding:** Understat season directories also contain team aggregate and generic files without a player ID. Those files are explicitly excluded from player-match ingestion. The 2020/21 directory has no usable player-ID file, so that source-season is `FAIL`, not “24 player files.”
- **Identity quality:** filenames combine a name and Understat ID, while Vaastav player-list files only provide FPL season IDs. There is no inspected stable, explicit FPL-code-to-Understat-ID table. Authoritative cross-source matching therefore requires exact reviewed evidence; silent fuzzy matching is forbidden.
- **Historical snapshots:** match dates permit strict cutoff filtering. Aggregates must include only matches with a date before the prediction cutoff.
- **Licence/redistribution:** Vaastav states that Understat owns the data. Raw extracts remain gitignored and are not committed.
- **Cost/authentication:** free and unauthenticated for public pages.
- **Stability/maintainability:** medium-to-low. Clean historical files exist for development seasons, but there is no 2025/26 Vaastav coverage and direct acquisition would require source-specific extraction.
- **Decision:** test its incremental value on development seasons only where identity evidence is exact. It cannot be part of the frozen holdout-capable production candidate without equivalent 2025/26 coverage. No direct scraping was justified for Phase 5.
- **Unique value:** shots, key passes, npxG, xGChain and xGBuildup beyond native FPL fields. xG/xA overlap substantially with modern native FPL expected-stat fields.

## C. Football-Data.co.uk

- **Owner:** Football-Data.co.uk.
- **Access:** public season CSVs such as `https://www.football-data.co.uk/mmz4281/2425/E0.csv`; [download notes](https://www.football-data.co.uk/downloadm.php).
- **Observed seasons:** 2020/21 through 2025/26 were downloaded successfully. Each contains all 380 Premier League matches. Column counts were 106 through 2023/24, 120 in 2024/25 and 132 in 2025/26.
- **Granularity:** match-level.
- **Observed fields:** match date/time, teams, final result, goals, shots/shots on target and consistent Bet365 plus market-average home/draw/away odds. Since 2019/20 both early and closing odds are recorded; closing fields contain `C` in their names.
- **Identity quality:** team names require an explicit season mapping to FPL team IDs. This source is not joined directly to players.
- **Historical snapshots:** match dates are explicit, but per-odds capture timestamps are not in the CSV. To avoid deadline ambiguity, the executed benchmark uses only aggregates from matches completed before the prediction cutoff. It does not expose a future fixture's closing odds to a prediction row.
- **Bookmaker conversion:** decimal odds `o_i` become raw implied probabilities `1/o_i`; the overround-normalized probability is `(1/o_i) / sum_j(1/o_j)` across home/draw/away. Odds are market estimates, not ground truth.
- **Licence/redistribution:** data is described as free for quantitative testing, with source acknowledgements in `Notes.txt`; no explicit permissive redistribution licence was identified. Raw files stay local and gitignored. Only derived benchmark metrics and tiny synthetic fixtures are committed.
- **Cost/authentication:** free; no authentication.
- **Stability:** high for historical annual CSVs. The site warns that Pinnacle delivery became unreliable after 2025-07-23; the research uses market-average/Bet365 columns and does not depend on Pinnacle.
- **Decision:** use as a benchmarked optional source.
- **Unique value:** crowd/market team-strength expectations and match-level shot context not encoded directly in player FPL history.

## D. ClubElo

- **Owner:** ClubElo.
- **Access investigated:** documented CSV-style team and date endpoints at `https://api.clubelo.com/{club-or-date}` (with HTTP fallback also tested).
- **Potential granularity:** daily club ratings.
- **Historical snapshots:** the interface is intended to support date-specific ratings, which would be leakage-safe only when queried at or before the cutoff.
- **Identity quality:** club aliases need explicit mappings.
- **Cost/authentication:** apparently free and unauthenticated.
- **Observed blocker:** clean HTTPS date, HTTP date and HTTPS club probes each timed out after 20 seconds on 2026-08-17. No response body was obtained.
- **Licence/redistribution:** no sufficiently clear redistribution terms were verified during this audit.
- **Decision:** unavailable for the executed Phase 5 benchmark. A scraper would not fix an unresponsive API and was not justified. Tests still cover as-of date-join logic with synthetic fixtures so a future clean export can be evaluated safely.
- **Unique value if restored:** an independent, time-varying team-strength signal.

## E. Official FPL fixture context and scoring regime

- **Owner:** Fantasy Premier League / Premier League.
- **Access:** archived Vaastav fixture/GW files and official rules/news pages.
- **Granularity:** match/gameweek.
- **Reliable fields:** home/away and opponent identity present on the target match row are schedule facts. Historical aggregates may use only fixtures completed by the cutoff.
- **FDR finding:** the archived final fixture files do not prove what the mutable official FDR value was at each historical deadline. No reliable historical snapshot series was found. Phase 5 does not reconstruct current ratings and call them historical FDR.
- **Scoring compatibility:** official 2025/26 rules added defensive-contribution points, revised assists and changed BPS. Vaastav 2025/26 correspondingly adds `defensive_contribution`, recoveries, tackles and clearance/block/interception fields. These are a new regime, not zeros in earlier seasons, and are excluded from cross-season candidate features.
- **Decision:** use home/away and opponent facts only where cutoff-safe; exclude historical official FDR and mutable availability fields without timestamped snapshots.

## F. Historical official FPL Draft rank

- **Owner:** Fantasy Premier League Draft.
- **Access investigated:** public Draft endpoints, community repositories and archive/search results.
- **Granularity:** prospective player ranking at a season snapshot, if archived.
- **Identity quality:** current endpoints can use FPL element IDs, but those are season-local.
- **Finding:** no reproducible, complete, preseason official Draft-rank archive was found for 2023/24, 2024/25 and 2025/26. Community references to average draft position are not an official historical rank series.
- **Decision:** exclude. It is not fabricated or inferred from final points. Current official Draft rank remains a future live baseline candidate.

## G. OpenFPL and secondary sources

OpenFPL was inspected as a methodology reference at repository commit `ad055ba7270145ce8ecc1f19581423493b1357e7` and via its [2025 paper](https://arxiv.org/abs/2508.09992). It uses position-specific Random Forest/XGBoost ensembles over FPL and Understat rolling features and prospectively evaluates 2024/25. Its useful design lessons are multi-horizon evaluation, position awareness and strict prospective isolation. Its team-based cross-validation is not copied because Phase 5 requires chronological season folds. No OpenFPL model binary, sample prediction or code is reused.

No optional secondary source provided enough unique, timestamped information to justify additional scraping, authentication, fragile joins or unclear terms in this phase. In particular, no foreign-league translation is invented for cold-start players.

## Acquisition and commit policy

- Full raw data lives under gitignored `research/data/raw/` after explicit acquisition.
- `research/data/source_manifest.json` records URL, season, retrieval time, SHA-256, observed schema and acquisition method.
- Only scripts, configs, small synthetic test fixtures, checksums/manifest metadata and aggregate result tables are committed.
- No cookies, credentials, browser profiles, source caches, raw proprietary datasets or trained model binaries are committed.

## Scrapling decision

Scrapling fallback not used.

All selected sources were available through ordinary public files. Understat's missing holdout coverage, ClubElo's timeouts and historical Draft-rank absence are data-availability problems, not problems that responsible anti-bot tooling should try to bypass.
