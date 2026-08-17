from __future__ import annotations

from collections.abc import Iterable
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import pandas as pd

from research.fpl_research.data import HistoricalRepository
from research.fpl_research.features import aggregate_stats, columns_for_groups
from research.fpl_research.metrics import evaluate_predictions
from research.fpl_research.model_safety import (
    audit_train_test_split,
    make_model_input_manifest,
    validate_temporal_contract,
)
from research.fpl_research.models import fit_predict


MVP_MODEL = "ridge"
MVP_ALPHA = 10.0
MVP_FEATURE_GROUPS = ("FPL_BASE", "FPL_EXPECTED", "FPL_ICT")
MVP_CATEGORICAL_FEATURES = ("cold_start_category",)
MVP_DEVELOPMENT_FOLDS = (
    (("2021-22", "2022-23"), "2023-24"),
    (("2021-22", "2022-23", "2023-24"), "2024-25"),
)
MVP_TRAINING_SEASONS = ("2021-22", "2022-23", "2023-24", "2024-25", "2025-26")


@dataclass(frozen=True)
class IdentityMatchSummary:
    current_player_count: int
    exact_historical_matches: int
    unmatched: int
    ambiguous: int
    conflicts: int


def load_draft_datasets(processed_root: Path, seasons: Iterable[str]) -> pd.DataFrame:
    frames = []
    for season in seasons:
        path = processed_root / f"draft_day_{season}.pkl"
        if not path.exists():
            raise FileNotFoundError(f"missing processed draft-day dataset: {path}")
        frames.append(pd.read_pickle(path))
    result = pd.concat(frames, ignore_index=True)
    validate_temporal_contract(result)
    return result


def _position_predictions(train: pd.DataFrame, test: pd.DataFrame) -> pd.DataFrame:
    numeric = columns_for_groups(MVP_FEATURE_GROUPS, draft_day=True)
    manifest = make_model_input_manifest(
        task="draft_day",
        horizon=38,
        model=MVP_MODEL,
        numeric_features=numeric,
        categorical_features=MVP_CATEGORICAL_FEATURES,
    )
    outputs = []
    for position in ("GK", "DEF", "MID", "FWD"):
        train_position = train.loc[train["position"] == position]
        test_position = test.loc[test["position"] == position]
        if test_position.empty:
            continue
        predicted, _ = fit_predict(
            train_position,
            test_position,
            MVP_MODEL,
            numeric,
            MVP_CATEGORICAL_FEATURES,
            manifest=manifest,
        )
        outputs.append(predicted)
    return pd.concat(outputs).sort_index()


def _draft_baselines(test: pd.DataFrame) -> dict[str, pd.Series]:
    previous = test["season_points_prior"].fillna(0.0)
    pp90_minutes = (
        test["points_per90_shrunk"].fillna(0.0)
        * test["season_minutes_prior"].fillna(0.0).clip(upper=3420)
        / 90.0
    )
    position_rank = previous.groupby(test["position"]).rank(method="average", pct=True)
    return {
        "previous_season_total": previous,
        "previous_season_pp90_minutes": pp90_minutes,
        "previous_position_rank": position_rank,
    }


def model_gate_satisfied(folds: list[dict[str, object]]) -> bool:
    if len(folds) != len(MVP_DEVELOPMENT_FOLDS):
        return False
    model_ndcg = [float(fold["metrics"]["ndcg_at_25"]) for fold in folds]  # type: ignore[index]
    model_spearman = [float(fold["metrics"]["spearman"]) for fold in folds]  # type: ignore[index]
    baseline_ndcg = [
        max(float(metrics["ndcg_at_25"]) for metrics in fold["baselines"].values())  # type: ignore[union-attr,index]
        for fold in folds
    ]
    return (
        all(value > 0.35 for value in model_spearman)
        and all(value > 0.60 for value in model_ndcg)
        and float(np.mean(model_ndcg)) >= float(np.mean(baseline_ndcg)) - 0.10
    )


