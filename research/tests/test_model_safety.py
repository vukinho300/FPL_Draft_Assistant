from __future__ import annotations

import pandas as pd
import pytest

from research.fpl_research.model_safety import (
    ModelInputManifest,
    assert_allowed_predictors,
    audit_train_test_split,
    deterministic_shuffled_target,
    make_model_input_manifest,
    make_sample_keys,
    validate_feature_timestamps,
    validate_model_input_manifest,
    validate_temporal_contract,
    validate_unique_samples,
)
from research.fpl_research.models import fit_predict
from research.fpl_research.quality import DataQualityError


def temporal_rows(season: str, code: int, cutoff: str, cutoff_gw: int = 5) -> pd.DataFrame:
    return pd.DataFrame(
        {
            "season": [season],
            "code": [code],
            "cutoff_gw": [cutoff_gw],
            "horizon": [1],
            "prediction_cutoff": [cutoff],
            "feature_max_timestamp": [cutoff],
            "target_start_timestamp": [pd.Timestamp(cutoff) + pd.Timedelta(days=1)],
            "target_end_timestamp": [pd.Timestamp(cutoff) + pd.Timedelta(days=2)],
        }
    )


def test_temporal_contract_accepts_asof_features_and_future_targets():
    assert validate_temporal_contract(temporal_rows("2023-24", 1, "2024-01-01T00:00:00Z"))["status"] == "PASS"
    validate_feature_timestamps(
        ["2023-12-31T00:00:00Z", "2024-01-01T00:00:00Z"], "2024-01-01T00:00:00Z"
    )


def test_temporal_contract_rejects_future_feature_and_nonfuture_target_canaries():
    future_feature = temporal_rows("2023-24", 1, "2024-01-01T00:00:00Z")
    future_feature["feature_max_timestamp"] = "2024-01-02T00:00:00Z"
    with pytest.raises(DataQualityError, match="features occur after"):
        validate_temporal_contract(future_feature)
    with pytest.raises(DataQualityError, match="future feature"):
        validate_feature_timestamps(["2024-01-02T00:00:00Z"], "2024-01-01T00:00:00Z")

    nonfuture_target = temporal_rows("2023-24", 1, "2024-01-01T00:00:00Z")
    nonfuture_target["target_start_timestamp"] = "2024-01-01T00:00:00Z"
    with pytest.raises(DataQualityError, match="targets begin"):
        validate_temporal_contract(nonfuture_target)


@pytest.mark.parametrize(
    "column",
    [
        "target",
        "future_points",
        "final_season_points",
        "code",
        "player_code",
        "element",
        "fixture",
        "understat_id",
        "sample_key",
        "qid",
    ],
)
def test_forbidden_targets_future_fields_and_identifiers_cannot_enter_estimator(column):
    with pytest.raises(DataQualityError, match="forbidden model predictors"):
        assert_allowed_predictors([column])


def test_model_manifest_must_match_actual_estimator_inputs_exactly():
    manifest = make_model_input_manifest(
        task="inseason",
        horizon=1,
        model="ridge",
        numeric_features=["last3_points"],
        categorical_features=["position"],
    )
    validate_model_input_manifest(manifest, ["last3_points"], ["position"])
    with pytest.raises(DataQualityError, match="exactly match"):
        validate_model_input_manifest(manifest, ["last5_points"], ["position"])
    with pytest.raises(DataQualityError, match="forbidden"):
        unsafe = ModelInputManifest("inseason", 1, "ridge", ("target",), ())
        validate_model_input_manifest(unsafe, ["target"], [])


def test_duplicate_samples_and_train_test_overlap_are_blocking():
    one = temporal_rows("2023-24", 1, "2024-01-01T00:00:00Z")
    duplicate = pd.concat([one, one], ignore_index=True)
    with pytest.raises(DataQualityError, match="duplicate modeling samples"):
        validate_unique_samples(duplicate, "inseason")
    assert make_sample_keys(one, "inseason").tolist() == ["2023-24|1|5|1"]

    with pytest.raises(DataQualityError, match="sample overlap"):
        audit_train_test_split(one, one.copy(), "inseason")


def test_chronological_split_has_zero_overlap_and_rejects_reversed_time():
    train = temporal_rows("2023-24", 1, "2024-01-01T00:00:00Z")
    test = temporal_rows("2024-25", 1, "2025-01-01T00:00:00Z")
    assert audit_train_test_split(train, test, "inseason")["overlap_count"] == 0
    with pytest.raises(DataQualityError, match="not strictly chronological"):
        audit_train_test_split(test, train, "inseason")


def test_preprocessing_statistics_are_fitted_on_training_rows_only():
    train = pd.DataFrame(
        {
            "task": ["inseason", "inseason"],
            "horizon": [1, 1],
            "safe_feature": [0.0, 2.0],
            "position": ["MID", "MID"],
            "target": [0.0, 1.0],
        }
    )
    test = pd.DataFrame(
        {"task": ["inseason"], "horizon": [1], "safe_feature": [1000.0], "position": ["NEW"], "target": [1.0]}
    )
    manifest = make_model_input_manifest(
        task="inseason",
        horizon=1,
        model="ridge",
        numeric_features=["safe_feature"],
        categorical_features=["position"],
    )
    _, model = fit_predict(train, test, "ridge", ["safe_feature"], ["position"], manifest=manifest)
    imputer = model.named_steps["preprocess"].named_transformers_["numeric"].named_steps["impute"]
    assert imputer.statistics_[0] == pytest.approx(1.0)


def test_estimator_rejects_manifest_with_wrong_task_or_horizon_context():
    frame = pd.DataFrame(
        {
            "task": ["inseason", "inseason"],
            "horizon": [1, 1],
            "safe_feature": [0.0, 1.0],
            "position": ["MID", "MID"],
            "target": [0.0, 1.0],
        }
    )
    wrong = make_model_input_manifest(
        task="inseason",
        horizon=3,
        model="ridge",
        numeric_features=["safe_feature"],
        categorical_features=["position"],
    )
    with pytest.raises(ValueError, match="horizon does not match"):
        fit_predict(frame, frame, "ridge", ["safe_feature"], ["position"], manifest=wrong)


def test_shuffled_target_control_is_deterministic_and_preserves_distribution():
    frame = pd.DataFrame({"target": list(range(20))})
    first = deterministic_shuffled_target(frame, 20250817)
    second = deterministic_shuffled_target(frame, 20250817)
    assert first.equals(second)
    assert sorted(first["target"]) == sorted(frame["target"])
    assert not first["target"].equals(frame["target"])
