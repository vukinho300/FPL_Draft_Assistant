from __future__ import annotations

import json
import math
from collections.abc import Iterable, Sequence
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Literal

import numpy as np
import pandas as pd


QualityStatus = Literal["PASS", "PASS WITH EXCLUSIONS", "FAIL"]
JoinCardinality = Literal["one_to_one", "one_to_many", "many_to_one", "many_to_many"]

BENCHMARKABLE_STATUSES = {"PASS", "PASS WITH EXCLUSIONS"}
FPL_PLAYER_POSITIONS = {"GK", "DEF", "MID", "FWD"}
KNOWN_RAW_FPL_POSITIONS = FPL_PLAYER_POSITIONS | {"GKP", "AM"}


class DataQualityError(ValueError):
    """A blocking failure at the raw-to-feature quality boundary."""


@dataclass(frozen=True)
class RowReconciliation:
    transformation: str
    input_rows: int
    output_rows: int
    difference: int
    reason: str

    def to_dict(self) -> dict[str, object]:
        return {
            "transformation": self.transformation,
            "input_rows": self.input_rows,
            "output_rows": self.output_rows,
            "difference": self.difference,
            "reason": self.reason,
        }


def _records_for_key(frame: pd.DataFrame, key: Sequence[str]) -> set[tuple[object, ...]]:
    if frame.empty:
        return set()
    return set(frame[list(key)].itertuples(index=False, name=None))


def audit_duplicates(frame: pd.DataFrame, candidate_key: Sequence[str]) -> dict[str, int]:
    """Classify duplicate rows without modifying the source frame."""
    missing = [column for column in candidate_key if column not in frame]
    if missing:
        raise DataQualityError(f"candidate key fields are missing: {missing}")
    if frame[list(candidate_key)].isna().any().any():
        raise DataQualityError(f"candidate key contains missing values: {list(candidate_key)}")

    exact_mask = frame.duplicated(keep=False)
    logical_mask = frame.duplicated(list(candidate_key), keep=False)
    conflicting_groups = 0
    conflicting_rows = 0
    if logical_mask.any():
        for _, group in frame.loc[logical_mask].groupby(list(candidate_key), dropna=False, sort=False):
            if len(group.drop_duplicates()) > 1:
                conflicting_groups += 1
                conflicting_rows += len(group)
    return {
        "raw_rows": int(len(frame)),
        "exact_duplicate_rows": int(exact_mask.sum()),
        "exact_duplicate_excess_rows": int(frame.duplicated(keep="first").sum()),
        "logical_duplicate_rows": int(logical_mask.sum()),
        "logical_duplicate_excess_rows": int(frame.duplicated(list(candidate_key), keep="first").sum()),
        "conflicting_logical_duplicate_groups": int(conflicting_groups),
        "conflicting_logical_duplicate_rows": int(conflicting_rows),
    }


def apply_approved_fpl_observation_rules(
    frame: pd.DataFrame,
    *,
    season: str,
    dataset: str,
) -> tuple[pd.DataFrame, list[RowReconciliation], list[dict[str, object]]]:
    """Apply only the explicit source rules approved by the Phase 5A gate."""
    if not {"element", "fixture", "position"}.issubset(frame.columns):
        raise DataQualityError(f"{dataset} {season} lacks element, fixture or position")
    unknown = sorted(set(frame["position"].dropna().astype(str)) - KNOWN_RAW_FPL_POSITIONS)
    if unknown:
        raise DataQualityError(f"{dataset} {season} has invalid positions: {unknown}")

    result = frame.copy()
    reconciliations: list[RowReconciliation] = []
    transformations: list[dict[str, object]] = []
    duplicates = audit_duplicates(result, ("element", "fixture"))
    if duplicates["conflicting_logical_duplicate_groups"]:
        raise DataQualityError(f"{dataset} {season} has conflicting player-fixture duplicates")
    if duplicates["logical_duplicate_excess_rows"]:
        if duplicates["logical_duplicate_excess_rows"] != duplicates["exact_duplicate_excess_rows"]:
            raise DataQualityError(f"{dataset} {season} has unexplained logical duplicates")
        before = len(result)
        result = result.drop_duplicates().reset_index(drop=True)
        reconciliations.append(
            RowReconciliation(
                f"{dataset} {season}: remove exact duplicate rows",
                before,
                len(result),
                len(result) - before,
                "candidate-key duplicates were byte-for-byte equivalent across all parsed fields",
            )
        )
        transformations.append(
            {
                "type": "exclusion",
                "rows": before - len(result),
                "reason": "exact duplicate player-fixture observations; one identical copy retained",
            }
        )

    legacy_gkp = int(result["position"].eq("GKP").sum())
    if legacy_gkp:
        result.loc[result["position"].eq("GKP"), "position"] = "GK"
        transformations.append(
            {
                "type": "normalization",
                "rows": legacy_gkp,
                "reason": "legacy source label GKP is the same FPL goalkeeper position as GK",
            }
        )

    assistant_rows = int(result["position"].eq("AM").sum())
    if assistant_rows:
        before = len(result)
        result = result.loc[~result["position"].eq("AM")].reset_index(drop=True)
        reconciliations.append(
            RowReconciliation(
                f"{dataset} {season}: exclude assistant-manager observations",
                before,
                len(result),
                len(result) - before,
                "assistant-manager chips are not football players and violate the player-fixture grain",
            )
        )
        transformations.append(
            {
                "type": "exclusion",
                "rows": assistant_rows,
                "reason": "assistant-manager chip observations are outside the football-player benchmark scope",
            }
        )

    remaining = set(result["position"].dropna().astype(str))
    if not remaining.issubset(FPL_PLAYER_POSITIONS):
        raise DataQualityError(f"{dataset} {season} has non-player positions after approved rules: {sorted(remaining)}")
    return result, reconciliations, transformations


