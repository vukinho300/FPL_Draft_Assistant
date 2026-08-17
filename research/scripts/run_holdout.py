from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd

from research.fpl_research.features import columns_for_groups
from research.fpl_research.metrics import evaluate_predictions, six_manager_metrics
from research.fpl_research.models import fit_predict
from research.scripts.run_development_benchmark import HOLDOUT_CAPABLE_FULL, FPL_CORE, load_dataset, predict_position_specific, result_row


def read_frozen_config(path: Path) -> dict[str, object]:
    document = json.loads(path.read_text(encoding="utf-8"))
    expected = document.pop("config_sha256")
    actual = hashlib.sha256(json.dumps(document, sort_keys=True).encode()).hexdigest()
    if expected != actual or document.get("status") != "SELECTED BEFORE HOLDOUT":
        raise ValueError("holdout candidate config is not a valid frozen pre-holdout document")
    document["config_sha256"] = expected
    return document


def load_all(processed: Path, task: str, horizon: int) -> pd.DataFrame:
    if task == "draft_day":
        paths = sorted(processed.glob("draft_day_*.pkl"))
    else:
        paths = sorted(processed.glob(f"inseason_h{horizon}_*.pkl"))
    return pd.concat([pd.read_pickle(path) for path in paths], ignore_index=True)


def predict_with_handling(train, test, model, numeric, categorical, handling):
    if handling == "position_specific":
        return predict_position_specific(train, test, model, numeric, categorical)
    return fit_predict(train, test, model, numeric, categorical)[0]


def main() -> None:
    config_path = Path("research/configs/final_holdout_candidate.json")
    config = read_frozen_config(config_path)
    processed = Path("research/data/processed")
    reports = Path("research/reports")
    selected_rows = []
    retrospective_rows = []
    position_rows = []
    six_rows = []
    cold_rows = []

    for key, task_config in config["tasks"].items():
        task = task_config["task"]
        horizon = int(task_config["prediction_horizon"])
        data = load_all(processed, task, horizon)
        holdout = data.loc[data["season"] == "2025-26"]
        train = data.loc[data["season"] != "2025-26"]
        train_seasons = tuple(sorted(train["season"].unique()))
        draft = task == "draft_day"
        categorical = ["position", "cold_start_category"] if draft else ["position"]
        groups = tuple(task_config["feature_groups"])
        numeric = columns_for_groups(groups, draft)
        selected_prediction = predict_with_handling(
            train,
            holdout,
            task_config["model"],
            numeric,
            categorical,
            task_config["position_handling"],
        )
        selected = result_row(
            selected_prediction,
            task,
            horizon,
            train_seasons,
            "2025-26",
            key,
            task_config["model"],
            groups,
        )
        selected["position_handling"] = task_config["position_handling"]
        selected["evaluation_type"] = "SELECTED BEFORE HOLDOUT"
        selected["config_sha256"] = config["config_sha256"]
        selected_rows.append(selected)

        ranking_groups = ["season"] if draft else ["season", "cutoff_gw"]
        for position, subset in selected_prediction.groupby("position"):
            position_rows.append(
                {
                    "task": task,
                    "prediction_horizon": horizon,
                    "test_season": "2025-26",
                    "position": position,
                    "model": task_config["model"],
                    "position_handling": task_config["position_handling"],
                    "sample_count": len(subset),
                    **evaluate_predictions(subset, ranking_groups),
                }
            )
        if draft:
            six = six_manager_metrics(selected_prediction)
            six["test_season"] = "2025-26"
            six["model"] = task_config["model"]
            six["position_handling"] = task_config["position_handling"]
            six_rows.extend(six.to_dict("records"))
            for category, subset in selected_prediction.groupby("cold_start_category"):
                cold_rows.append(
                    {
                        "test_season": "2025-26",
                        "cold_start_category": category,
                        "sample_count": len(subset),
                        **evaluate_predictions(subset, ["season"]),
                    }
                )

        retrospective_configs = {
            "FPL_ONLY_RIDGE_POSITION": (FPL_CORE, "ridge", "position_specific"),
            "FPL_ONLY_HGB_POSITION": (FPL_CORE, "hist_gradient_boosting_tuned", "position_specific"),
            "FPL_BOOKMAKER_RIDGE_POSITION": (HOLDOUT_CAPABLE_FULL, "ridge", "position_specific"),
            "FPL_BOOKMAKER_HGB_POSITION": (HOLDOUT_CAPABLE_FULL, "hist_gradient_boosting_tuned", "position_specific"),
        }
        for name, (alternative_groups, model_name, handling) in retrospective_configs.items():
            alternative_numeric = columns_for_groups(alternative_groups, draft)
            prediction = predict_with_handling(train, holdout, model_name, alternative_numeric, categorical, handling)
            row = result_row(
                prediction,
                task,
                horizon,
                train_seasons,
                "2025-26",
                name,
                model_name,
                alternative_groups,
            )
            row["position_handling"] = handling
            row["evaluation_type"] = "RETROSPECTIVE; NOT USED TO CHANGE WINNER"
            row["config_sha256"] = config["config_sha256"]
            retrospective_rows.append(row)

    evaluated_at = datetime.now(timezone.utc).isoformat()
    holdout = pd.DataFrame(selected_rows + retrospective_rows)
    holdout["evaluated_at"] = evaluated_at
    holdout.to_csv(reports / "holdout_results.csv", index=False)
    pd.DataFrame(position_rows).assign(evaluated_at=evaluated_at).to_csv(reports / "holdout_position_results.csv", index=False)
    pd.DataFrame(six_rows).assign(evaluated_at=evaluated_at).to_csv(reports / "holdout_six_manager_results.csv", index=False)
    pd.DataFrame(cold_rows).assign(evaluated_at=evaluated_at).to_csv(reports / "cold_start_results.csv", index=False)
    print(holdout.loc[holdout["evaluation_type"] == "SELECTED BEFORE HOLDOUT"].to_string(index=False))


if __name__ == "__main__":
    main()
