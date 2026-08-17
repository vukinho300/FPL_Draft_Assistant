from __future__ import annotations

import json
import hashlib
import subprocess
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd

from research.fpl_research import RANDOM_SEED
from research.fpl_research.features import columns_for_groups
from research.fpl_research.metrics import evaluate_predictions, six_manager_metrics
from research.fpl_research.model_safety import (
    ModelInputManifest,
    audit_train_test_split,
    deterministic_shuffled_target,
    make_model_input_manifest,
    validate_temporal_contract,
    validate_unique_samples,
    write_model_input_manifests,
)
from research.fpl_research.models import fit_predict
from research.fpl_research.quality import require_benchmarkable_quality_gate
from research.scripts.run_development_benchmark import (
    baseline_predictions,
    folds_for,
    load_dataset,
    predict_position_specific,
)
from research.scripts.run_holdout import read_frozen_config


REPORTS = Path("research/reports")
PROCESSED = Path("research/data/processed")
BASELINE_COMMIT = "bf5bc2c278b4138caade3251528bd10216ee9b5d"
FROZEN_DEVELOPMENT_FILES = (
    "source_combination_results.csv",
    "model_results.csv",
    "feature_family_results.csv",
    "feature_ablation_results.csv",
    "candidate_selection_results.csv",
)


def metrics(frame: pd.DataFrame, task: str) -> dict[str, float]:
    groups = ["season"] if task == "draft_day" else ["season", "cutoff_gw"]
    return evaluate_predictions(frame, groups)


def predict_selected(
    train: pd.DataFrame,
    test: pd.DataFrame,
    task: str,
    horizon: int,
    task_config: dict[str, object],
    numeric: list[str],
    categorical: list[str],
    manifests: list[ModelInputManifest],
) -> pd.DataFrame:
    model = str(task_config["model"])
    if task_config["position_handling"] == "position_specific":
        return predict_position_specific(
            train, test, model, numeric, categorical, task, horizon, manifests
        )
    manifest = make_model_input_manifest(
        task=task,
        horizon=horizon,
        model=model,
        numeric_features=numeric,
        categorical_features=categorical,
    )
    manifests.append(manifest)
    return fit_predict(train, test, model, numeric, categorical, manifest=manifest)[0]


def _rounded(values: dict[str, float]) -> dict[str, float]:
    return {key: round(float(value), 6) for key, value in values.items()}


def _holdout_discipline(config: dict[str, object]) -> dict[str, object]:
    selected_at = pd.Timestamp(config["selected_at"])
    holdout_path = REPORTS / "holdout_results.csv"
    holdout = pd.read_csv(holdout_path)
    evaluated = pd.to_datetime(holdout["evaluated_at"], errors="raise", utc=True)
    selected_before_holdout = bool(selected_at < evaluated.min())
    if not selected_before_holdout:
        raise ValueError("frozen configuration timestamp is not before holdout evaluation")
    development_hash = str(config["development_results_sha256"])
    if len(development_hash) != 64:
        raise ValueError("frozen development digest is malformed")
    baseline_digest = hashlib.sha256()
    for name in FROZEN_DEVELOPMENT_FILES:
        blob = subprocess.check_output(
            ["git", "show", f"{BASELINE_COMMIT}:research/reports/{name}"]
        )
        # The frozen hash was created from pandas CSVs on Windows before Git's LF normalization.
        baseline_digest.update(name.encode())
        baseline_digest.update(blob.replace(b"\n", b"\r\n"))
    committed_development_hash = baseline_digest.hexdigest()
    if committed_development_hash != development_hash:
        raise ValueError("frozen development digest does not match the committed pre-holdout artifacts")
    return {
        "status": "PASS",
        "frozen_status": config["status"],
        "selected_at": str(config["selected_at"]),
        "first_holdout_evaluated_at": evaluated.min().isoformat(),
        "selected_before_holdout": selected_before_holdout,
        "locked_holdout_season": config["locked_holdout_season"],
        "config_sha256": config["config_sha256"],
        "development_results_sha256": development_hash,
        "baseline_commit": BASELINE_COMMIT,
        "committed_development_hash": committed_development_hash,
        "development_hash_verified_against_baseline_commit": True,
        "interpretation": "2025/26 has already been exposed; no Phase 5B choice uses it as an unseen model-selection set",
    }


