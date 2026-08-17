from __future__ import annotations

import math
from collections.abc import Iterable

import numpy as np
import pandas as pd
from scipy.stats import spearmanr
from sklearn.metrics import mean_absolute_error, mean_squared_error, ndcg_score


def top_k_metrics(actual: Iterable[float], predicted: Iterable[float], k: int) -> tuple[float, float]:
    actual_values = np.asarray(list(actual), dtype=float)
    predicted_values = np.asarray(list(predicted), dtype=float)
    if actual_values.shape != predicted_values.shape or actual_values.ndim != 1:
        raise ValueError("actual and predicted must be same-length one-dimensional arrays")
    effective_k = min(k, len(actual_values))
    if effective_k == 0:
        return math.nan, math.nan
    actual_top = set(np.argsort(-actual_values, kind="stable")[:effective_k])
    predicted_top = set(np.argsort(-predicted_values, kind="stable")[:effective_k])
    overlap = len(actual_top & predicted_top)
    return overlap / len(actual_top), overlap / len(predicted_top)


def ranking_metrics(actual: Iterable[float], predicted: Iterable[float], ks: tuple[int, ...] = (10, 25, 50)) -> dict[str, float]:
    y_true = np.asarray(list(actual), dtype=float)
    y_pred = np.asarray(list(predicted), dtype=float)
    if len(y_true) == 0:
        raise ValueError("cannot score an empty ranking")
    correlation = spearmanr(y_true, y_pred).statistic
    result: dict[str, float] = {"spearman": 0.0 if np.isnan(correlation) else float(correlation)}
    relevance = np.maximum(y_true, 0.0)
    for k in ks:
        effective_k = min(k, len(y_true))
        result[f"ndcg_at_{k}"] = float(ndcg_score(relevance.reshape(1, -1), y_pred.reshape(1, -1), k=effective_k))
        recall, precision = top_k_metrics(y_true, y_pred, k)
        result[f"recall_at_{k}"] = recall
        result[f"precision_at_{k}"] = precision
    return result


def evaluate_predictions(frame: pd.DataFrame, group_columns: list[str]) -> dict[str, float]:
    if not {"target", "prediction"}.issubset(frame.columns):
        raise ValueError("prediction evaluation requires target and prediction columns")
    overall = {
        "mae": float(mean_absolute_error(frame["target"], frame["prediction"])),
        "rmse": float(mean_squared_error(frame["target"], frame["prediction"]) ** 0.5),
    }
    rankings = [ranking_metrics(group["target"], group["prediction"]) for _, group in frame.groupby(group_columns, dropna=False)]
    for key in rankings[0]:
        overall[key] = float(np.mean([metrics[key] for metrics in rankings]))
    return overall


SIX_MANAGER_DEMAND = {"GK": 12, "DEF": 30, "MID": 30, "FWD": 18}


def six_manager_metrics(frame: pd.DataFrame) -> pd.DataFrame:
    rows = []
    for position, demand in SIX_MANAGER_DEMAND.items():
        subset = frame.loc[frame["position"] == position]
        if subset.empty:
            continue
        recall, precision = top_k_metrics(subset["target"], subset["prediction"], demand)
        ranking = ranking_metrics(subset["target"], subset["prediction"], (demand,))
        rows.append(
            {
                "position": position,
                "draft_pool_size": demand,
                "recall": recall,
                "precision": precision,
                "ndcg": ranking[f"ndcg_at_{demand}"],
                "spearman": ranking["spearman"],
                "eligible_players": len(subset),
            }
        )
    return pd.DataFrame(rows)
