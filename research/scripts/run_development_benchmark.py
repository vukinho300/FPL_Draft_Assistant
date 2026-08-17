from __future__ import annotations

import hashlib
import json
import platform
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd
import sklearn

from research.fpl_research import RANDOM_SEED
from research.fpl_research.features import columns_for_groups
from research.fpl_research.metrics import evaluate_predictions, six_manager_metrics
from research.fpl_research.model_safety import (
    ModelInputManifest,
    audit_train_test_split,
    make_model_input_manifest,
    validate_temporal_contract,
    write_model_input_manifests,
)
from research.fpl_research.models import MODEL_CONFIGS, fit_predict
from research.fpl_research.quality import configuration_quality_failures, require_benchmarkable_quality_gate


DEVELOPMENT_FOLDS = (
    (("2020-21", "2021-22", "2022-23"), "2023-24"),
    (("2020-21", "2021-22", "2022-23", "2023-24"), "2024-25"),
)
DRAFT_FOLDS = (
    (("2021-22", "2022-23"), "2023-24"),
    (("2021-22", "2022-23", "2023-24"), "2024-25"),
)
FPL_CORE = ("FPL_BASE", "FPL_EXPECTED", "FPL_ICT", "FORM")
HOLDOUT_CAPABLE_FULL = (*FPL_CORE, "TEAM_CONTEXT", "BOOKMAKER")
SOURCE_CONFIGS = {
    "FPL_ONLY": FPL_CORE,
    "FPL_UNDERSTAT": (*FPL_CORE, "UNDERSTAT_PLAYER"),
    "FPL_BOOKMAKER": HOLDOUT_CAPABLE_FULL,
    "FPL_UNDERSTAT_BOOKMAKER": (*HOLDOUT_CAPABLE_FULL, "UNDERSTAT_PLAYER"),
}
FEATURE_FAMILIES = {
    "FPL_BASE": ("FPL_BASE",),
    "FPL_BASE_EXPECTED": ("FPL_BASE", "FPL_EXPECTED"),
    "FPL_BASE_EXPECTED_ICT": ("FPL_BASE", "FPL_EXPECTED", "FPL_ICT"),
    "FPL_WITH_FORM": FPL_CORE,
    "FPL_WITH_TEAM_CONTEXT": (*FPL_CORE, "TEAM_CONTEXT"),
    "FPL_WITH_BOOKMAKER": HOLDOUT_CAPABLE_FULL,
    "FPL_WITH_UNDERSTAT": (*FPL_CORE, "UNDERSTAT_PLAYER"),
}


def metadata() -> dict[str, object]:
    return {
        "run_at": datetime.now(timezone.utc).isoformat(),
        "python_version": platform.python_version(),
        "pandas_version": pd.__version__,
        "numpy_version": np.__version__,
        "sklearn_version": sklearn.__version__,
        "random_seed": RANDOM_SEED,
    }


def load_dataset(processed: Path, task: str, horizon: int) -> pd.DataFrame:
    if task == "draft_day":
        paths = sorted(processed.glob("draft_day_*.pkl"))
    else:
        paths = sorted(processed.glob(f"inseason_h{horizon}_*.pkl"))
    paths = [path for path in paths if "2025-26" not in path.name]
    if not paths:
        raise FileNotFoundError(f"no processed data for {task} horizon {horizon}")
    return pd.concat([pd.read_pickle(path) for path in paths], ignore_index=True)


def folds_for(task: str):
    return DRAFT_FOLDS if task == "draft_day" else DEVELOPMENT_FOLDS


def result_row(
    predictions: pd.DataFrame,
    task: str,
    horizon: int,
    train_seasons: tuple[str, ...],
    test_season: str,
    configuration: str,
    model: str,
    groups: tuple[str, ...],
    status: str = "ok",
    training_sample_count: int | None = None,
) -> dict[str, object]:
    ranking_groups = ["season"] if task == "draft_day" else ["season", "cutoff_gw"]
    metrics = evaluate_predictions(predictions, ranking_groups)
    return {
        "task": task,
        "prediction_horizon": horizon,
        "training_seasons": ";".join(train_seasons),
        "test_season": test_season,
        "configuration": configuration,
        "feature_groups": ";".join(groups),
        "model": model,
        "position_handling": "pooled",
        "status": status,
        "training_sample_count": training_sample_count,
        "sample_count": len(predictions),
        **metrics,
    }


