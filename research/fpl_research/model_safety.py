from __future__ import annotations

import hashlib
import json
import re
from collections.abc import Iterable, Sequence
from dataclasses import asdict, dataclass
from pathlib import Path

import pandas as pd
import numpy as np

from research.fpl_research.quality import DataQualityError


TEMPORAL_COLUMNS = (
    "prediction_cutoff",
    "feature_max_timestamp",
    "target_start_timestamp",
    "target_end_timestamp",
)

IDENTIFIER_COLUMNS = {
    "code",
    "element",
    "fixture",
    "id",
    "qid",
    "name",
    "understat_id",
    "sample_key",
    "team",
    "prior_team",
}

TARGET_COLUMNS = {
    "target",
    "prediction",
    "upcoming_season_total_points",
    "next_1_gameweek_points",
    "next_3_gameweek_points",
    "next_5_gameweek_points",
}

METADATA_COLUMNS = {
    "season",
    "task",
    "horizon",
    "cutoff_gw",
    "cutoff_time",
    *TEMPORAL_COLUMNS,
}

FORBIDDEN_NAME_PATTERNS = (
    re.compile(r"(^|_)future(_|$)", re.IGNORECASE),
    re.compile(r"(^|_)target(_|$)", re.IGNORECASE),
    re.compile(r"(^|_)final_season(_|$)", re.IGNORECASE),
    re.compile(r"(^|_)season_total_points$", re.IGNORECASE),
    re.compile(r"(^|_)(player|fixture|understat|row|sample|source)_?(id|code)$", re.IGNORECASE),
)


@dataclass(frozen=True)
class ModelInputManifest:
    task: str
    horizon: int
    model: str
    numeric_features: tuple[str, ...]
    categorical_features: tuple[str, ...]
    metadata_columns: tuple[str, ...] = tuple(sorted(METADATA_COLUMNS | IDENTIFIER_COLUMNS))
    forbidden_columns: tuple[str, ...] = tuple(sorted(TARGET_COLUMNS | IDENTIFIER_COLUMNS))

    def to_dict(self) -> dict[str, object]:
        record = asdict(self)
        digest = hashlib.sha256(json.dumps(record, sort_keys=True).encode()).hexdigest()
        return {"experiment_feature_set_id": digest[:16], **record}


def make_model_input_manifest(
    *,
    task: str,
    horizon: int,
    model: str,
    numeric_features: Sequence[str],
    categorical_features: Sequence[str],
) -> ModelInputManifest:
    manifest = ModelInputManifest(
        task=task,
        horizon=horizon,
        model=model,
        numeric_features=tuple(numeric_features),
        categorical_features=tuple(categorical_features),
    )
    validate_model_input_manifest(manifest, numeric_features, categorical_features)
    return manifest


def forbidden_predictor_reason(column: str) -> str | None:
    if column in TARGET_COLUMNS:
        return "target or post-outcome value"
    if column in IDENTIFIER_COLUMNS:
        return "identifier or entity label"
    if column in METADATA_COLUMNS:
        return "evaluation metadata"
    if any(pattern.search(column) for pattern in FORBIDDEN_NAME_PATTERNS):
        return "forbidden future/target/final-season/identifier naming pattern"
    return None


def assert_allowed_predictors(columns: Iterable[str]) -> None:
    failures = {
        column: reason
        for column in columns
        if (reason := forbidden_predictor_reason(str(column))) is not None
    }
    if failures:
        raise DataQualityError(f"forbidden model predictors: {failures}")


def validate_model_input_manifest(
    manifest: ModelInputManifest,
    numeric_features: Sequence[str],
    categorical_features: Sequence[str],
) -> None:
    actual_numeric = tuple(numeric_features)
    actual_categorical = tuple(categorical_features)
    if actual_numeric != manifest.numeric_features or actual_categorical != manifest.categorical_features:
        raise DataQualityError("actual estimator inputs do not exactly match the declared feature manifest")
    combined = actual_numeric + actual_categorical
    if len(combined) != len(set(combined)):
        raise DataQualityError("feature manifest contains duplicate predictor columns")
    assert_allowed_predictors(combined)


