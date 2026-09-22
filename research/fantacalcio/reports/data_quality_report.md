# FD2-QA2 temporal certification report

Release: `fd2qa-2026-09-22-c8ce1b1e8b5f`. Cutoff: 2026-09-22T15:27:24.030803+00:00.

**AUCTION_POOL_READY: True; MODEL_READY: True; DQ: 90.305/100.**

## Sources and freshness

0novanta `5ec6e1afbee2ed7dd52c4fdb87595c242d13b8b2`; piopy reference `4dda14a8dd2ab24c2f30404c65d317e1d4cc84a4`. Exact paths, per-file checksums, schemas and versions are in `source_manifest.json`.

Bootstrap max rated appearances: 2; advanced current max appearances: 1; refreshed live max rated appearances: 5. This suggests round 5, but does not prove match completeness.

## Current pool

Players: 534; roles: {'POR': 63, 'CEN': 194, 'DIF': 190, 'ATT': 87}; identity coverage: 100.0%.
Unresolved identities: 0; missing roles: 0; missing clubs: 0.
Bootstrap comparison: 31 additions, 24 removals, 5 club/role updates.

## Historical and season coverage

3353 historical rows, 1505 players. Current mapping: 414/534 (77.5281%). 120 NEW_PLAYER_NO_HISTORY; 0 JOIN_FAILURE.

| Season | Source rows | Distinct IDs | Clubs | Rated players | Max PV |
|---|---:|---:|---:|---:|---:|
| 2021/22 | 675 | 675 | 20 | 562 | 38 |
| 2022/23 | 672 | 672 | 20 | 547 | 38 |
| 2023/24 | 664 | 664 | 20 | 544 | 38 |
| 2024/25 | 679 | 679 | 20 | 561 | 38 |
| 2025/26 | 663 | 663 | 20 | 547 | 38 |
| 2026/27 | 566 | 566 | 20 | 339 | 2 |

The 2026/27 row above describes the superseded bootstrap workbook. All selected seasons contain 20 clubs. Fixture coverage and player-match coverage are **NOT_APPLICABLE — AGGREGATE SOURCE**. Expected/observed/missing fixtures, matchdays, orphan player-match rows and fixture duplicate counts are unknown, not zero.

## Duplicates and value validity

- current_canonical: 0
- source_identity_mapping: 0
- player_season: 0
- current_name_club_collisions: 0
- different_ids_identical_observations: 0
- advanced_transfer_groups: 577
- advanced_unresolved_stint_duplicates: 0
- canonical_unresolved: 0

Canonical schema/value violations: 0.

Transfer groups are counted across advanced file families, not unique transfers. Detailed keys, affected row indices, causes and resolutions remain in local `duplicate_audit.json`. No duplicate rows are silently dropped.

## Join cardinality

| Join | Left before | Right before | After | Matched |
|---|---:|---:|---:|---:|
| live quotation to live fantasy statistics | 597 | 597 | 597 | 597 |
| current pool to refreshed current aggregates | 534 | 597 | 534 | 534 |
| 2021/22 advanced standard to time at stint grain | 632 | 808 | 632 | 632 |
| 2022/23 advanced standard to time at stint grain | 603 | 761 | 603 | 603 |
| 2023/24 advanced standard to time at stint grain | 616 | 787 | 616 | 616 |
| 2024/25 advanced standard to time at stint grain | 634 | 812 | 634 | 634 |
| 2025/26 advanced standard to time at stint grain | 609 | 803 | 609 | 609 |
| 2026/27 advanced standard to time at stint grain | 319 | 484 | 319 | 319 |

All joins enforce many-to-one right-key uniqueness.

## Missingness

### current_pool

| Field | Non-null | Missing | Missing % | Reasons |
|---|---:|---:|---:|---|
| playerRef | 534 | 0 | 0.0 | — |
| fantacalcioId | 534 | 0 | 0.0 | — |
| displayName | 534 | 0 | 0.0 | — |
| club | 534 | 0 | 0.0 | — |
| role | 534 | 0 | 0.0 | — |
| eligibility | 534 | 0 | 0.0 | — |
| quotation | 534 | 0 | 0.0 | — |
| FVM | 534 | 0 | 0.0 | — |