def evaluate_mvp_model(data: pd.DataFrame) -> dict[str, object]:
    folds: list[dict[str, object]] = []
    for training_seasons, test_season in MVP_DEVELOPMENT_FOLDS:
        train = data.loc[data["season"].isin(training_seasons)]
        test = data.loc[data["season"] == test_season]
        split_audit = audit_train_test_split(train, test, "draft_day")
        predicted = _position_predictions(train, test)
        metrics = evaluate_predictions(predicted, ["season"])
        position_metrics = {
            str(position): evaluate_predictions(subset, ["season"])
            for position, subset in predicted.groupby("position")
        }
        baselines = {}
        for name, values in _draft_baselines(test).items():
            baseline = test.copy()
            baseline["prediction"] = values
            baselines[name] = evaluate_predictions(baseline, ["season"])
        folds.append(
            {
                "trainingSeasons": list(training_seasons),
                "testSeason": test_season,
                "trainingSamples": len(train),
                "testSamples": len(test),
                "splitAudit": split_audit,
                "metrics": metrics,
                "positionMetrics": position_metrics,
                "baselines": baselines,
            }
        )
    return {
        "model": "position-specific Ridge",
        "alpha": MVP_ALPHA,
        "featureGroups": list(MVP_FEATURE_GROUPS),
        "categoricalFeatures": list(MVP_CATEGORICAL_FEATURES),
        "developmentFolds": folds,
        "gateRule": {
            "minimumSpearmanPerFold": 0.35,
            "minimumNdcgAt25PerFold": 0.60,
            "meanNdcgToleranceFromBestSimpleBaseline": 0.10,
        },
        "modelSignalAvailable": model_gate_satisfied(folds),
    }


def parse_current_bootstrap(raw: object) -> pd.DataFrame:
    if not isinstance(raw, dict) or not isinstance(raw.get("elements"), list):
        raise ValueError("current Draft bootstrap lacks elements")
    raw_types = raw.get("element_types")
    if not isinstance(raw_types, list):
        raise ValueError("current Draft bootstrap lacks element_types")
    positions = {}
    for item in raw_types:
        if not isinstance(item, dict):
            raise ValueError("invalid current element type")
        short = item.get("singular_name_short")
        position = {"GKP": "GK", "GK": "GK", "DEF": "DEF", "MID": "MID", "FWD": "FWD"}.get(short)
        if not isinstance(item.get("id"), int) or position is None:
            raise ValueError("invalid current element type mapping")
        positions[item["id"]] = position

    rows = []
    for item in raw["elements"]:
        if not isinstance(item, dict):
            raise ValueError("invalid current player")
        draft_id = item.get("id")
        code = item.get("code")
        name = item.get("web_name")
        position = positions.get(item.get("element_type"))
        if not isinstance(draft_id, int) or draft_id <= 0:
            raise ValueError("current player has invalid Draft id")
        if not isinstance(code, int) or code <= 0:
            raise ValueError("current player has invalid stable FPL code")
        if not isinstance(name, str) or not name.strip() or position is None:
            raise ValueError("current player has invalid name or position")
        rows.append({"draftPlayerId": str(draft_id), "code": code, "name": name, "position": position})
    return pd.DataFrame(rows)


def match_current_players(current: pd.DataFrame, historical_players: pd.DataFrame) -> tuple[pd.DataFrame, IdentityMatchSummary]:
    current_counts = current["code"].value_counts(dropna=False)
    draft_id_counts = current["draftPlayerId"].value_counts(dropna=False)
    historical_counts = historical_players["code"].value_counts(dropna=False)
    historical_codes = set(historical_counts.index)
    rows = []
    ambiguous = 0
    conflicts = 0
    unmatched = 0
    exact = 0
    for row in current.itertuples(index=False):
        current_count = int(current_counts.get(row.code, 0))
        historical_count = int(historical_counts.get(row.code, 0))
        if current_count != 1 or int(draft_id_counts.get(row.draftPlayerId, 0)) != 1:
            status = "CONFLICT"
            conflicts += 1
        elif historical_count > 1:
            status = "AMBIGUOUS"
            ambiguous += 1
        elif row.code not in historical_codes:
            status = "UNMATCHED"
            unmatched += 1
        else:
            status = "EXACT"
            exact += 1
        rows.append({**row._asdict(), "identityStatus": status})
    matched = pd.DataFrame(rows)
    return matched, IdentityMatchSummary(len(current), exact, unmatched, ambiguous, conflicts)