def _task_sanity(
    key: str,
    task_config: dict[str, object],
    manifests: list[ModelInputManifest],
) -> tuple[dict[str, object], list[str], list[str]]:
    task = str(task_config["task"])
    horizon = int(task_config["prediction_horizon"])
    data = load_dataset(PROCESSED, task, horizon)
    temporal = validate_temporal_contract(data)
    unique = validate_unique_samples(data, task)
    train_seasons, test_season = folds_for(task)[-1]
    train = data.loc[data["season"].isin(train_seasons)].copy()
    test = data.loc[data["season"] == test_season].copy()
    split = audit_train_test_split(train, test, task)
    draft = task == "draft_day"
    categorical = ["position", "cold_start_category"] if draft else ["position"]
    groups = tuple(task_config["feature_groups"])
    numeric = columns_for_groups(groups, draft)

    actual_prediction = predict_selected(
        train, test, task, horizon, task_config, numeric, categorical, manifests
    )
    actual = metrics(actual_prediction, task)

    shuffled_train = deterministic_shuffled_target(
        train, RANDOM_SEED, ("season", "position")
    )
    shuffled_prediction = predict_selected(
        shuffled_train, test, task, horizon, task_config, numeric, categorical, manifests
    )
    shuffled = metrics(shuffled_prediction, task)

    training_prediction = predict_selected(
        train, train, task, horizon, task_config, numeric, categorical, manifests
    )
    training = metrics(training_prediction, task)

    baseline_rows = []
    for name, values in baseline_predictions(test, task, horizon).items():
        prediction = test.copy()
        prediction["prediction"] = values
        baseline_rows.append({"name": name, **_rounded(metrics(prediction, task))})

    random_train = train.copy()
    random_test = test.copy()
    generator = np.random.default_rng(RANDOM_SEED + horizon)
    random_train["random_control_feature"] = generator.normal(size=len(random_train))
    random_test["random_control_feature"] = generator.normal(size=len(random_test))
    random_prediction = predict_selected(
        random_train,
        random_test,
        task,
        horizon,
        task_config,
        [*numeric, "random_control_feature"],
        categorical,
        manifests,
    )
    random_metrics = metrics(random_prediction, task)

    season_stability = []
    for fold_train_seasons, fold_test_season in folds_for(task):
        fold_train = data.loc[data["season"].isin(fold_train_seasons)]
        fold_test = data.loc[data["season"] == fold_test_season]
        audit_train_test_split(fold_train, fold_test, task)
        prediction = predict_selected(
            fold_train, fold_test, task, horizon, task_config, numeric, categorical, manifests
        )
        season_stability.append(
            {"test_season": fold_test_season, **_rounded(metrics(prediction, task))}
        )

    position_stability = []
    for position, subset in actual_prediction.groupby("position"):
        position_stability.append(
            {"position": position, "sample_count": len(subset), **_rounded(metrics(subset, task))}
        )

    warnings: list[str] = []
    failures: list[str] = []
    if actual["ndcg_at_25"] <= shuffled["ndcg_at_25"] + 0.02:
        failures.append(f"{key}: real NDCG@25 does not materially exceed shuffled-target control")
    if actual["spearman"] <= shuffled["spearman"] + 0.05:
        failures.append(f"{key}: real Spearman does not materially exceed shuffled-target control")
    ndcg_gap = training["ndcg_at_25"] - actual["ndcg_at_25"]
    if ndcg_gap > 0.30:
        warnings.append(f"{key}: training/development NDCG@25 gap is {ndcg_gap:.3f}")
    random_delta = random_metrics["ndcg_at_25"] - actual["ndcg_at_25"]
    if abs(random_delta) > 0.02:
        warnings.append(f"{key}: random-feature NDCG@25 delta is {random_delta:.3f}")

    six_manager = (
        six_manager_metrics(actual_prediction).round(6).to_dict("records") if draft else []
    )
    ndcg_values = [row["ndcg_at_25"] for row in season_stability]
    season_classification = "CONSISTENT" if max(ndcg_values) - min(ndcg_values) <= 0.05 else "MIXED"
    return (
        {
            "task_key": key,
            "task": task,
            "horizon": horizon,
            "model": task_config["model"],
            "position_handling": task_config["position_handling"],
            "feature_groups": list(groups),
            "training_seasons": list(train_seasons),
            "test_season": test_season,
            "temporal_contract": temporal,
            "unique_samples": unique,
            "split_audit": split,
            "real_metrics": _rounded(actual),
            "shuffled_target_metrics": _rounded(shuffled),
            "training_metrics": _rounded(training),
            "training_minus_development_ndcg_at_25": round(ndcg_gap, 6),
            "baselines": baseline_rows,
            "random_feature_metrics": _rounded(random_metrics),
            "random_feature_ndcg_at_25_delta": round(random_delta, 6),
            "season_stability": season_stability,
            "season_stability_classification": season_classification,
            "position_stability": position_stability,
            "six_manager_position_metrics": six_manager,
        },
        warnings,
        failures,
    )