def write_model_input_manifests(path: Path, manifests: Iterable[ModelInputManifest]) -> dict[str, object]:
    unique = {
        (manifest.task, manifest.horizon, manifest.model, manifest.numeric_features, manifest.categorical_features): manifest
        for manifest in manifests
    }
    records = [item.to_dict() for item in sorted(unique.values(), key=lambda item: (item.task, item.horizon, item.model))]
    encoded_records = json.dumps(records, sort_keys=True).encode()
    document: dict[str, object] = {
        "schema_version": 1,
        "manifest_count": len(records),
        "manifests_sha256": hashlib.sha256(encoded_records).hexdigest(),
        "manifests": records,
    }
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(document, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    return document


def _timestamps(frame: pd.DataFrame, column: str) -> pd.Series:
    if column not in frame:
        raise DataQualityError(f"temporal contract missing {column}")
    values = pd.to_datetime(frame[column], errors="coerce", utc=True)
    if values.isna().any():
        raise DataQualityError(f"temporal contract has {int(values.isna().sum())} missing or malformed {column} values")
    return values


def validate_temporal_contract(frame: pd.DataFrame) -> dict[str, object]:
    prediction_cutoff = _timestamps(frame, "prediction_cutoff")
    feature_max = _timestamps(frame, "feature_max_timestamp")
    target_start = _timestamps(frame, "target_start_timestamp")
    target_end = _timestamps(frame, "target_end_timestamp")
    feature_violations = feature_max.gt(prediction_cutoff)
    target_start_violations = target_start.le(prediction_cutoff)
    target_order_violations = target_end.lt(target_start)
    if feature_violations.any():
        raise DataQualityError(f"{int(feature_violations.sum())} features occur after their prediction cutoff")
    if target_start_violations.any():
        raise DataQualityError(f"{int(target_start_violations.sum())} targets begin at or before their prediction cutoff")
    if target_order_violations.any():
        raise DataQualityError(f"{int(target_order_violations.sum())} targets end before they begin")
    return {
        "rows": int(len(frame)),
        "feature_after_cutoff": 0,
        "target_at_or_before_cutoff": 0,
        "target_end_before_start": 0,
        "status": "PASS",
    }


def validate_feature_timestamps(feature_timestamps: Iterable[object], prediction_cutoff: object) -> None:
    timestamps = pd.to_datetime(pd.Series(list(feature_timestamps)), errors="coerce", utc=True)
    cutoff = pd.to_datetime(prediction_cutoff, errors="coerce", utc=True)
    if timestamps.isna().any() or pd.isna(cutoff):
        raise DataQualityError("feature timestamp canary contains malformed timestamps")
    if timestamps.gt(cutoff).any():
        raise DataQualityError("future feature timestamp exceeds prediction cutoff")


def sample_key_columns(task: str) -> tuple[str, ...]:
    if task == "draft_day":
        return ("season", "code")
    if task == "inseason":
        return ("season", "code", "cutoff_gw", "horizon")
    raise ValueError(f"unknown task: {task}")


def make_sample_keys(frame: pd.DataFrame, task: str) -> pd.Series:
    columns = sample_key_columns(task)
    missing = [column for column in columns if column not in frame]
    if missing:
        raise DataQualityError(f"sample key fields are missing: {missing}")
    if frame[list(columns)].isna().any().any():
        raise DataQualityError("sample key fields contain missing values")
    return frame[list(columns)].astype(str).agg("|".join, axis=1).rename("sample_key")


def validate_unique_samples(frame: pd.DataFrame, task: str) -> dict[str, object]:
    keys = make_sample_keys(frame, task)
    duplicates = keys.duplicated(keep=False)
    if duplicates.any():
        raise DataQualityError(f"duplicate modeling samples: {int(duplicates.sum())} rows")
    return {"rows": int(len(frame)), "unique_sample_keys": int(keys.nunique()), "status": "PASS"}


def audit_train_test_split(train: pd.DataFrame, test: pd.DataFrame, task: str) -> dict[str, object]:
    train_audit = validate_unique_samples(train, task)
    test_audit = validate_unique_samples(test, task)
    train_keys = set(make_sample_keys(train, task))
    test_keys = set(make_sample_keys(test, task))
    overlap = train_keys & test_keys
    if overlap:
        raise DataQualityError(f"train/test sample overlap: {len(overlap)} keys")
    train_cutoff = _timestamps(train, "prediction_cutoff")
    test_cutoff = _timestamps(test, "prediction_cutoff")
    chronological = bool(train_cutoff.max() < test_cutoff.min())
    if not chronological:
        raise DataQualityError("train/test split is not strictly chronological")
    return {
        "task": task,
        "training_rows": train_audit["rows"],
        "test_rows": test_audit["rows"],
        "training_unique_sample_keys": train_audit["unique_sample_keys"],
        "test_unique_sample_keys": test_audit["unique_sample_keys"],
        "overlap_count": 0,
        "chronological": True,
        "status": "PASS",
    }


def deterministic_shuffled_target(
    frame: pd.DataFrame,
    seed: int,
    group_columns: Sequence[str] = (),
) -> pd.DataFrame:
    if "target" not in frame:
        raise DataQualityError("shuffle control requires a target column")
    result = frame.copy()
    generator = np.random.default_rng(seed)
    if group_columns:
        missing = [column for column in group_columns if column not in result]
        if missing:
            raise DataQualityError(f"shuffle-control group fields are missing: {missing}")
        for _, indexes in result.groupby(list(group_columns), sort=True, dropna=False).groups.items():
            result.loc[indexes, "target"] = generator.permutation(result.loc[indexes, "target"].to_numpy())
    else:
        result["target"] = generator.permutation(result["target"].to_numpy())
    return result