def baseline_predictions(test: pd.DataFrame, task: str, horizon: int) -> dict[str, pd.Series]:
    if task == "draft_day":
        previous = test["season_points_prior"].fillna(0.0)
        pp90 = test["points_per90_shrunk"].fillna(0.0) * test["season_minutes_prior"].fillna(0.0).clip(upper=3420) / 90.0
        ranked = previous.groupby(test["position"]).rank(method="average", pct=True)
        return {"previous_season_total": previous, "previous_season_pp90_minutes": pp90, "previous_position_rank": ranked}
    recent = test["last3_points"].fillna(0.0) / 3.0 * horizon
    expected_minutes = test["last5_minutes"].fillna(0.0) / 5.0
    adjusted = test["points_per90_shrunk"].fillna(0.0) * expected_minutes / 90.0 * horizon
    return {"recent_points_average": recent, "minutes_adjusted_points_rate": adjusted}


def predict_position_specific(
    train: pd.DataFrame,
    test: pd.DataFrame,
    model_name: str,
    numeric_columns: list[str],
    categorical_columns: list[str],
    task: str,
    horizon: int,
    manifests: list[ModelInputManifest] | None = None,
) -> pd.DataFrame:
    manifest = make_model_input_manifest(
        task=task,
        horizon=horizon,
        model=model_name,
        numeric_features=numeric_columns,
        categorical_features=categorical_columns,
    )
    if manifests is not None:
        manifests.append(manifest)
    outputs = []
    for position in ("GK", "DEF", "MID", "FWD"):
        train_position = train.loc[train["position"] == position]
        test_position = test.loc[test["position"] == position]
        if test_position.empty:
            continue
        prediction, _ = fit_predict(
            train_position,
            test_position,
            model_name,
            numeric_columns,
            categorical_columns,
            manifest=manifest,
        )
        outputs.append(prediction)
    return pd.concat(outputs).sort_index()