def audit_join(
    left: pd.DataFrame,
    right: pd.DataFrame,
    *,
    on: Sequence[str],
    expected: JoinCardinality,
    name: str,
    how: Literal["left", "inner"] = "left",
    preserve_left: bool = True,
    many_to_many_justification: str | None = None,
) -> tuple[pd.DataFrame, dict[str, object]]:
    """Execute a declared join and fail if its observed cardinality is unsafe."""
    missing_left = [column for column in on if column not in left]
    missing_right = [column for column in on if column not in right]
    if missing_left or missing_right:
        raise DataQualityError(f"{name} join key missing (left={missing_left}, right={missing_right})")
    if expected == "many_to_many" and not many_to_many_justification:
        raise DataQualityError(f"{name} many-to-many join requires a documented justification")

    left_counts = left.groupby(list(on), dropna=False).size().rename("left_count")
    right_counts = right.groupby(list(on), dropna=False).size().rename("right_count")
    overlap = left_counts.to_frame().join(right_counts, how="inner")
    category_counts = {
        "one_to_one_matches": int(((overlap.left_count == 1) & (overlap.right_count == 1)).sum()),
        "one_to_many_matches": int(((overlap.left_count == 1) & (overlap.right_count > 1)).sum()),
        "many_to_one_matches": int(((overlap.left_count > 1) & (overlap.right_count == 1)).sum()),
        "many_to_many_matches": int(((overlap.left_count > 1) & (overlap.right_count > 1)).sum()),
    }
    observed_invalid = {
        "one_to_one": category_counts["one_to_many_matches"] + category_counts["many_to_one_matches"] + category_counts["many_to_many_matches"],
        "one_to_many": category_counts["many_to_one_matches"] + category_counts["many_to_many_matches"],
        "many_to_one": category_counts["one_to_many_matches"] + category_counts["many_to_many_matches"],
        "many_to_many": 0,
    }[expected]
    if observed_invalid:
        raise DataQualityError(f"{name} violates declared {expected} cardinality")

    left_keys = _records_for_key(left, on)
    right_keys = _records_for_key(right, on)
    matched_left = int(left[list(on)].apply(tuple, axis=1).isin(right_keys).sum())
    matched_right = int(right[list(on)].apply(tuple, axis=1).isin(left_keys).sum())
    try:
        output = left.merge(right, on=list(on), how=how, validate=expected, suffixes=("", "_right"))
    except pd.errors.MergeError as error:
        raise DataQualityError(f"{name} join failed declared {expected} cardinality") from error
    if preserve_left and len(output) > len(left):
        raise DataQualityError(f"{name} unexpectedly multiplied left rows ({len(left)} -> {len(output)})")
    audit: dict[str, object] = {
        "join": name,
        "keys": list(on),
        "expected_cardinality": expected,
        "left_rows": int(len(left)),
        "right_rows": int(len(right)),
        "output_rows": int(len(output)),
        "matched_left_rows": matched_left,
        "unmatched_left_rows": int(len(left) - matched_left),
        "unmatched_right_rows": int(len(right) - matched_right),
        **category_counts,
        "ambiguous_mappings": int(category_counts["one_to_many_matches"] + category_counts["many_to_many_matches"]),
        "status": "PASS",
    }
    if many_to_many_justification:
        audit["many_to_many_justification"] = many_to_many_justification
    return output, audit


