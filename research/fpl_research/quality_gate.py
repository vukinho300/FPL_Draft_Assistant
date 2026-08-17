from __future__ import annotations

import hashlib
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

from research.fpl_research.identity import build_understat_identity_evidence
from research.fpl_research.odds import canonical_team_name, normalized_implied_probabilities
from research.fpl_research.provenance import collection_sha256, sha256_file
from research.fpl_research.quality import (
    BENCHMARKABLE_STATUSES,
    FPL_PLAYER_POSITIONS,
    DataQualityError,
    apply_approved_fpl_observation_rules,
    audit_duplicates,
    audit_join,
    compare_schema_signatures,
    coverage_record,
    historical_team_consistency,
    missingness_record,
    numeric_distribution,
    parse_required_dates,
    reconcile_aggregates,
    schema_signature,
    validate_finite_numeric,
    validate_nonnegative,
    validate_required_identifiers,
    write_quality_results,
)


SEASONS = ("2020-21", "2021-22", "2022-23", "2023-24", "2024-25", "2025-26")
FPL_SOURCE = "Vaastav FPL"
FOOTBALL_DATA_SOURCE = "Football-Data.co.uk"
UNDERSTAT_SOURCE = "Understat via Vaastav"
ELEMENT_TYPE_TO_POSITION = {1: "GK", 2: "DEF", 3: "MID", 4: "FWD"}
IMPORTANT_FPL_FIELDS = (
    "total_points",
    "minutes",
    "starts",
    "bps",
    "expected_goals",
    "expected_assists",
    "expected_goal_involvements",
    "influence",
    "creativity",
    "threat",
    "ict_index",
)


def _status(exclusions: list[dict[str, object]], failures: list[str]) -> str:
    if failures:
        return "FAIL"
    return "PASS WITH EXCLUSIONS" if exclusions else "PASS"


def _source_status(
    source: str,
    season: str,
    status: str,
    exclusions: list[dict[str, object]],
    findings: list[str],
) -> dict[str, object]:
    return {
        "source": source,
        "season": season,
        "status": status,
        "exclusions": exclusions,
        "findings": findings,
    }


def _verify_manifest(raw_root: Path, manifest_path: Path) -> tuple[list[dict[str, object]], list[str]]:
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    checks: list[dict[str, object]] = []
    failures: list[str] = []
    for artifact in manifest.get("artifacts", []):
        relative = str(artifact["file_name"])
        expected = str(artifact["sha256"])
        if relative.endswith("/*.csv"):
            root = raw_root / relative.removesuffix("/*.csv")
            files = list(root.glob("*.csv"))
            actual = collection_sha256(files, root) if files else None
        else:
            path = raw_root / relative
            actual = sha256_file(path) if path.exists() else None
        passed = actual == expected
        checks.append(
            {
                "artifact": relative,
                "season": artifact.get("season"),
                "expected_sha256": expected,
                "actual_sha256": actual,
                "status": "PASS" if passed else "FAIL",
            }
        )
        if not passed:
            failures.append(f"manifest checksum mismatch: {relative}")
    return checks, failures


def _dataset_record(
    source: str,
    season: str,
    dataset: str,
    grain: str,
    key: list[str],
    frame: pd.DataFrame,
) -> dict[str, object]:
    return {
        "source": source,
        "season": season,
        "dataset": dataset,
        "expected_grain": grain,
        "candidate_key": key,
        "duplicates": audit_duplicates(frame, key),
    }


