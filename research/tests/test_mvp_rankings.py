from __future__ import annotations

import numpy as np
import pandas as pd

from research.fpl_research.features import build_draft_day_dataset, columns_for_groups
from research.fpl_research.mvp_rankings import (
    MVP_FEATURE_GROUPS,
    build_current_feature_rows,
    match_current_players,
    model_gate_satisfied,
    parse_current_bootstrap,
)


class FeatureRepository:
    def __init__(self, seasons: dict[str, pd.DataFrame]):
        self.seasons = seasons

    def gameweeks(self, season: str) -> pd.DataFrame:
        return self.seasons[season].copy()

    def gw1(self, season: str) -> pd.DataFrame:
        return self.seasons[season].loc[self.seasons[season]["GW"] == 1].copy()

    def odds(self, season: str) -> pd.DataFrame:
        return pd.DataFrame(
            columns=[
                "match_date",
                "team",
                "market_win_probability",
                "goals_for",
                "goals_against",
                "shots_for",
                "shots_against",
                "shot_difference",
                "goal_difference",
            ]
        )

    def understat(self, season: str) -> tuple[pd.DataFrame, pd.DataFrame]:
        return pd.DataFrame(), pd.DataFrame()


def feature_season(season_start: str, rates: dict[str, float]) -> pd.DataFrame:
    rows = []
    for code, (position, rate) in enumerate(rates.items(), 1):
        for gw in range(1, 11):
            rows.append(
                {
                    "code": code,
                    "element": code,
                    "GW": gw,
                    "name": f"{position} Player",
                    "team": f"Team {position}",
                    "position": position,
                    "kickoff_time": pd.Timestamp(season_start, tz="UTC") + pd.Timedelta(days=7 * gw),
                    "total_points": rate,
                    "minutes": 90,
                    "starts": 1,
                    "goals_scored": rate / 10,
                    "assists": rate / 20,
                    "clean_sheets": rate / 30,
                    "bonus": rate / 40,
                    "bps": rate * 2,
                    "saves": rate / 50,
                    "yellow_cards": 0,
                    "red_cards": 0,
                    "expected_goals": rate / 100,
                    "expected_assists": rate / 110,
                    "expected_goal_involvements": rate / 120,
                    "expected_goals_conceded": rate / 130,
                    "influence": rate / 140,
                    "creativity": rate / 150,
                    "threat": rate / 160,
                    "ict_index": rate / 170,
                }
            )
    return pd.DataFrame(rows)


def metrics(ndcg: float, spearman: float) -> dict[str, float]:
    return {"ndcg_at_25": ndcg, "spearman": spearman}


def test_model_gate_requires_signal_and_baseline_competitiveness() -> None:
    passing = [
        {"metrics": metrics(0.72, 0.51), "baselines": {"simple": metrics(0.76, 0.5)}},
        {"metrics": metrics(0.75, 0.55), "baselines": {"simple": metrics(0.77, 0.5)}},
    ]
    assert model_gate_satisfied(passing)
    failing = [*passing]
    failing[1] = {"metrics": metrics(0.59, 0.55), "baselines": {"simple": metrics(0.77, 0.5)}}
    assert not model_gate_satisfied(failing)


def test_current_identity_matching_is_exact_code_only() -> None:
    current = pd.DataFrame(
        [
            {"draftPlayerId": "1", "code": 101, "name": "Exact", "position": "MID"},
            {"draftPlayerId": "2", "code": 202, "name": "Same Name", "position": "FWD"},
            {"draftPlayerId": "3", "code": 303, "name": "Duplicate", "position": "DEF"},
        ]
    )
    historical = pd.DataFrame(
        [
            {"code": 101, "web_name": "Renamed"},
            {"code": 999, "web_name": "Same Name"},
            {"code": 303, "web_name": "Duplicate A"},
            {"code": 303, "web_name": "Duplicate B"},
        ]
    )
    matched, summary = match_current_players(current, historical)
    assert matched["identityStatus"].tolist() == ["EXACT", "UNMATCHED", "AMBIGUOUS"]
    assert summary.exact_historical_matches == 1
    assert summary.unmatched == 1
    assert summary.ambiguous == 1
    assert summary.conflicts == 0


def test_bootstrap_parser_uses_draft_id_and_stable_code_separately() -> None:
    frame = parse_current_bootstrap(
        {
            "element_types": [{"id": 3, "singular_name_short": "MID"}],
            "elements": [{"id": 7, "code": 7007, "web_name": "Player", "element_type": 3}],
        }
    )
    assert frame.loc[0, "draftPlayerId"] == "7"
    assert frame.loc[0, "code"] == 7007


def test_current_features_match_historical_draft_day_features_by_position() -> None:
    prior = feature_season("2024-08-01", {"GK": 1.0, "DEF": 2.0, "MID": 4.0, "FWD": 8.0})
    target = feature_season("2025-08-01", {"GK": 0.0, "DEF": 0.0, "MID": 0.0, "FWD": 0.0})
    repository = FeatureRepository({"2024-25": prior, "2025-26": target})
    historical, _ = build_draft_day_dataset(
        repository, "2025-26", "2024-25", include_understat=False
    )
    matched = historical[["code", "name", "position"]].copy()
    matched["draftPlayerId"] = matched["code"].astype(str)
    matched["identityStatus"] = "EXACT"
    current = build_current_feature_rows(repository, matched, "2024-25", "2025-26")

    shared_features = columns_for_groups(MVP_FEATURE_GROUPS, draft_day=True)
    historical_values = historical.sort_values("code")[shared_features].reset_index(drop=True)
    current_values = current.sort_values("code")[shared_features].reset_index(drop=True)
    np.testing.assert_allclose(
        current_values.to_numpy(dtype=float),
        historical_values.to_numpy(dtype=float),
        equal_nan=True,
    )
    assert current.sort_values("code")["points_per90_shrunk"].tolist() == [1.0, 2.0, 4.0, 8.0]