def main() -> None:
    quality = require_benchmarkable_quality_gate(
        Path("research/reports/data_quality_results.json"),
        ("Vaastav FPL", "Football-Data.co.uk"),
        manifest_path=Path("research/data/source_manifest.json"),
    )
    processed = Path("research/data/processed")
    reports = Path("research/reports")
    reports.mkdir(parents=True, exist_ok=True)
    run_metadata = metadata()
    run_id = hashlib.sha256(json.dumps(run_metadata, sort_keys=True).encode()).hexdigest()[:12]
    source_rows: list[dict[str, object]] = []
    model_rows: list[dict[str, object]] = []
    family_rows: list[dict[str, object]] = []
    ablation_rows: list[dict[str, object]] = []
    position_rows: list[dict[str, object]] = []
    six_rows: list[dict[str, object]] = []
    manifests: list[ModelInputManifest] = []
    split_audits: list[dict[str, object]] = []

    for task, horizon in (("draft_day", 38), ("inseason", 1), ("inseason", 3), ("inseason", 5)):
        print(f"benchmarking {task} horizon={horizon}", flush=True)
        data = load_dataset(processed, task, horizon)
        validate_temporal_contract(data)
        draft = task == "draft_day"
        categorical = ["position", "cold_start_category"] if draft else ["position"]
        for train_seasons, test_season in folds_for(task):
            train = data.loc[data["season"].isin(train_seasons)]
            test = data.loc[data["season"] == test_season]
            split_audits.append(
                {
                    "training_seasons": list(train_seasons),
                    "test_season": test_season,
                    "horizon": horizon,
                    **audit_train_test_split(train, test, task),
                }
            )
            for name, prediction in baseline_predictions(test, task, horizon).items():
                predicted = test.copy()
                predicted["prediction"] = prediction
                baseline = result_row(predicted, task, horizon, train_seasons, test_season, name, "baseline", (), "baseline")
                baseline["training_sample_count"] = len(train)
                model_rows.append(baseline)

            for configuration, groups in SOURCE_CONFIGS.items():
                sources = ["Vaastav FPL"]
                if "TEAM_CONTEXT" in groups or "BOOKMAKER" in groups:
                    sources.append("Football-Data.co.uk")
                if "UNDERSTAT_PLAYER" in groups:
                    sources.append("Understat via Vaastav")
                failures = configuration_quality_failures(quality, sources, (*train_seasons, test_season))
                if failures:
                    source_rows.append(
                        {
                            "task": task,
                            "prediction_horizon": horizon,
                            "training_seasons": ";".join(train_seasons),
                            "test_season": test_season,
                            "configuration": configuration,
                            "feature_groups": ";".join(groups),
                            "model": "hist_gradient_boosting",
                            "position_handling": "pooled",
                            "status": "blocked_by_data_quality",
                            "quality_failure": "; ".join(failures),
                            "training_sample_count": len(train),
                            "sample_count": 0,
                        }
                    )
                    continue
                numeric = columns_for_groups(groups, draft)
                manifest = make_model_input_manifest(
                    task=task,
                    horizon=horizon,
                    model="hist_gradient_boosting",
                    numeric_features=numeric,
                    categorical_features=categorical,
                )
                manifests.append(manifest)
                predicted, _ = fit_predict(
                    train, test, "hist_gradient_boosting", numeric, categorical, manifest=manifest
                )
                row = result_row(
                    predicted, task, horizon, train_seasons, test_season, configuration, "hist_gradient_boosting", groups
                )
                row["training_sample_count"] = len(train)
                source_rows.append(row)

            numeric = columns_for_groups(HOLDOUT_CAPABLE_FULL, draft)
            for model_name in MODEL_CONFIGS:
                manifest = make_model_input_manifest(
                    task=task,
                    horizon=horizon,
                    model=model_name,
                    numeric_features=numeric,
                    categorical_features=categorical,
                )
                manifests.append(manifest)
                predicted, _ = fit_predict(train, test, model_name, numeric, categorical, manifest=manifest)
                row = result_row(
                    predicted,
                    task,
                    horizon,
                    train_seasons,
                    test_season,
                    "FPL_BOOKMAKER",
                    model_name,
                    HOLDOUT_CAPABLE_FULL,
                )
                row["training_sample_count"] = len(train)
                model_rows.append(row)

            for configuration, groups in FEATURE_FAMILIES.items():
                sources = ["Vaastav FPL"]
                if "TEAM_CONTEXT" in groups or "BOOKMAKER" in groups:
                    sources.append("Football-Data.co.uk")
                if "UNDERSTAT_PLAYER" in groups:
                    sources.append("Understat via Vaastav")
                failures = configuration_quality_failures(quality, sources, (*train_seasons, test_season))
                if failures:
                    family_rows.append(
                        {
                            "task": task,
                            "prediction_horizon": horizon,
                            "training_seasons": ";".join(train_seasons),
                            "test_season": test_season,
                            "configuration": configuration,
                            "feature_groups": ";".join(groups),
                            "model": "hist_gradient_boosting",
                            "position_handling": "pooled",
                            "status": "blocked_by_data_quality",
                            "quality_failure": "; ".join(failures),
                            "training_sample_count": len(train),
                            "sample_count": 0,
                        }
                    )
                    continue
                numeric = columns_for_groups(groups, draft)
                manifest = make_model_input_manifest(
                    task=task,
                    horizon=horizon,
                    model="hist_gradient_boosting",
                    numeric_features=numeric,
                    categorical_features=categorical,
                )
                manifests.append(manifest)
                predicted, _ = fit_predict(
                    train, test, "hist_gradient_boosting", numeric, categorical, manifest=manifest
                )
                row = result_row(
                    predicted, task, horizon, train_seasons, test_season, configuration, "hist_gradient_boosting", groups
                )
                row["training_sample_count"] = len(train)
                family_rows.append(row)

            for removed in ("FPL_EXPECTED", "FPL_ICT", "FORM", "TEAM_CONTEXT", "BOOKMAKER"):
                groups = tuple(group for group in HOLDOUT_CAPABLE_FULL if group != removed)
                numeric = columns_for_groups(groups, draft)
                manifest = make_model_input_manifest(
                    task=task,
                    horizon=horizon,
                    model="hist_gradient_boosting",
                    numeric_features=numeric,
                    categorical_features=categorical,
                )
                manifests.append(manifest)
                predicted, _ = fit_predict(
                    train, test, "hist_gradient_boosting", numeric, categorical, manifest=manifest
                )
                row = result_row(
                    predicted,
                    task,
                    horizon,
                    train_seasons,
                    test_season,
                    f"FULL_MINUS_{removed}",
                    "hist_gradient_boosting",
                    groups,
                )
                row["training_sample_count"] = len(train)
                ablation_rows.append(row)

    source_frame = pd.DataFrame(source_rows)
    model_frame = pd.DataFrame(model_rows)
    family_frame = pd.DataFrame(family_rows)
    ablation_frame = pd.DataFrame(ablation_rows)

    for task, horizon in (("draft_day", 38), ("inseason", 1), ("inseason", 3), ("inseason", 5)):
        candidates = model_frame.loc[
            (model_frame["task"] == task) & (model_frame["prediction_horizon"] == horizon) & (model_frame["status"] == "ok")
        ]
        model_name = candidates.groupby("model")["ndcg_at_25"].mean().idxmax()
        data = load_dataset(processed, task, horizon)
        draft = task == "draft_day"
        numeric = columns_for_groups(HOLDOUT_CAPABLE_FULL, draft)
        categorical = ["position", "cold_start_category"] if draft else ["position"]
        for train_seasons, test_season in folds_for(task):
            train = data.loc[data["season"].isin(train_seasons)]
            test = data.loc[data["season"] == test_season]
            for handling in ("pooled", "position_specific"):
                if handling == "pooled":
                    manifest = make_model_input_manifest(
                        task=task,
                        horizon=horizon,
                        model=model_name,
                        numeric_features=numeric,
                        categorical_features=categorical,
                    )
                    manifests.append(manifest)
                    predicted, _ = fit_predict(train, test, model_name, numeric, categorical, manifest=manifest)
                else:
                    predicted = predict_position_specific(
                        train, test, model_name, numeric, categorical, task, horizon, manifests
                    )
                base = result_row(
                    predicted, task, horizon, train_seasons, test_season, "FPL_BOOKMAKER", model_name, HOLDOUT_CAPABLE_FULL
                )
                base["training_sample_count"] = len(train)
                base["position_handling"] = handling
                position_rows.append(base)
                for position, subset in predicted.groupby("position"):
                    position_metrics = evaluate_predictions(subset, ["season"] if draft else ["season", "cutoff_gw"])
                    position_rows.append(
                        {
                            **base,
                            "position": position,
                            "sample_count": len(subset),
                            **position_metrics,
                        }
                    )
                if draft:
                    six = six_manager_metrics(predicted)
                    for row in six.to_dict("records"):
                        six_rows.append(
                            {
                                "task": task,
                                "prediction_horizon": horizon,
                                "training_seasons": ";".join(train_seasons),
                                "test_season": test_season,
                                "configuration": "FPL_BOOKMAKER",
                                "model": model_name,
                                "position_handling": handling,
                                **row,
                            }
                        )

    for frame in (source_frame, model_frame, family_frame, ablation_frame):
        frame.insert(0, "run_id", run_id)
        for key, value in run_metadata.items():
            frame[key] = value
    pd.DataFrame(position_rows).assign(run_id=run_id, **run_metadata).to_csv(reports / "position_results.csv", index=False)
    pd.DataFrame(six_rows).assign(run_id=run_id, **run_metadata).to_csv(reports / "six_manager_results.csv", index=False)
    source_frame.to_csv(reports / "source_combination_results.csv", index=False)
    model_frame.to_csv(reports / "model_results.csv", index=False)
    family_frame.to_csv(reports / "feature_family_results.csv", index=False)
    ablation_frame.to_csv(reports / "feature_ablation_results.csv", index=False)
    (reports / "development_run_metadata.json").write_text(
        json.dumps({"run_id": run_id, **run_metadata}, indent=2, sort_keys=True) + "\n", encoding="utf-8"
    )
    write_model_input_manifests(reports / "development_feature_manifests.json", manifests)
    unique_split_audits = {
        (item["task"], item["horizon"], tuple(item["training_seasons"]), item["test_season"]): item
        for item in split_audits
    }
    (reports / "split_audit_results.json").write_text(
        json.dumps(list(unique_split_audits.values()), indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    print(f"development benchmark complete: run_id={run_id}")


if __name__ == "__main__":
    main()