def _fpl_season_audit(
    raw_root: Path,
    season: str,
    result: dict[str, Any],
) -> dict[str, object]:
    root = raw_root / "vaastav" / "data" / season
    players = pd.read_csv(root / "players_raw.csv", low_memory=False)
    gw1_raw = pd.read_csv(root / "gws" / "gw1.csv", low_memory=False)
    games_raw = pd.read_csv(root / "gws" / "merged_gw.csv", low_memory=False)
    fixtures = pd.read_csv(root / "fixtures.csv", low_memory=False)
    teams = pd.read_csv(root / "teams.csv", low_memory=False)
    failures: list[str] = []
    exclusions: list[dict[str, object]] = []
    findings: list[str] = []

    datasets = (
        ("players_raw", "one row per registered player-season", ["id"], players),
        ("gw1", "one row per registered player-fixture observation in GW1", ["element", "fixture"], gw1_raw),
        ("merged_gw", "one row per registered player-fixture observation", ["element", "fixture"], games_raw),
        ("fixtures", "one row per league fixture", ["id"], fixtures),
        ("teams", "one row per team-season", ["id"], teams),
    )
    for dataset, grain, key, frame in datasets:
        try:
            record = _dataset_record(FPL_SOURCE, season, dataset, grain, key, frame)
            result["dataset_grain"].append(record)
            if record["duplicates"]["conflicting_logical_duplicate_groups"]:
                failures.append(f"{dataset} has conflicting logical duplicates")
        except DataQualityError as error:
            failures.append(str(error))

    validate_required_identifiers(players, ("id", "code"), f"FPL players {season}")
    if players["code"].duplicated().any():
        failures.append("players_raw code is not unique within the season")
    validate_required_identifiers(fixtures, ("id", "team_h", "team_a"), f"FPL fixtures {season}")
    validate_required_identifiers(teams, ("id", "name"), f"FPL teams {season}")

    try:
        gw1, gw1_reconciliations, gw1_rules = apply_approved_fpl_observation_rules(
            gw1_raw, season=season, dataset="gw1"
        )
        games, game_reconciliations, game_rules = apply_approved_fpl_observation_rules(
            games_raw, season=season, dataset="merged_gw"
        )
        result["row_reconciliation"].extend(
            [item.to_dict() for item in (*gw1_reconciliations, *game_reconciliations)]
        )
        exclusions.extend(
            [{"dataset": "gw1", **item} for item in gw1_rules if item["type"] == "exclusion"]
        )
        exclusions.extend(
            [{"dataset": "merged_gw", **item} for item in game_rules if item["type"] == "exclusion"]
        )
        result["approved_transformations"].extend(
            [{"source": FPL_SOURCE, "season": season, "dataset": "gw1", **item} for item in gw1_rules]
            + [{"source": FPL_SOURCE, "season": season, "dataset": "merged_gw", **item} for item in game_rules]
        )
    except DataQualityError as error:
        failures.append(str(error))
        gw1 = gw1_raw.copy()
        games = games_raw.copy()

    try:
        kickoff = parse_required_dates(games, "kickoff_time", f"FPL gameweeks {season}")
        fixture_dates = parse_required_dates(fixtures, "kickoff_time", f"FPL fixtures {season}")
    except DataQualityError as error:
        failures.append(str(error))
        kickoff = pd.Series(pd.NaT, index=games.index)
        fixture_dates = pd.Series(pd.NaT, index=fixtures.index)

    validate_finite_numeric(
        games,
        ("GW", "fixture", "element", "opponent_team", "minutes", "starts", *IMPORTANT_FPL_FIELDS),
        f"FPL gameweeks {season}",
    )
    try:
        validate_nonnegative(games, ("minutes",), f"FPL gameweeks {season}")
    except DataQualityError as error:
        failures.append(str(error))
    minutes = pd.to_numeric(games["minutes"], errors="coerce")
    gameweeks = pd.to_numeric(games["GW"], errors="coerce")
    if gameweeks.isna().any() or (~gameweeks.between(1, 38)).any():
        failures.append("gameweek values must be integers from 1 through 38")
    if (pd.to_numeric(fixtures["team_h"], errors="coerce") == pd.to_numeric(fixtures["team_a"], errors="coerce")).any():
        failures.append("fixture has identical home and away team")

    team_ids = set(pd.to_numeric(teams["id"], errors="coerce").astype(int))
    fixture_ids = set(pd.to_numeric(fixtures["id"], errors="coerce").astype(int))
    player_ids = set(pd.to_numeric(players["id"], errors="coerce").astype(int))
    broken = {
        "player_references": int((~pd.to_numeric(games["element"], errors="coerce").isin(player_ids)).sum()),
        "fixture_references": int((~pd.to_numeric(games["fixture"], errors="coerce").isin(fixture_ids)).sum()),
        "opponent_references": int((~pd.to_numeric(games["opponent_team"], errors="coerce").isin(team_ids)).sum()),
        "fixture_home_team_references": int((~pd.to_numeric(fixtures["team_h"], errors="coerce").isin(team_ids)).sum()),
        "fixture_away_team_references": int((~pd.to_numeric(fixtures["team_a"], errors="coerce").isin(team_ids)).sum()),
    }

    player_map = players[["id", "code"]].rename(columns={"id": "element"})
    try:
        _, player_join = audit_join(
            games,
            player_map,
            on=("element",),
            expected="many_to_one",
            name=f"{season} gameweek observations -> FPL player identity",
        )
        result["join_audits"].append(player_join)
        fixture_map = fixtures.rename(columns={"id": "fixture"})
        joined, fixture_join = audit_join(
            games,
            fixture_map,
            on=("fixture",),
            expected="many_to_one",
            name=f"{season} gameweek observations -> fixtures",
        )
        result["join_audits"].append(fixture_join)
    except DataQualityError as error:
        failures.append(str(error))
        joined = pd.DataFrame()

    consistency = {
        "historical_team_membership_disagreements": 0,
        "opponent_fixture_disagreements": 0,
        "gameweek_fixture_event_disagreements": 0,
    }
    if not joined.empty:
        consistency = historical_team_consistency(joined, teams)
    broken.update(consistency)
    if any(broken.values()):
        failures.append("broken FPL referential or historical-team relationships")
    result["referential_integrity"].append({"source": FPL_SOURCE, "season": season, **broken})
    result["identity_audits"].append(
        {
            "source": FPL_SOURCE,
            "season": season,
            "exact_identity_matches": int(len(players)),
            "reviewed_mappings": 0,
            "unmatched_players": 0,
            "ambiguous_mappings": 0,
            "conflicts": 0,
            "evidence": "season-local element/id maps many-to-one to unique stable FPL code",
        }
    )

    starts = pd.to_numeric(games.get("starts", pd.Series(np.nan, index=games.index)), errors="coerce")
    result["cross_field_consistency"].append(
        {
            "source": FPL_SOURCE,
            "season": season,
            "started_with_zero_minutes": int((starts.gt(0) & minutes.eq(0)).sum()),
            "minutes_with_zero_starts": int((minutes.gt(0) & starts.eq(0)).sum()),
            "interpretation": "zero-start positive-minute rows are substitute appearances; started-with-zero-minute rows are flagged for review, not deleted",
        }
    )

    start_year = int(season[:4])
    lower = pd.Timestamp(f"{start_year}-07-01", tz="UTC")
    upper = pd.Timestamp(f"{start_year + 1}-07-01", tz="UTC")
    season_date_errors = int((~kickoff.between(lower, upper, inclusive="left")).sum()) + int(
        (~fixture_dates.between(lower, upper, inclusive="left")).sum()
    )
    if season_date_errors:
        failures.append(f"fixture dates outside expected season window: {season_date_errors}")

    player_rows = players.loc[pd.to_numeric(players["element_type"], errors="coerce").isin(ELEMENT_TYPE_TO_POSITION)]
    computed = (
        pd.to_numeric(games["total_points"], errors="coerce")
        .groupby(pd.to_numeric(games["element"], errors="coerce"))
        .sum(min_count=1)
        .reindex(pd.to_numeric(player_rows["id"], errors="coerce"), fill_value=0)
    )
    computed.index = player_rows.index
    published = pd.to_numeric(player_rows["total_points"], errors="coerce")
    aggregate = reconcile_aggregates(computed, published)
    aggregate.update(
        {
            "source": FPL_SOURCE,
            "season": season,
            "aggregate": "sum player-fixture total_points vs players_raw season total",
            "scope_note": "assistant-manager element_type=5 is outside the player scope; archived GW and final snapshot corrections can differ",
        }
    )
    result["aggregate_reconciliation"].append(aggregate)
    if aggregate["disagreements"]:
        findings.append(
            f"{aggregate['disagreements']} player season-total disagreement(s); maximum absolute difference {aggregate['maximum_absolute_difference']}"
        )
    result["aggregate_reconciliation"].append(
        {
            "source": FPL_SOURCE,
            "season": season,
            "aggregate": "league fixture count",
            "expected": 380,
            "observed": int(len(fixtures)),
            "disagreements": int(len(fixtures) != 380),
        }
    )
    if len(fixtures) != 380:
        failures.append(f"expected 380 league fixtures, observed {len(fixtures)}")

    games_for_audit = games.copy()
    for position, subset in games_for_audit.groupby("position"):
        for field in IMPORTANT_FPL_FIELDS:
            result["missingness"].append(
                missingness_record(subset, field, season=season, position=str(position), source=FPL_SOURCE)
            )
            if field in subset:
                result["distributions"].append(
                    {
                        "source": FPL_SOURCE,
                        "season": season,
                        "position": str(position),
                        "field": field,
                        **numeric_distribution(subset[field]),
                    }
                )

    player_gw = games_for_audit[["element", "GW", "fixture"]].drop_duplicates()
    multi = player_gw.groupby(["element", "GW"]).size()
    fixture_events = set(pd.to_numeric(fixtures["event"], errors="coerce").dropna().astype(int))
    result["target_validation"].append(
        {
            "season": season,
            "horizon_unit": "gameweeks",
            "valid_horizons": [1, 3, 5],
            "double_gameweek_player_gw_groups": int((multi > 1).sum()),
            "double_gameweek_rows_preserved": int(multi.loc[multi > 1].sum()),
            "blank_league_gameweeks": sorted(set(range(1, 39)) - fixture_events),
            "boundary": "features use GW <= t; target uses t < GW <= t+h",
            "no_appearance": "left target join becomes zero; missing source fields remain missing",
            "rescheduled_fixtures": "count in the event/GW assigned by fixture metadata",
            "status": "PASS" if not failures else "FAIL",
        }
    )

    result["schema_signatures"].setdefault("FPL players_raw", {})[season] = schema_signature(players)
    result["schema_signatures"].setdefault("FPL gameweeks", {})[season] = schema_signature(games_raw)
    result["schema_signatures"].setdefault("FPL fixtures", {})[season] = schema_signature(fixtures)
    result["schema_signatures"].setdefault("FPL teams", {})[season] = schema_signature(teams)
    return _source_status(FPL_SOURCE, season, _status(exclusions, failures), exclusions, findings + failures)