def validate_required_identifiers(frame: pd.DataFrame, columns: Iterable[str], dataset: str) -> None:
    for column in columns:
        if column not in frame:
            raise DataQualityError(f"{dataset} missing required identifier {column}")
        values = frame[column]
        empty = values.isna() | values.astype(str).str.strip().eq("")
        if empty.any():
            raise DataQualityError(f"{dataset} has {int(empty.sum())} empty {column} identifiers")


def validate_finite_numeric(frame: pd.DataFrame, columns: Iterable[str], dataset: str) -> None:
    for column in columns:
        if column not in frame:
            continue
        numeric = pd.to_numeric(frame[column], errors="coerce")
        invalid = frame[column].notna() & (~np.isfinite(numeric))
        if invalid.any():
            raise DataQualityError(f"{dataset} has {int(invalid.sum())} non-finite {column} values")


def validate_nonnegative(frame: pd.DataFrame, columns: Iterable[str], dataset: str) -> None:
    validate_finite_numeric(frame, columns, dataset)
    for column in columns:
        if column not in frame:
            continue
        negative = pd.to_numeric(frame[column], errors="coerce").lt(0)
        if negative.any():
            raise DataQualityError(f"{dataset} has {int(negative.sum())} negative {column} values")


def parse_required_dates(frame: pd.DataFrame, column: str, dataset: str, *, dayfirst: bool = False) -> pd.Series:
    if column not in frame:
        raise DataQualityError(f"{dataset} missing required date {column}")
    parsed = pd.to_datetime(frame[column], errors="coerce", utc=True, dayfirst=dayfirst)
    if parsed.isna().any():
        raise DataQualityError(f"{dataset} has {int(parsed.isna().sum())} malformed {column} values")
    return parsed


def schema_signature(frame: pd.DataFrame) -> dict[str, dict[str, object]]:
    def observed_type(series: pd.Series) -> str:
        if pd.api.types.is_bool_dtype(series):
            return "boolean"
        if pd.api.types.is_numeric_dtype(series):
            return "numeric"
        if pd.api.types.is_datetime64_any_dtype(series):
            return "datetime"
        return "string/object"

    return {
        column: {
            "observed_type": observed_type(frame[column]),
            "nullable": bool(frame[column].isna().any()),
        }
        for column in frame.columns
    }


def compare_schema_signatures(
    previous: dict[str, dict[str, object]],
    current: dict[str, dict[str, object]],
    *,
    previous_season: str,
    current_season: str,
    dataset: str,
) -> dict[str, object]:
    shared = set(previous) & set(current)
    return {
        "dataset": dataset,
        "previous_season": previous_season,
        "current_season": current_season,
        "fields_added": sorted(set(current) - set(previous)),
        "fields_removed": sorted(set(previous) - set(current)),
        "observed_type_changes": sorted(
            column for column in shared if previous[column]["observed_type"] != current[column]["observed_type"]
        ),
        "nullability_changes": sorted(column for column in shared if previous[column]["nullable"] != current[column]["nullable"]),
    }


def numeric_distribution(series: pd.Series) -> dict[str, object]:
    numeric = pd.to_numeric(series, errors="coerce")
    finite = numeric[np.isfinite(numeric)]
    result: dict[str, object] = {
        "count": int(finite.count()),
        "missing": int(numeric.isna().sum()),
    }
    for label, quantile in (("min", 0), ("p01", 0.01), ("p05", 0.05), ("median", 0.5), ("p95", 0.95), ("p99", 0.99), ("max", 1)):
        result[label] = None if finite.empty else float(finite.quantile(quantile))
    return result


def missingness_record(
    frame: pd.DataFrame,
    field: str,
    *,
    season: str,
    position: str,
    source: str,
) -> dict[str, object]:
    exists = field in frame
    series = frame[field] if exists else pd.Series(np.nan, index=frame.index)
    numeric = pd.to_numeric(series, errors="coerce")
    return {
        "source": source,
        "season": season,
        "position": position,
        "field": field,
        "field_existed": exists,
        "rows": int(len(frame)),
        "missing": int(series.isna().sum()),
        "missing_rate": float(series.isna().mean()) if len(series) else None,
        "zero": int(numeric.eq(0).sum()) if exists else 0,
    }