### historical

| Field | Non-null | Missing | Missing % | Reasons |
|---|---:|---:|---:|---|
| PV | 3353 | 0 | 0.0 | — |
| MV | 2761 | 592 | 17.6558 | NO_APPEARANCE: 592 |
| FM | 2761 | 592 | 17.6558 | NO_APPEARANCE: 592 |
| goals | 3353 | 0 | 0.0 | — |
| goals_conceded | 3353 | 0 | 0.0 | — |
| assists | 3353 | 0 | 0.0 | — |
| yellow_cards | 3353 | 0 | 0.0 | — |
| red_cards | 3353 | 0 | 0.0 | — |
| penalties_saved | 3353 | 0 | 0.0 | — |
| penalties_taken | 3353 | 0 | 0.0 | — |
| penalties_scored | 3353 | 0 | 0.0 | — |
| penalties_missed | 3353 | 0 | 0.0 | — |
| own_goals | 3353 | 0 | 0.0 | — |
| minutes | 0 | 3353 | 100.0 | SOURCE_UNAVAILABLE: 3353 |
| starts | 0 | 3353 | 100.0 | SOURCE_UNAVAILABLE: 3353 |
| shots | 0 | 3353 | 100.0 | SOURCE_UNAVAILABLE: 3353 |
| xG | 0 | 3353 | 100.0 | SOURCE_UNAVAILABLE: 3353 |
| xA | 0 | 3353 | 100.0 | SOURCE_UNAVAILABLE: 3353 |
| availability | 0 | 3353 | 100.0 | SOURCE_UNAVAILABLE: 3353 |
| starter_evidence | 0 | 3353 | 100.0 | SOURCE_UNAVAILABLE: 3353 |
| set_piece_role | 0 | 3353 | 100.0 | SOURCE_UNAVAILABLE: 3353 |

### current_evidence

| Field | Non-null | Missing | Missing % | Reasons |
|---|---:|---:|---:|---|
| PV | 534 | 0 | 0.0 | — |
| MV | 406 | 128 | 23.97 | NO_APPEARANCE: 128 |
| FM | 406 | 128 | 23.97 | NO_APPEARANCE: 128 |
| goals | 534 | 0 | 0.0 | — |
| goals_conceded | 534 | 0 | 0.0 | — |
| assists | 534 | 0 | 0.0 | — |
| yellow_cards | 534 | 0 | 0.0 | — |
| red_cards | 534 | 0 | 0.0 | — |
| penalties_saved | 534 | 0 | 0.0 | — |
| penalties_taken | 534 | 0 | 0.0 | — |
| penalties_scored | 534 | 0 | 0.0 | — |
| penalties_missed | 534 | 0 | 0.0 | — |
| own_goals | 0 | 534 | 100.0 | SOURCE_UNAVAILABLE: 534 |
| minutes | 0 | 534 | 100.0 | SOURCE_UNAVAILABLE: 534 |
| starts | 0 | 534 | 100.0 | SOURCE_UNAVAILABLE: 534 |
| shots | 0 | 534 | 100.0 | SOURCE_UNAVAILABLE: 534 |
| xG | 0 | 534 | 100.0 | SOURCE_UNAVAILABLE: 534 |
| xA | 0 | 534 | 100.0 | SOURCE_UNAVAILABLE: 534 |
| availability | 0 | 534 | 100.0 | SOURCE_UNAVAILABLE: 534 |
| starter_evidence | 0 | 534 | 100.0 | SOURCE_UNAVAILABLE: 534 |
| set_piece_role | 0 | 534 | 100.0 | SOURCE_UNAVAILABLE: 534 |

## Cross-source consistency

- live_identity_checks: 1791
- live_identity_failures: 0
- advanced_stat_checks: 10239
- advanced_stat_mismatches: 0
- bootstrap_to_live_changed_fields: 1794
- independent_complete_current_check: False

The live pages share one provider; the advanced files share another. These are internal consistency checks, not independent-provider confirmation. Different bootstrap/live timestamps explain changed values; they are never averaged. See local `source_reconciliation.csv`.

## Temporal and split integrity