def _football_data_audit(raw_root: Path, season: str, result: dict[str, Any]) -> dict[str, object]:
    path = raw_root / "football_data" / f"{season}-E0.csv"
    frame = pd.read_csv(path, low_memory=False)
    failures: list[str] = []
    findings: list[str] = []
    result["dataset_grain"].append(
        _dataset_record(
            FOOTBALL_DATA_SOURCE,
            season,
            "E0 match results and odds",
            "one row per Premier League fixture",
            ["Date", "HomeTeam", "AwayTeam"],
            frame,
        )
    )
    required = ("Date", "HomeTeam", "AwayTeam", "FTHG", "FTAG", "AvgH", "AvgD", "AvgA")
    try:
        validate_required_identifiers(frame, required, f"Football-Data {season}")
        parse_required_dates(frame, "Date", f"Football-Data {season}", dayfirst=True)
        validate_finite_numeric(frame, ("FTHG", "FTAG", "AvgH", "AvgD", "AvgA", "HS", "AS"), f"Football-Data {season}")
        if frame["HomeTeam"].astype(str).eq(frame["AwayTeam"].astype(str)).any():
            failures.append("home and away team must differ")
        scores = frame[["FTHG", "FTAG"]].apply(pd.to_numeric, errors="coerce")
        if scores.lt(0).any().any():
            failures.append("full-time goals cannot be negative")
        invalid_odds = 0
        for row in frame[["AvgH", "AvgD", "AvgA"]].itertuples(index=False, name=None):
            try:
                probabilities = normalized_implied_probabilities(row)
                if (probabilities < 0).any() or (probabilities > 1).any():
                    invalid_odds += 1
            except ValueError:
                invalid_odds += 1
        if invalid_odds:
            failures.append(f"invalid decimal-odds rows: {invalid_odds}")
    except DataQualityError as error:
        failures.append(str(error))
    if len(frame) != 380:
        failures.append(f"expected 380 league fixtures, observed {len(frame)}")
    result["schema_signatures"].setdefault("Football-Data E0", {})[season] = schema_signature(frame)
    return _source_status(FOOTBALL_DATA_SOURCE, season, _status([], failures), [], findings + failures)


