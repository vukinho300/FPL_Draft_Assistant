from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.inspection import permutation_importance

from research.fpl_research import RANDOM_SEED
from research.fpl_research.features import columns_for_groups
from research.fpl_research.metrics import evaluate_predictions
from research.fpl_research.models import MODEL_CONFIGS, fit_predict
from research.fpl_research.quality import require_benchmarkable_quality_gate
from research.scripts.run_development_benchmark import folds_for, load_dataset, predict_position_specific, result_row


CANDIDATES = {
    ("draft_day", 38): ("FPL_BASE", "FPL_EXPECTED", "FPL_ICT", "TEAM_CONTEXT", "BOOKMAKER"),
    ("inseason", 1): ("FPL_BASE", "FPL_EXPECTED", "FPL_ICT", "FORM"),
    ("inseason", 3): ("FPL_BASE", "FPL_EXPECTED", "FPL_ICT", "FORM"),
    ("inseason", 5): ("FPL_BASE", "FPL_EXPECTED", "FPL_ICT", "FORM"),
}
MODEL_CANDIDATES = ("ridge", "hist_gradient_boosting_tuned")


def main() -> None:
    require_benchmarkable_quality_gate(
        Path("research/reports/data_quality_results.json"),
        ("Vaastav FPL", "Football-Data.co.uk"),
        manifest_path=Path("research/data/source_manifest.json"),
    )
    reports = Path("research/reports")
    config_path = Path("research/configs/final_holdout_candidate.json")
    rows: list[dict[str, object]] = []
    selected: dict[str, dict[str, object]] = {}
    importance_rows: list[dict[str, object]] = []

    for (task, horizon), groups in CANDIDATES.items():
        data = load_dataset(Path("research/data/processed"), task, horizon)
        draft = task == "draft_day"
        numeric = columns_for_groups(groups, draft)
        categorical = ["position", "cold_start_category"] if draft else ["position"]
        for model_name in MODEL_CANDIDATES:
            for handling in ("pooled", "position_specific"):
                for train_seasons, test_season in folds_for(task):
                    train = data.loc[data["season"].isin(train_seasons)]
                    test = data.loc[data["season"] == test_season]
                    if handling == "pooled":
                        prediction, _ = fit_predict(train, test, model_name, numeric, categorical)
                    else:
                        prediction = predict_position_specific(train, test, model_name, numeric, categorical)
                    row = result_row(
                        prediction,
                        task,
                        horizon,
                        train_seasons,
                        test_season,
                        "pre_holdout_candidate",
                        model_name,
                        groups,
                    )
                    row["training_sample_count"] = len(train)
                    row["position_handling"] = handling
                    rows.append(row)

        frame = pd.DataFrame(rows)
        relevant = frame.loc[(frame["task"] == task) & (frame["prediction_horizon"] == horizon)]
        summary = relevant.groupby(["model", "position_handling"])[["ndcg_at_25", "spearman", "rmse"]].mean().reset_index()
        winner = summary.sort_values(["ndcg_at_25", "spearman", "rmse"], ascending=[False, False, True]).iloc[0]
        key = "draft_day" if draft else f"inseason_h{horizon}"
        selected[key] = {
            "task": task,
            "target": "upcoming_season_total_points" if draft else f"next_{horizon}_gameweek_points",
            "prediction_horizon": horizon,
            "sources": ["Vaastav FPL"] + (["Football-Data.co.uk"] if "BOOKMAKER" in groups else []),
            "feature_groups": list(groups),
            "model": winner["model"],
            "hyperparameters": MODEL_CONFIGS[str(winner["model"])],
            "position_handling": winner["position_handling"],
            "development_mean_ndcg_at_25": float(winner["ndcg_at_25"]),
            "development_mean_spearman": float(winner["spearman"]),
            "development_mean_rmse": float(winner["rmse"]),
        }

        train = data.loc[data["season"].isin(folds_for(task)[-1][0])]
        test = data.loc[data["season"] == "2024-25"]
        model_name = str(winner["model"])
        handling = str(winner["position_handling"])
        positions = ("GK", "DEF", "MID", "FWD") if handling == "position_specific" else ("ALL",)
        for position in positions:
            train_part = train if position == "ALL" else train.loc[train["position"] == position]
            test_part = test if position == "ALL" else test.loc[test["position"] == position]
            prediction, model = fit_predict(train_part, test_part, model_name, numeric, categorical)
            sample = prediction.sample(min(2500, len(prediction)), random_state=RANDOM_SEED)
            permutation = permutation_importance(
                model,
                sample[numeric + categorical],
                sample["target"],
                scoring="neg_root_mean_squared_error",
                n_repeats=3,
                random_state=RANDOM_SEED,
                n_jobs=1,
            )
            for feature, mean, standard_deviation in zip(numeric + categorical, permutation.importances_mean, permutation.importances_std):
                importance_rows.append(
                    {
                        "task": task,
                        "prediction_horizon": horizon,
                        "test_season": "2024-25",
                        "position": position,
                        "feature": feature,
                        "permutation_importance_rmse": float(mean),
                        "permutation_importance_std": float(standard_deviation),
                        "sample_count": len(sample),
                    }
                )

    selection_frame = pd.DataFrame(rows)
    selection_frame.to_csv(reports / "candidate_selection_results.csv", index=False)
    pd.DataFrame(importance_rows).to_csv(reports / "feature_importance.csv", index=False)
    development_files = [
        reports / "source_combination_results.csv",
        reports / "model_results.csv",
        reports / "feature_family_results.csv",
        reports / "feature_ablation_results.csv",
        reports / "candidate_selection_results.csv",
    ]
    development_digest = hashlib.sha256()
    for path in development_files:
        development_digest.update(path.name.encode())
        development_digest.update(path.read_bytes())
    document: dict[str, object] = {
        "schema_version": 1,
        "status": "SELECTED BEFORE HOLDOUT",
        "selected_at": datetime.now(timezone.utc).isoformat(),
        "random_seed": RANDOM_SEED,
        "development_results_sha256": development_digest.hexdigest(),
        "development_evaluation_seasons": ["2023-24", "2024-25"],
        "locked_holdout_season": "2025-26",
        "training_window": "all compatible seasons through 2024-25; strictly earlier seasons for each development fold",
        "preprocessing": {
            "numeric_missing": "training-fold median plus missingness indicator",
            "categorical": "training-fold most-frequent imputation and one-hot encoding",
            "scaling": "standard scaling for Ridge only, fitted on training data",
            "player_identity": "FPL code; no fuzzy authoritative joins",
        },
        "excluded": [
            "xP",
            "current/final season values as earlier-cutoff features",
            "2025/26 defensive fields absent from development seasons",
            "Understat because equivalent 2025/26 coverage is absent",
            "ClubElo because clean endpoints were unavailable",
            "historical official FPL Draft rank because no reproducible archive was found",
        ],
        "tasks": selected,
    }
    encoded = json.dumps(document, sort_keys=True).encode()
    document["config_sha256"] = hashlib.sha256(encoded).hexdigest()
    config_path.parent.mkdir(parents=True, exist_ok=True)
    config_path.write_text(json.dumps(document, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(json.dumps(selected, indent=2))
    print(f"frozen pre-holdout config: {config_path}")


if __name__ == "__main__":
    main()