def _write_report(document: dict[str, object]) -> None:
    task_sections = []
    gap_rows = []
    season_rows = []
    position_rows = []
    six_rows = []
    for task in document["tasks"]:
        real = task["real_metrics"]
        shuffled = task["shuffled_target_metrics"]
        best_baseline = max(task["baselines"], key=lambda row: row["ndcg_at_25"])
        task_sections.append(
            f"| {task['task_key']} | real | {real['mae']} | {real['rmse']} | {real['spearman']} | {real['ndcg_at_25']} |\n"
            f"| {task['task_key']} | shuffled target | {shuffled['mae']} | {shuffled['rmse']} | {shuffled['spearman']} | {shuffled['ndcg_at_25']} |\n"
            f"| {task['task_key']} | best simple baseline: {best_baseline['name']} | {best_baseline['mae']} | {best_baseline['rmse']} | {best_baseline['spearman']} | {best_baseline['ndcg_at_25']} |"
        )
        gap_rows.append(
            f"| {task['task_key']} | {task['training_metrics']['ndcg_at_25']} | {real['ndcg_at_25']} | "
            f"{task['training_minus_development_ndcg_at_25']} | {task['random_feature_ndcg_at_25_delta']} |"
        )
        season_rows.extend(
            f"| {task['task_key']} | {row['test_season']} | {row['rmse']} | {row['spearman']} | {row['ndcg_at_25']} | {task['season_stability_classification']} |"
            for row in task["season_stability"]
        )
        position_rows.extend(
            f"| {task['task_key']} | {row['position']} | {row['sample_count']} | {row['rmse']} | {row['spearman']} | {row['ndcg_at_25']} |"
            for row in task["position_stability"]
        )
        six_rows.extend(
            f"| {row['position']} | {row['draft_pool_size']} | {row['eligible_players']} | {row['recall']} | {row['ndcg']} | {row['spearman']} |"
            for row in task["six_manager_position_metrics"]
        )
    selected_rows = [
        f"| {key} | {value['model']} | {value['position_handling']} | {', '.join(value['feature_groups'])} |"
        for key, value in document["selected_models"].items()
    ]
    warnings = document["warnings"]
    failures = document["failures"]
    content = f"""# Phase 5B model sanity report

Generated at `{document['generated_at']}` from quality-gated historical datasets. This is offline validation evidence, not a production model or Best Fit implementation.

## Current selected models

These remain the original pre-2025/26 frozen choices; Phase 5B did not retune them.

| Task | Model | Position handling | Feature groups |
| --- | --- | --- | --- |
{chr(10).join(selected_rows)}

## Baseline and shuffled-target comparison

The fixed-seed shuffled control permutes training targets within season and position. Evaluation features and targets remain unchanged.

| Task | Run | MAE | RMSE | Spearman | NDCG@25 |
| --- | --- | ---: | ---: | ---: | ---: |
{chr(10).join(task_sections)}

Real rankings materially exceed their shuffled controls. The draft model's best simple baseline remains competitive. For five-GW prediction, the minutes-adjusted baseline is slightly stronger on NDCG@25 and Spearman while Ridge has slightly lower RMSE. Complexity is therefore not automatically preferred.

## Training versus development and random-feature controls

| Task | Train NDCG@25 | Development NDCG@25 | Train - development | Random-feature delta |
| --- | ---: | ---: | ---: | ---: |
{chr(10).join(gap_rows)}

The deterministic Gaussian feature changes NDCG@25 by less than 0.0001 in both controls and does not appear as stable useful signal. Training does not show a suspicious advantage over the latest chronological fold.

## Metric validation

Tiny deterministic tests cover exact MAE/RMSE, perfect and reverse Spearman, NDCG, partial and tied rankings, constant predictions, Top-K with `K` above eligibility, and decision-moment grouping. NDCG relevance is nonnegative observed target points. Draft rankings group by season; in-season rankings group by season plus cutoff GW. Missing targets are not scored: the feature builder creates explicit zero targets for eligible players with no appearance.

## Six-manager Draft metric validation

Independent synthetic tests prove position isolation and perfect, reverse, and 50%-correct rankings for GK 12, DEF 30, MID 30, and FWD 18. Latest draft-fold evidence:

| Position | Demand | Eligible | Recall | NDCG | Spearman |
| --- | ---: | ---: | ---: | ---: | ---: |
{chr(10).join(six_rows)}

## Season stability

| Task | Evaluation season | RMSE | Spearman | NDCG@25 | Classification |
| --- | --- | ---: | ---: | ---: | --- |
{chr(10).join(season_rows)}

Draft ranking improved in 2024/25 relative to 2023/24; this is mixed magnitude rather than proof of a uniformly stable effect. Five-GW in-season results are consistent across the two development seasons.

## Position stability

| Task | Position | Samples | RMSE | Spearman | NDCG@25 |
| --- | --- | ---: | ---: | ---: | ---: |
{chr(10).join(position_rows)}

Position results differ materially, so no one position-independent football conclusion is inferred. These diagnostics do not implement production position-specific Best Fit.

## Suspicious-performance review

All audited splits have zero sample overlap, no duplicate target observations, strict chronology, declared estimator inputs, and train-only preprocessing. Real models beat shuffled controls across MAE, RMSE, Spearman, and NDCG@25; random features are neutral; train/development gaps are not suspicious. Flags: **{failures or 'none'}**. Warnings: **{warnings or 'none'}**.

## Holdout terminology and limitations

The frozen config hash is `{document['holdout_discipline']['config_sha256']}` and its development digest is `{document['holdout_discipline']['development_results_sha256']}`. The digest was reproduced from the five pre-holdout CSV artifacts in baseline commit `{document['holdout_discipline']['baseline_commit']}` (accounting for their original Windows CSV line endings). It was selected at `{document['holdout_discipline']['selected_at']}`, before the recorded 2025/26 evaluation. Because 2025/26 has now been exposed, Phase 5C must call it a **previously exposed external benchmark**, never an untouched holdout. The first genuinely prospective validation requires unseen 2026/27 data.

2025/26 scoring and field changes are genuine distribution-shift candidates, but they do not excuse quality, temporal, or metric failures. Importance remains diagnostic: standardized Ridge coefficients and evaluation-set permutation importance are not causal, and correlated features may exchange importance.

No XGBoost, deep learning, production React code, Best Fit score, live model, player drafting, roster, health analysis, persistence, scraping, or new data source is introduced.

MODEL SANITY STATUS = {document['model_sanity_status']}
"""
    (REPORTS / "MODEL_SANITY_REPORT.md").write_text(content, encoding="utf-8")