BACKTEST_SAFE_EVENT_WINDOW: verified final prior-season PV, goals, assists, cards, penalties, own goals and goals conceded. The source file was retrieved later and is never backdated. MV/FM, current quotations/FVM/club/role/injury/starter/set-piece data are CURRENT_ONLY; future outcomes are TARGET_ONLY; future-derived fields and unmapped/unavailable enrichment are UNSAFE. See `field_safety_manifest.json`.

Proposed target split: train 2022/23–2023/24; validation 2024/25; holdout 2025/26. Previous-season features only. Analytical target periods run July 1–June 30; prediction cutoff is June 30 23:59:59 UTC immediately before target start.
Candidate counts: {'train': 876, 'validation': 424, 'holdout': 435}. Admitted: 1735; rejected by temporal gate: 0; no prior-season row (outside candidate universe): 943; admitted temporal violations: 0; target leakage: 0; split overlaps: 0.
Source publication before the historical cutoffs remains unproven and receives zero DQ credit. Event-window certification uses only final strictly prior-season event totals. RETROSPECTIVE_SOURCE_REVISION_RISK remains explicit.

## Deterministic DQ scoring

Each component = its prescribed weight × the arithmetic mean of the named measured fractions below. Unknown checks receive zero. A high score never overrides a hard failure. MODEL_READY additionally requires total >=90.

| Component | Weight | Score | Measured fractions |
|---|---:|---:|---|
| provenance | 10 | 10.0 | all_artifacts_hashed=1.000000; all_versions_pinned=1.000000; all_schemas_recorded=1.000000 |
| schema | 10 | 10.0 | canonical_value_validity=1.000000; strict_missing_numeric_policy=1.000000 |
| identity | 20 | 20.0 | unique_canonical_keys=1.000000; unique_season_keys=1.000000; join_cardinality=1.000000; current_identity_complete=1.000000 |
| coverage | 20 | 18.8764 | current_critical_complete=1.000000; current_stats_id_coverage=1.000000; historical_rated_values_complete=1.000000; current_players_with_history=0.775281 |
| consistency | 15 | 10.0 | live_identity_agreement=1.000000; advanced_same_grain_agreement=1.000000; independent_provider_complete_current_reconciliation=0.000000 |
| temporal | 25 | 21.4286 | current_release_cutoff_valid=1.000000; unsafe_samples_excluded=1.000000; target_denylist=1.000000; split_disjoint=1.000000; historical_cutoff_proven=0.000000; prior_event_windows_end_by_cutoff=1.000000; admitted_features_verified_event_fields=1.000000 |

**Total: 90.305/100.**

## Hard failures

- NONE

## Warnings

- RETROSPECTIVE_SOURCE_REVISION_RISK: final prior-season event totals were retrieved later; corrections made after historical cutoffs cannot be ruled out.
- Data release is LOCAL_ONLY; data redistribution/product reuse not cleared.
- Aggregate data cannot prove fixture or player-match completeness.
- Historical source includes current-version corrections; do not assign old as-of timestamps from season labels.
- No historical training cohort is filtered to current selectable players (avoid survivorship bias).
- PV counts rated appearances, not all appearances; source assists and generic football assists are not interchangeable.
- MV/FM source zero with PV=0 is preserved as raw value and normalized to null/NO_APPEARANCE.
- No exact fantasy total reconstructed from rounded MV/FM.
- Vuk manually confirmed the league Fonte voti as Fantacalcio; historical modifier scoring distributions remain unavailable.
- Workbook core date metadata is absent; reader-generated default modification timestamps are not source freshness evidence.
- Advanced data excluded from predictive features until crosswalk verification; no fuzzy joins admitted.
- No complete current minutes/starts/injuries feed admitted. Missing optional evidence does not block the pool.
- No historical base-vote distribution: aggregate mean is insufficient for modifier stability.
- Five preferred completed seasons only; older compatible source files were not needed for this release.

## Reproducibility and decision

The builder compares two complete builds byte for byte, checks pinned source bytes and refuses to overwrite conflicting immutable releases. `release_checksums.json` covers every release file except itself; the content-derived release ID includes transformation-code hashes.
The pool is technically ready. MODEL_READY=True for the narrowly certified event-window fields only. Raw and derived player data remain local because redistribution/product reuse is not cleared.
No model, prices, app integration or production mutation was performed.