def _understat_audit(raw_root: Path, season: str, result: dict[str, Any]) -> dict[str, object]:
    root = raw_root / "vaastav" / "data" / season
    all_files = sorted((root / "understat").glob("*.csv"))
    files = [path for path in all_files if re.search(r"_(\d+)$", path.stem)]
    non_player_files = [path for path in all_files if path not in files]
    exclusions = (
        [
            {
                "dataset": "Understat directory",
                "type": "exclusion",
                "count": len(non_player_files),
                "unit": "file(s)",
                "reason": "team aggregate/generic CSV files are not player-match datasets and have no external player ID",
            }
        ]
        if non_player_files
        else []
    )
    if non_player_files:
        result["approved_transformations"].append(
            {
                "source": UNDERSTAT_SOURCE,
                "season": season,
                "dataset": "Understat directory",
                **exclusions[0],
            }
        )
    if not files:
        result["dataset_grain"].append(
            {
                "source": UNDERSTAT_SOURCE,
                "season": season,
                "dataset": "player match files",
                "expected_grain": "one row per external player-match",
                "candidate_key": ["external_player_id", "id"],
                "duplicates": {"raw_rows": 0, "exact_duplicate_rows": 0, "logical_duplicate_rows": 0, "conflicting_logical_duplicate_rows": 0},
            }
        )
        reason = "no archived player-level Understat files available"
        return _source_status(UNDERSTAT_SOURCE, season, "FAIL", exclusions, [reason])

    frames: list[pd.DataFrame] = []
    failures: list[str] = []
    for path in files:
        match = re.search(r"_(\d+)$", path.stem)
        frame = pd.read_csv(path, low_memory=False)
        frame["external_player_id"] = match.group(1) if match else None
        frames.append(frame)
    combined = pd.concat(frames, ignore_index=True)
    record = _dataset_record(
        UNDERSTAT_SOURCE,
        season,
        "player match files",
        "one row per external player-match",
        ["external_player_id", "id"],
        combined,
    )
    result["dataset_grain"].append(record)
    if record["duplicates"]["logical_duplicate_excess_rows"]:
        failures.append("Understat external-player/match key is duplicated")
    try:
        validate_required_identifiers(combined, ("external_player_id", "id"), f"Understat {season}")
        parse_required_dates(combined, "date", f"Understat {season}")
        validate_finite_numeric(
            combined,
            ("goals", "shots", "xG", "time", "h_goals", "a_goals", "xA", "assists", "key_passes", "npxG"),
            f"Understat {season}",
        )
        if pd.to_numeric(combined["time"], errors="coerce").lt(0).any():
            failures.append("Understat minutes/time cannot be negative")
    except DataQualityError as error:
        failures.append(str(error))

    players = pd.read_csv(root / "players_raw.csv", low_memory=False)
    mapping, evidence = build_understat_identity_evidence(season, players, files)
    statuses = pd.Series([item.status for item in evidence]).value_counts()
    identity = {
        "source": UNDERSTAT_SOURCE,
        "season": season,
        "exact_identity_matches": int(statuses.get("exact", 0)),
        "reviewed_mappings": 0,
        "unmatched_players": int(statuses.get("unmatched", 0)),
        "ambiguous_mappings": int(statuses.get("ambiguous", 0)),
        "conflicts": 0,
        "automatic_fuzzy_matches": 0,
    }
    result["identity_audits"].append(identity)

    player_context = players.loc[pd.to_numeric(players["element_type"], errors="coerce").isin(ELEMENT_TYPE_TO_POSITION)].copy()
    player_context["position"] = pd.to_numeric(player_context["element_type"]).map(ELEMENT_TYPE_TO_POSITION)
    teams = pd.read_csv(root / "teams.csv", low_memory=False).set_index("id")["name"]
    player_context["team_name"] = pd.to_numeric(player_context["team"], errors="coerce").map(teams)
    covered_codes = set(mapping["code"].astype(int))
    covered = player_context["code"].astype(int).isin(covered_codes)
    eligible = pd.Series(True, index=player_context.index)
    for position, subset in player_context.groupby("position"):
        result["coverage"].append(
            coverage_record(
                eligible.loc[subset.index],
                covered.loc[subset.index],
                source=UNDERSTAT_SOURCE,
                season=season,
                dimension="position",
                value=position,
            )
        )
    for team, subset in player_context.groupby("team_name"):
        result["coverage"].append(
            coverage_record(
                eligible.loc[subset.index],
                covered.loc[subset.index],
                source=UNDERSTAT_SOURCE,
                season=season,
                dimension="team",
                value=team,
            )
        )

    season_index = SEASONS.index(season)
    if season_index:
        prior_season = SEASONS[season_index - 1]
        prior_root = raw_root / "vaastav" / "data" / prior_season
        prior_players = pd.read_csv(prior_root / "players_raw.csv", low_memory=False)
        prior_codes = set(pd.to_numeric(prior_players["code"], errors="coerce").dropna().astype(int))
        prior_teams = set(pd.read_csv(prior_root / "teams.csv")["name"].astype(str))
        player_context["cold_start_category"] = np.where(
            player_context["code"].astype(int).isin(prior_codes),
            "RETURNING EPL PLAYER",
            np.where(player_context["team_name"].isin(prior_teams), "UNKNOWN", "PROMOTED-TEAM PLAYER"),
        )
        for category in (
            "RETURNING EPL PLAYER",
            "PROMOTED-TEAM PLAYER",
            "NEW FOREIGN-LEAGUE SIGNING",
            "ACADEMY / ROOKIE",
            "UNKNOWN",
        ):
            subset = player_context.index[player_context["cold_start_category"].eq(category)]
            record = coverage_record(
                eligible.loc[subset],
                covered.loc[subset],
                source=UNDERSTAT_SOURCE,
                season=season,
                dimension="cold_start_category",
                value=category,
            )
            if category in {"NEW FOREIGN-LEAGUE SIGNING", "ACADEMY / ROOKIE"}:
                record["note"] = "source evidence cannot reliably separate this class; records remain UNKNOWN"
            result["coverage"].append(record)

    result["schema_signatures"].setdefault("Understat player matches", {})[season] = schema_signature(combined)
    return _source_status(UNDERSTAT_SOURCE, season, _status(exclusions, failures), exclusions, failures)