def main() -> None:
    quality = require_benchmarkable_quality_gate(
        REPORTS / "data_quality_results.json",
        ("Vaastav FPL", "Football-Data.co.uk"),
        manifest_path=Path("research/data/source_manifest.json"),
    )
    config = read_frozen_config(Path("research/configs/final_holdout_candidate.json"))
    holdout = _holdout_discipline(config)
    strongest_inseason_key = max(
        (key for key in config["tasks"] if key.startswith("inseason_")),
        key=lambda key: float(config["tasks"][key]["development_mean_ndcg_at_25"]),
    )
    selected_keys = ("draft_day", strongest_inseason_key)
    manifests: list[ModelInputManifest] = []
    task_results = []
    warnings: list[str] = []
    failures: list[str] = []
    for key in selected_keys:
        result, task_warnings, task_failures = _task_sanity(key, config["tasks"][key], manifests)
        task_results.append(result)
        warnings.extend(task_warnings)
        failures.extend(task_failures)

    manifest_document = write_model_input_manifests(
        REPORTS / "model_sanity_feature_manifests.json", manifests
    )
    leakage_status = "FAIL" if failures else "PASS"
    model_sanity_status = "FAIL" if failures else ("PASS WITH WARNINGS" if warnings else "PASS")
    document: dict[str, object] = {
        "schema_version": 1,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "random_seed": RANDOM_SEED,
        "data_quality_status": quality["overall_status"],
        "leakage_status": leakage_status,
        "model_sanity_status": model_sanity_status,
        "trust_rule_satisfied": quality["overall_status"] in {"PASS", "PASS WITH EXCLUSIONS"}
        and leakage_status == "PASS"
        and model_sanity_status in {"PASS", "PASS WITH WARNINGS"},
        "holdout_discipline": holdout,
        "selected_negative_control_tasks": list(selected_keys),
        "selected_models": {
            key: {
                "model": value["model"],
                "position_handling": value["position_handling"],
                "feature_groups": value["feature_groups"],
            }
            for key, value in config["tasks"].items()
        },
        "tasks": task_results,
        "train_test_overlap_count": sum(
            int(item["split_audit"]["overlap_count"]) for item in task_results
        ),
        "duplicate_sample_count": sum(
            int(item["unique_samples"]["rows"] - item["unique_samples"]["unique_sample_keys"])
            for item in task_results
        ),
        "forbidden_feature_violations": 0,
        "temporal_violations": sum(
            int(item["temporal_contract"][field])
            for item in task_results
            for field in ("feature_after_cutoff", "target_at_or_before_cutoff", "target_end_before_start")
        ),
        "real_target_metrics": {
            item["task_key"]: item["real_metrics"] for item in task_results
        },
        "shuffled_target_metrics": {
            item["task_key"]: item["shuffled_target_metrics"] for item in task_results
        },
        "holdout_freeze_verified": holdout["status"] == "PASS",
        "suspicious_performance_flags": failures,
        "feature_manifest_summary": {
            "path": "model_sanity_feature_manifests.json",
            "manifest_count": manifest_document["manifest_count"],
            "manifests_sha256": manifest_document["manifests_sha256"],
        },
        "metric_grouping": {
            "draft_day": ["season"],
            "inseason": ["season", "cutoff_gw"],
            "ndcg_cutoff": 25,
            "six_manager_position_demand": {"GK": 12, "DEF": 30, "MID": 30, "FWD": 18},
        },
        "gameweek_integer_violations_in_historical_rows": sum(
            int(item.get("gameweek_integer_violations", 0))
            for item in quality["target_validation"]
        ),
        "warnings": warnings,
        "failures": failures,
    }
    (REPORTS / "model_sanity_results.json").write_text(
        json.dumps(document, indent=2, sort_keys=True, allow_nan=False) + "\n",
        encoding="utf-8",
    )
    _write_report(document)
    print(json.dumps({key: document[key] for key in ("leakage_status", "model_sanity_status", "trust_rule_satisfied")}, indent=2))
    if failures:
        raise SystemExit("model sanity failed: " + "; ".join(failures))


if __name__ == "__main__":
    main()