def coverage_record(eligible: pd.Series, covered: pd.Series, **labels: object) -> dict[str, object]:
    eligible_values = eligible.fillna(False).astype(bool)
    covered_values = covered.fillna(False).astype(bool) & eligible_values
    denominator = int(eligible_values.sum())
    numerator = int(covered_values.sum())
    return {
        **labels,
        "eligible": denominator,
        "covered": numerator,
        "uncovered": denominator - numerator,
        "coverage_rate": None if denominator == 0 else numerator / denominator,
    }


def reconcile_aggregates(
    computed: pd.Series,
    published: pd.Series,
    *,
    tolerance: float = 0.0,
) -> dict[str, object]:
    aligned = pd.concat([computed.rename("computed"), published.rename("published")], axis=1)
    difference = (aligned["computed"] - aligned["published"]).abs()
    mismatch = difference > tolerance
    return {
        "compared": int(len(aligned)),
        "matching": int((~mismatch).sum()),
        "disagreements": int(mismatch.sum()),
        "maximum_absolute_difference": 0.0 if aligned.empty else float(difference.max()),
    }


def historical_team_consistency(joined_observations: pd.DataFrame, teams: pd.DataFrame) -> dict[str, int]:
    """Validate fixture-date team/opponent/GW facts without using a current player club."""
    required = {"team", "opponent_team", "was_home", "GW", "team_h", "team_a", "event"}
    if not required.issubset(joined_observations):
        raise DataQualityError(f"historical team audit missing fields: {sorted(required - set(joined_observations))}")
    if not {"id", "name"}.issubset(teams):
        raise DataQualityError("historical team audit requires team id and name")
    team_name_to_id = {str(row.name): int(row.id) for row in teams.itertuples(index=False)}
    observed_team = joined_observations["team"].astype(str).map(team_name_to_id)
    was_home = joined_observations["was_home"].astype(bool)
    expected_team = np.where(was_home, joined_observations["team_h"], joined_observations["team_a"])
    expected_opponent = np.where(was_home, joined_observations["team_a"], joined_observations["team_h"])
    return {
        "historical_team_membership_disagreements": int((observed_team.to_numpy() != expected_team).sum()),
        "opponent_fixture_disagreements": int(
            (pd.to_numeric(joined_observations["opponent_team"]).to_numpy() != expected_opponent).sum()
        ),
        "gameweek_fixture_event_disagreements": int(
            (
                pd.to_numeric(joined_observations["GW"]).to_numpy()
                != pd.to_numeric(joined_observations["event"]).to_numpy()
            ).sum()
        ),
    }


def write_quality_results(path: Path, document: dict[str, object]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(document, indent=2, sort_keys=True, allow_nan=False) + "\n", encoding="utf-8")


def require_benchmarkable_quality_gate(
    path: Path,
    required_sources: Iterable[str],
    *,
    manifest_path: Path | None = None,
) -> dict[str, object]:
    if not path.exists():
        raise DataQualityError(f"quality gate results do not exist: {path}")
    document = json.loads(path.read_text(encoding="utf-8"))
    if manifest_path is not None:
        from research.fpl_research.provenance import sha256_file

        if document.get("manifest_sha256") != sha256_file(manifest_path):
            raise DataQualityError("quality gate is stale relative to the source manifest")
    statuses = {
        (record["source"], record["season"]): record["status"]
        for record in document.get("source_season_status", [])
    }
    seasons = document.get("benchmark_seasons", [])
    failures = [
        f"{source} {season}: {statuses.get((source, season), 'MISSING')}"
        for source in required_sources
        for season in seasons
        if statuses.get((source, season)) not in BENCHMARKABLE_STATUSES
    ]
    if failures:
        raise DataQualityError("quality gate blocks benchmark inputs: " + "; ".join(failures))
    if document.get("blocking_failures"):
        raise DataQualityError("quality gate contains unresolved blocking failures")
    return document


def configuration_quality_failures(
    document: dict[str, object],
    sources: Iterable[str],
    seasons: Iterable[str],
) -> list[str]:
    statuses = {
        (record["source"], record["season"]): record["status"]
        for record in document.get("source_season_status", [])  # type: ignore[union-attr]
    }
    return [
        f"{source} {season}: {statuses.get((source, season), 'MISSING')}"
        for source in sources
        for season in seasons
        if statuses.get((source, season)) not in BENCHMARKABLE_STATUSES
    ]


def safe_float(value: object) -> float | None:
    number = float(value)
    return number if math.isfinite(number) else None