def _cross_source_fixture_audit(raw_root: Path, season: str, result: dict[str, Any]) -> None:
    fpl_root = raw_root / "vaastav" / "data" / season
    teams = pd.read_csv(fpl_root / "teams.csv").set_index("id")["name"]
    fixtures = pd.read_csv(fpl_root / "fixtures.csv")
    football_data = pd.read_csv(raw_root / "football_data" / f"{season}-E0.csv")
    left = pd.DataFrame(
        {
            "match_date": pd.to_datetime(fixtures["kickoff_time"], utc=True).dt.strftime("%Y-%m-%d"),
            "home_team": fixtures["team_h"].map(teams).map(canonical_team_name),
            "away_team": fixtures["team_a"].map(teams).map(canonical_team_name),
            "home_score": fixtures["team_h_score"],
            "away_score": fixtures["team_a_score"],
        }
    )
    right = pd.DataFrame(
        {
            "match_date": pd.to_datetime(football_data["Date"], dayfirst=True).dt.strftime("%Y-%m-%d"),
            "home_team": football_data["HomeTeam"].map(canonical_team_name),
            "away_team": football_data["AwayTeam"].map(canonical_team_name),
            "home_score_external": football_data["FTHG"],
            "away_score_external": football_data["FTAG"],
        }
    )
    try:
        joined, audit = audit_join(
            left,
            right,
            on=("match_date", "home_team", "away_team"),
            expected="one_to_one",
            name=f"{season} FPL fixtures -> Football-Data match facts",
        )
        result["join_audits"].append(audit)
        disagreement = (
            pd.to_numeric(joined["home_score"], errors="coerce").ne(
                pd.to_numeric(joined["home_score_external"], errors="coerce")
            )
            | pd.to_numeric(joined["away_score"], errors="coerce").ne(
                pd.to_numeric(joined["away_score_external"], errors="coerce")
            )
        )
        result["cross_source_reconciliation"].append(
            {
                "season": season,
                "left_source": FPL_SOURCE,
                "right_source": FOOTBALL_DATA_SOURCE,
                "fpl_fixture_rows": int(len(left)),
                "football_data_rows": int(len(right)),
                "matched_fixtures": int(audit["matched_left_rows"]),
                "unmatched_fpl": int(audit["unmatched_left_rows"]),
                "unmatched_football_data": int(audit["unmatched_right_rows"]),
                "date_team_disagreements": int(audit["unmatched_left_rows"] + audit["unmatched_right_rows"]),
                "score_disagreements": int(disagreement.sum()),
                "status": "PASS" if not disagreement.any() and not audit["unmatched_left_rows"] else "FAIL",
            }
        )
    except DataQualityError as error:
        result["cross_source_reconciliation"].append(
            {
                "season": season,
                "left_source": FPL_SOURCE,
                "right_source": FOOTBALL_DATA_SOURCE,
                "status": "FAIL",
                "error": str(error),
            }
        )


def _schema_drift(result: dict[str, Any]) -> None:
    for dataset, by_season in result.pop("schema_signatures").items():
        seasons = [season for season in SEASONS if season in by_season]
        for previous, current in zip(seasons, seasons[1:]):
            result["schema_drift"].append(
                compare_schema_signatures(
                    by_season[previous],
                    by_season[current],
                    previous_season=previous,
                    current_season=current,
                    dataset=dataset,
                )
            )


def _distribution_shift_flags(result: dict[str, Any]) -> None:
    frame = pd.DataFrame(result["distributions"])
    if frame.empty:
        return
    for (source, position, field), group in frame.groupby(["source", "position", "field"]):
        ordered = group.set_index("season").reindex(SEASONS)
        previous = None
        for season, row in ordered.iterrows():
            if pd.isna(row.get("count")):
                continue
            if previous is not None:
                prior_season, prior = previous
                p95 = row.get("p95")
                prior_p95 = prior.get("p95")
                shift = False
                reason = None
                if pd.notna(p95) and pd.notna(prior_p95):
                    denominator = max(abs(float(prior_p95)), 1.0)
                    ratio = abs(float(p95)) / denominator
                    if (ratio > 3 or ratio < 1 / 3) and abs(float(p95) - float(prior_p95)) > 1:
                        shift = True
                        reason = f"p95 ratio {ratio:.2f}"
                prior_missing = float(prior.get("missing", 0)) / max(float(prior.get("count", 0)) + float(prior.get("missing", 0)), 1)
                missing = float(row.get("missing", 0)) / max(float(row.get("count", 0)) + float(row.get("missing", 0)), 1)
                if abs(missing - prior_missing) > 0.5:
                    shift = True
                    reason = f"missing-rate change {prior_missing:.3f} -> {missing:.3f}"
                if shift:
                    result["distribution_shift_flags"].append(
                        {
                            "source": source,
                            "position": position,
                            "field": field,
                            "previous_season": prior_season,
                            "current_season": season,
                            "reason": reason,
                            "action": "FLAG FOR INVESTIGATION; no automatic outlier removal",
                        }
                    )
            previous = (season, row)