def build_current_feature_rows(
    repository: HistoricalRepository,
    matched_current: pd.DataFrame,
    prior_season: str,
    target_season: str,
) -> pd.DataFrame:
    prior_games = repository.gameweeks(prior_season)
    prior_latest = prior_games.sort_values(["code", "GW", "kickoff_time"]).drop_duplicates("code", keep="last")
    prior = aggregate_stats(prior_games).merge(
        prior_latest[["code", "position"]], on="code", how="left", validate="one_to_one"
    )
    prior = prior.rename(
        columns={
            "total_points": "season_points_prior",
            "minutes": "season_minutes_prior",
            "starts": "season_starts_prior",
            "goals_scored": "season_goals_prior",
            "assists": "season_assists_prior",
            "clean_sheets": "season_clean_sheets_prior",
            "bonus": "season_bonus_prior",
            "bps": "season_bps_prior",
            "saves": "season_saves_prior",
            "expected_goals": "expected_goals_prior",
            "expected_assists": "expected_assists_prior",
            "expected_goal_involvements": "expected_goal_involvements_prior",
            "expected_goals_conceded": "expected_goals_conceded_prior",
            "influence": "influence_prior",
            "creativity": "creativity_prior",
            "threat": "threat_prior",
            "ict_index": "ict_index_prior",
        }
    )
    result = matched_current.merge(prior.drop(columns=["position"]), on="code", how="left", validate="many_to_one")
    result["history_missing"] = result["season_minutes_prior"].isna().astype(float)
    result["low_minutes"] = result["season_minutes_prior"].fillna(0).lt(450).astype(float)
    result["expected_fields_missing"] = result["expected_goal_involvements_prior"].isna().astype(float)
    result["ict_fields_missing"] = result["ict_index_prior"].isna().astype(float)

    rates = {}
    for position in ("GK", "DEF", "MID", "FWD"):
        subset = prior.loc[(prior["position"] == position) & (prior["minutes"] >= 450)] if "minutes" in prior else pd.DataFrame()
        if subset.empty:
            subset = prior.loc[prior["season_minutes_prior"] >= 450]
        rates[position] = (
            float((subset["season_points_prior"] * 90 / subset["season_minutes_prior"]).median())
            if not subset.empty
            else 3.0
        )
    minutes = result["season_minutes_prior"].fillna(0.0)
    points = result["season_points_prior"].fillna(0.0)
    position_prior = result["position"].map(rates).fillna(float(np.nanmedian(list(rates.values()))))
    result["points_per90_shrunk"] = (points + position_prior * 5.0) * 90.0 / (minutes + 450.0)
    result["cold_start_category"] = np.where(result["history_missing"].eq(0), "RETURNING EPL PLAYER", "UNKNOWN")
    result["season"] = target_season
    result["task"] = "draft_day"
    result["horizon"] = 38
    return result


def train_and_predict_current(training: pd.DataFrame, current: pd.DataFrame) -> pd.DataFrame:
    predictions = _position_predictions(training, current)
    ordered = predictions.sort_values(
        ["prediction", "name", "draftPlayerId"],
        ascending=[False, True, True],
        kind="stable",
    )
    predictions.loc[ordered.index, "modelRank"] = np.arange(1, len(ordered) + 1)
    for _, indexes in ordered.groupby("position", sort=True).groups.items():
        predictions.loc[indexes, "modelPositionRank"] = np.arange(1, len(indexes) + 1)
    predictions["modelRank"] = predictions["modelRank"].astype(int)
    predictions["modelPositionRank"] = predictions["modelPositionRank"].astype(int)
    return predictions