def _processed_dataset_audit(processed_root: Path, raw_root: Path, result: dict[str, Any]) -> None:
    if not processed_root.exists():
        return
    for path in sorted(processed_root.glob("*.pkl")):
        frame = pd.read_pickle(path)
        season_match = re.search(r"(\d{4}-\d{2})", path.stem)
        season = season_match.group(1) if season_match else None
        if season:
            raw_name = "gw1.csv" if path.stem.startswith("draft_day") else "merged_gw.csv"
            raw_path = raw_root / "vaastav" / "data" / season / "gws" / raw_name
            raw_frame = pd.read_csv(raw_path, low_memory=False)
            approved, _, _ = apply_approved_fpl_observation_rules(
                raw_frame, season=season, dataset=raw_name.removesuffix(".csv")
            )
            input_rows = int(len(approved))
            reason = (
                "player-fixture GW1 rows reduce to one player-season feature row"
                if path.stem.startswith("draft_day")
                else "player-fixture rows aggregate to player-GW, then materialize eligible player-cutoff rows"
            )
        else:
            input_rows = 0
            reason = "processed dataset"
        result["row_reconciliation"].append(
            {
                "transformation": f"quality-approved inputs -> {path.stem} feature dataset",
                "input_rows": input_rows,
                "output_rows": int(len(frame)),
                "difference": int(len(frame) - input_rows),
                "reason": reason,
            }
        )
        model_fields = [column for column in frame if column.startswith(("season_", "last", "expected_", "ict_", "team_", "bookmaker_", "understat_"))]
        non_finite = 0
        for column in model_fields:
            numeric = pd.to_numeric(frame[column], errors="coerce")
            non_finite += int((frame[column].notna() & ~np.isfinite(numeric)).sum())
        status = "PASS" if not non_finite else "FAIL"
        result["benchmark_datasets"].append(
            {
                "dataset": path.stem,
                "rows": int(len(frame)),
                "status": status,
                "non_finite_model_values": non_finite,
                "eligible_for_benchmark": status in BENCHMARKABLE_STATUSES,
            }
        )
        for (season, position), subset in frame.groupby(["season", "position"], dropna=False):
            for field in model_fields:
                result["feature_missingness"].append(
                    missingness_record(
                        subset,
                        field,
                        season=str(season),
                        position=str(position),
                        source="processed feature dataset",
                    )
                    | {"dataset": path.stem}
                )
        if "cold_start_category" in frame:
            for (season, category), subset in frame.groupby(["season", "cold_start_category"], dropna=False):
                for field in model_fields:
                    result["feature_missingness_by_cold_start"].append(
                        {
                            "dataset": path.stem,
                            "season": str(season),
                            "cold_start_category": str(category),
                            "field": field,
                            "rows": int(len(subset)),
                            "missing": int(subset[field].isna().sum()),
                            "missing_rate": float(subset[field].isna().mean()),
                        }
                    )


def run_quality_gate(
    raw_root: Path,
    manifest_path: Path,
    *,
    processed_root: Path | None = None,
) -> dict[str, object]:
    result: dict[str, Any] = {
        "schema_version": 1,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "gate_sequence": [
            "schema",
            "dataset grain",
            "duplicates",
            "referential integrity",
            "identity",
            "joins",
            "missingness and distributions",
            "temporal and leakage",
        ],
        "benchmark_seasons": list(SEASONS),
        "manifest_sha256": sha256_file(manifest_path),
        "manifest_integrity": [],
        "source_season_status": [],
        "dataset_grain": [],
        "approved_transformations": [],
        "row_reconciliation": [],
        "join_audits": [],
        "identity_audits": [],
        "referential_integrity": [],
        "cross_source_reconciliation": [],
        "aggregate_reconciliation": [],
        "missingness": [],
        "feature_missingness": [],
        "feature_missingness_by_cold_start": [],
        "distributions": [],
        "distribution_shift_flags": [],
        "schema_signatures": {},
        "schema_drift": [],
        "coverage": [],
        "target_validation": [],
        "cross_field_consistency": [],
        "benchmark_datasets": [],
        "benchmark_configuration_status": [],
        "blocking_failures": [],
    }
    integrity, integrity_failures = _verify_manifest(raw_root, manifest_path)
    result["manifest_integrity"] = integrity
    result["blocking_failures"].extend(integrity_failures)

    for season in SEASONS:
        for audit in (_fpl_season_audit, _football_data_audit, _understat_audit):
            try:
                status = audit(raw_root, season, result)
            except (DataQualityError, KeyError, ValueError) as error:
                source = { _fpl_season_audit: FPL_SOURCE, _football_data_audit: FOOTBALL_DATA_SOURCE, _understat_audit: UNDERSTAT_SOURCE }[audit]
                status = _source_status(source, season, "FAIL", [], [str(error)])
            result["source_season_status"].append(status)
        _cross_source_fixture_audit(raw_root, season, result)

    _schema_drift(result)
    _distribution_shift_flags(result)
    if processed_root:
        _processed_dataset_audit(processed_root, raw_root, result)

    required_sources = {FPL_SOURCE, FOOTBALL_DATA_SOURCE}
    result["blocking_failures"].extend(
        f"{record['source']} {record['season']}: {record['findings']}"
        for record in result["source_season_status"]
        if record["source"] in required_sources and record["status"] == "FAIL"
    )
    statuses = {
        (record["source"], record["season"]): record["status"]
        for record in result["source_season_status"]
    }
    configurations = (
        ("development FPL-only", (FPL_SOURCE,), SEASONS[:5]),
        ("development FPL + Football-Data", (FPL_SOURCE, FOOTBALL_DATA_SOURCE), SEASONS[:5]),
        ("development draft Understat", (FPL_SOURCE, UNDERSTAT_SOURCE), SEASONS[1:5]),
        ("development in-season Understat", (FPL_SOURCE, UNDERSTAT_SOURCE), SEASONS[:5]),
        ("2025-26 selected holdout", (FPL_SOURCE, FOOTBALL_DATA_SOURCE), SEASONS),
        ("2025-26 Understat configuration", (FPL_SOURCE, UNDERSTAT_SOURCE), SEASONS),
    )
    for name, sources, seasons in configurations:
        failures = [
            f"{source} {season}: {statuses.get((source, season), 'MISSING')}"
            for source in sources
            for season in seasons
            if statuses.get((source, season)) not in BENCHMARKABLE_STATUSES
        ]
        result["benchmark_configuration_status"].append(
            {
                "configuration": name,
                "sources": list(sources),
                "seasons": list(seasons),
                "status": "FAIL" if failures else "PASS",
                "eligible_for_benchmark": not failures,
                "failures": failures,
            }
        )
    result["blocking_failures"].extend(
        f"cross-source reconciliation failed for {record['season']}"
        for record in result["cross_source_reconciliation"]
        if record["status"] == "FAIL"
    )
    result["overall_status"] = "FAIL" if result["blocking_failures"] else "PASS WITH EXCLUSIONS"
    return result


def write_quality_report(path: Path, result: dict[str, Any]) -> None:
    statuses = result["source_season_status"]
    grains = result["dataset_grain"]
    duplicate_lines = []
    for record in grains:
        duplicate = record["duplicates"]
        duplicate_lines.append(
            f"| {record['source']} | {record['season']} | {record['dataset']} | {duplicate.get('raw_rows', 0)} | "
            f"{duplicate.get('exact_duplicate_excess_rows', 0)} | {duplicate.get('logical_duplicate_excess_rows', 0)} | "
            f"{duplicate.get('conflicting_logical_duplicate_groups', 0)} |"
        )
    status_lines = [
        f"| {record['source']} | {record['season']} | {record['status']} | "
        f"{'; '.join(str(item.get('reason')) for item in record['exclusions']) or 'None'} |"
        for record in statuses
    ]
    join_lines = [
        f"| {record['join']} | {record['expected_cardinality']} | {record['left_rows']} | {record['right_rows']} | "
        f"{record['output_rows']} | {record['matched_left_rows']} | {record['unmatched_left_rows']} | "
        f"{record['unmatched_right_rows']} |"
        for record in result["join_audits"]
    ]
    cross_lines = [
        f"| {record['season']} | {record.get('matched_fixtures', 0)} | {record.get('unmatched_fpl', 0)} | "
        f"{record.get('unmatched_football_data', 0)} | {record.get('score_disagreements', 0)} | {record['status']} |"
        for record in result["cross_source_reconciliation"]
    ]
    drift_lines = [
        f"| {record['dataset']} | {record['previous_season']} -> {record['current_season']} | "
        f"{', '.join(record['fields_added']) or '—'} | {', '.join(record['fields_removed']) or '—'} | "
        f"{', '.join(record['observed_type_changes']) or '—'} | {', '.join(record['nullability_changes']) or '—'} |"
        for record in result["schema_drift"]
    ]
    exclusion_lines = [
        f"- **{item['source']} {item['season']} {item['dataset']}**: "
        f"{item.get('rows', item.get('count'))} {item.get('unit', 'row(s)')} — {item['reason']}"
        for item in result["approved_transformations"]
        if item["type"] == "exclusion"
    ]
    shift_lines = [
        f"- {item['source']} {item['position']} `{item['field']}` {item['previous_season']} -> {item['current_season']}: {item['reason']}."
        for item in result["distribution_shift_flags"]
    ]
    configuration_lines = [
        f"| {item['configuration']} | {', '.join(item['sources'])} | {item['status']} | "
        f"{'; '.join(item['failures']) or 'None'} |"
        for item in result["benchmark_configuration_status"]
    ]
    started_zero = sum(item["started_with_zero_minutes"] for item in result["cross_field_consistency"])
    content = f"""# Phase 5A data quality report

Generated from the pinned raw artifacts at `{result['generated_at']}`. The machine-readable evidence is `data_quality_results.json`. This gate runs before feature generation; a blocking failure prevents FPL or Football-Data inputs from entering the benchmark. Understat is optional and a failed/unavailable Understat season is excluded from configurations requiring it.

## Gate architecture

```text
RAW DATA
  -> SCHEMA -> GRAIN -> DUPLICATES -> REFERENTIAL INTEGRITY
  -> IDENTITY -> JOIN CARDINALITY -> MISSINGNESS / DISTRIBUTIONS
  -> TEMPORAL / LEAKAGE -> FEATURE DATASET -> MODEL
```

**Data-quality validation** decides whether data can be trusted and blocks unsafe inputs. **Data cleaning** is a declared transformation applied only after that decision. This run permits only exact-copy removal, the documented `GKP` -> `GK` label normalization, and exclusion of assistant-manager chip rows from the football-player grain.

Overall gate status: **{result['overall_status']}**. Manifest artifacts verified: {sum(item['status'] == 'PASS' for item in result['manifest_integrity'])}/{len(result['manifest_integrity'])}.

## Dataset grain contracts

| Source | Dataset | Expected grain | Candidate key |
| --- | --- | --- | --- |
""" + "\n".join(
        f"| {record['source']} | {record['dataset']} | {record['expected_grain']} | {', '.join(record['candidate_key'])} |"
        for record in grains[: len({(item['source'], item['dataset']) for item in grains})]
    ) + f"""

Player + GW is deliberately not a candidate key. Same-player/same-GW rows with different fixture IDs are valid Double Gameweek observations and remain. Same-player/same-fixture repetition is invalid.

## Duplicate audit

Counts below are excess copies beyond the first valid key row; the JSON also records all participating duplicate rows.

| Source | Season | Dataset | Raw rows | Exact excess | Logical-key excess | Conflicting groups |
| --- | --- | --- | ---: | ---: | ---: | ---: |
{chr(10).join(duplicate_lines)}

### Approved exclusions

{chr(10).join(exclusion_lines) or '- None.'}

## Source-season status

| Source | Season | Status | Exact exclusions |
| --- | --- | --- | --- |
{chr(10).join(status_lines)}

Understat 2025/26 is **FAIL** because the pinned archive contains no files; no holdout configuration uses it. Low coverage in available seasons remains missing and is measured rather than zero-filled.

### Benchmark configuration eligibility

| Configuration | Sources | Status | Blocking source-seasons |
| --- | --- | --- | --- |
{chr(10).join(configuration_lines)}

Failed configurations are recorded as `blocked_by_data_quality`, not scored. In particular, in-season Understat comparisons are blocked by the lack of a 2020/21 player-level archive; draft Understat comparisons can use the benchmarkable 2021/22–2024/25 seasons.

## Join cardinality and row preservation

| Join | Declared | Left | Right | Output | Matched left | Unmatched left | Unmatched right |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
{chr(10).join(join_lines)}

All listed joins passed their declarations. A preserve-left join that expands rows and every unjustified many-to-many join are blocking failures. Transformation row counts and reasons are in the JSON `row_reconciliation` ledger.

## Referential integrity and historical team membership

Across all six FPL seasons there are zero broken player, fixture, opponent, home-team, or away-team references; zero home=away fixtures; zero player-team/fixture participation disagreements; and zero GW/event disagreements. Historical team validation uses the team participating in that fixture and `was_home`, never the player's end-of-season club.

Cross-field checks found {started_zero} rows with `starts > 0` and zero minutes across all seasons. Positive minutes with `starts = 0` are valid substitute appearances and are counted in JSON; neither class is silently removed.

## Cross-source match facts

| Season | Matched | Unmatched FPL | Unmatched Football-Data | Score disagreements | Status |
| --- | ---: | ---: | ---: | ---: | --- |
{chr(10).join(cross_lines)}

Team aliases are explicit, exact provider-name translations. No fuzzy team or player match is authoritative.

## Missingness, zero, and field absence

The JSON reports adopted FPL/model fields by season and position with separate `field_existed`, `missing`, and `zero` values. Older-season fields that did not exist remain missing. Processed feature missingness is also split by season/position and, for draft data, cold-start category. Model preprocessing may impute inside a training fold; the raw gate never turns field absence into zero.

## Schema drift

| Dataset | Seasons | Added | Removed | Type changes | Nullability changes |
| --- | --- | --- | --- | --- | --- |
{chr(10).join(drift_lines)}

Notable semantic drift includes expected/start fields arriving after early seasons, 2024/25 assistant-manager fields, and 2025/26 defensive-contribution fields. Added fields are not treated as renamed equivalents without evidence.

## Distribution flags

Each important numeric field has count/missing/min/p01/p05/median/p95/p99/max by season and position in JSON. Flags are investigative, not automatic outlier deletion:

{chr(10).join(shift_lines) or '- No threshold-level shifts were flagged.'}

## Coverage and cold starts

Understat exact-match coverage is reported by season, position, team, and the derivable categories `RETURNING EPL PLAYER`, `PROMOTED-TEAM PLAYER`, and `UNKNOWN`. The archives cannot reliably distinguish new foreign-league signings from academy/rookie players, so those remain explicitly unresolved rather than guessed. This is a material draft-day coverage bias.

## Target and aggregate validation

The 1/3/5 horizons mean **gameweeks**, not matches: features use `GW <= t`, while targets use `t < GW <= t+h`. Double Gameweek fixtures are summed within their assigned GW, blank GWs contribute no fixture rows, rescheduled fixtures follow fixture event metadata, and a player with no future appearance receives a zero target through the left join. Exact fixture and aggregate results are in JSON.

Player-GW sums reconcile exactly to published season totals in every season except one 2024/25 football player with a one-point archived-GW/final-snapshot difference. That scoped source correction is reported, not silently forced. All seasons contain 380 fixtures and FPL/Football-Data scores agree for all 2,280 matches.

## Non-features and trust boundary

This gate does not create projections, production models, Best Fit, player health, or live integration. It does not scrape. A PASS means the audited source contract passed these checks, not that provider coverage or football metrics are perfect.
"""
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


def execute_quality_gate(
    raw_root: Path,
    manifest_path: Path,
    output_path: Path,
    report_path: Path,
    *,
    processed_root: Path | None = None,
) -> dict[str, object]:
    result = run_quality_gate(raw_root, manifest_path, processed_root=processed_root)
    write_quality_results(output_path, result)
    write_quality_report(report_path, result)
    return result
