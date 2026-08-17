import numpy as np
import pandas as pd

from research.fpl_research.data import HistoricalRepository
from research.fpl_research.features import (
    _understat_before,
    build_draft_day_dataset,
    build_inseason_dataset,
    columns_for_groups,
    ensure_numeric,
)


class FakeRepository:
    def __init__(self, seasons):
        self.seasons = seasons

    def gameweeks(self, season):
        return self.seasons[season]["games"].copy()

    def gw1(self, season):
        return self.seasons[season]["gw1"].copy()

    def odds(self, season):
        return self.seasons[season]["odds"].copy()

    def understat(self, season):
        return self.seasons[season].get("understat", pd.DataFrame()).copy(), pd.DataFrame()


def games(season_start: str, points: list[int], code: int = 1, position: str = "MID"):
    rows = []
    for gw, points_value in enumerate(points, 1):
        rows.append(
            {
                "code": code,
                "element": code,
                "GW": gw,
                "name": "Test Player",
                "team": "Arsenal",
                "position": position,
                "kickoff_time": pd.Timestamp(season_start, tz="UTC") + pd.Timedelta(days=7 * gw),
                "total_points": points_value,
                "minutes": 90,
                "starts": 1,
                "goals_scored": 0,
                "assists": 0,
                "clean_sheets": 0,
                "bonus": 0,
                "bps": 10,
                "saves": 0,
                "yellow_cards": 0,
                "red_cards": 0,
                "expected_goals": 0.1,
                "expected_assists": 0.2,
                "expected_goal_involvements": 0.3,
                "expected_goals_conceded": 1.0,
                "influence": 1.0,
                "creativity": 2.0,
                "threat": 3.0,
                "ict_index": 0.6,
            }
        )
    return pd.DataFrame(rows)


def odds():
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


def test_inseason_features_stop_at_cutoff_and_target_starts_after_it():
    frame = games("2024-08-01", [1, 2, 3, 4, 5, 99])
    repository = FakeRepository({"2024-25": {"games": frame, "odds": odds()}})
    result, _ = build_inseason_dataset(repository, "2024-25", 1, minimum_cutoff_gw=5, include_understat=False)
    cutoff = result.loc[result["cutoff_gw"] == 5].iloc[0]
    assert cutoff["season_points_to_date"] == 15
    assert cutoff["last3_points"] == 12
    assert cutoff["target"] == 99


def test_horizon_boundaries_sum_only_next_1_3_5_gameweeks():
    frame = games("2024-08-01", list(range(1, 11)))
    repository = FakeRepository({"2024-25": {"games": frame, "odds": odds()}})
    expected = {1: 6, 3: 6 + 7 + 8, 5: 6 + 7 + 8 + 9 + 10}
    for horizon, target in expected.items():
        result, _ = build_inseason_dataset(repository, "2024-25", horizon, minimum_cutoff_gw=5, include_understat=False)
        assert result.loc[result["cutoff_gw"] == 5, "target"].iloc[0] == target


def test_rolling_windows_include_cutoff_and_exclude_next_gameweek_exactly():
    frame = games("2024-08-01", [1, 2, 3, 4, 5, 999])
    repository = FakeRepository({"2024-25": {"games": frame, "odds": odds()}})
    result, _ = build_inseason_dataset(repository, "2024-25", 1, minimum_cutoff_gw=5, include_understat=False)
    row = result.loc[result["cutoff_gw"] == 5].iloc[0]
    assert row["last3_points"] == 3 + 4 + 5
    assert row["last5_points"] == 1 + 2 + 3 + 4 + 5
    assert row["season_points_to_date"] == 1 + 2 + 3 + 4 + 5
    assert row["target"] == 999


def test_rescheduled_future_label_at_or_before_cutoff_is_not_a_future_target():
    frame = games("2024-08-01", [1, 2, 3, 4, 5, 999])
    frame.loc[frame["GW"] == 5, "kickoff_time"] = pd.Timestamp("2025-01-01", tz="UTC")
    repository = FakeRepository({"2024-25": {"games": frame, "odds": odds()}})
    result, _ = build_inseason_dataset(repository, "2024-25", 1, minimum_cutoff_gw=5, include_understat=False)
    row = result.loc[result["cutoff_gw"] == 5].iloc[0]
    assert row["target"] == 0
    assert bool(row["target_has_observations"]) is False
    assert row["target_start_timestamp"] > row["prediction_cutoff"]


def test_draft_day_uses_prior_season_and_flags_cold_start():
    prior = games("2023-08-01", [2] * 10)
    current = games("2024-08-01", [10] * 10)
    current_gw1 = current.loc[current["GW"] == 1].copy()
    current_gw1["total_points"] = 9999
    newcomer = current_gw1.copy()
    newcomer["code"] = 2
    newcomer["element"] = 2
    newcomer["name"] = "New Player"
    current_gw1 = pd.concat([current_gw1, newcomer], ignore_index=True)
    repository = FakeRepository(
        {
            "2023-24": {"games": prior, "gw1": prior.loc[prior["GW"] == 1], "odds": odds()},
            "2024-25": {"games": current, "gw1": current_gw1, "odds": odds()},
        }
    )
    result, _ = build_draft_day_dataset(repository, "2024-25", "2023-24", include_understat=False)
    returning = result.loc[result["code"] == 1].iloc[0]
    cold = result.loc[result["code"] == 2].iloc[0]
    assert returning["season_points_prior"] == 20
    assert returning["target"] == 100
    assert returning["season_points_prior"] != 9999
    assert cold["history_missing"] == 1
    assert cold["cold_start_category"] == "UNKNOWN"
    assert returning["feature_max_timestamp"] <= returning["prediction_cutoff"]
    assert returning["target_start_timestamp"] > returning["prediction_cutoff"]
    assert returning["sample_key"] == "2024-25|1"


def test_low_minutes_are_shrunk_and_marked():
    prior = games("2023-08-01", [20])
    prior["minutes"] = 5
    current = games("2024-08-01", [1])
    repository = FakeRepository(
        {
            "2023-24": {"games": prior, "gw1": prior, "odds": odds()},
            "2024-25": {"games": current, "gw1": current, "odds": odds()},
        }
    )
    result, _ = build_draft_day_dataset(repository, "2024-25", "2023-24", include_understat=False)
    assert result["low_minutes"].iloc[0] == 1
    assert np.isfinite(result["points_per90_shrunk"].iloc[0])
    assert result["points_per90_shrunk"].iloc[0] < 360


def test_feature_group_selection_is_explicit_and_unique():
    columns = columns_for_groups(["FPL_BASE", "FORM"])
    assert "season_points_to_date" in columns
    assert "last3_points" in columns
    assert len(columns) == len(set(columns))


def test_historical_repository_parses_gameweek_and_stable_identity(tmp_path):
    season_root = tmp_path / "vaastav" / "data" / "2024-25"
    (season_root / "gws").mkdir(parents=True)
    pd.DataFrame({"id": [7], "code": [700]}).to_csv(season_root / "players_raw.csv", index=False)
    pd.DataFrame(
        {
                "element": [7],
                "fixture": [1],
            "GW": [1],
            "kickoff_time": ["2024-08-17T14:00:00Z"],
            "team": ["Arsenal"],
            "position": ["MID"],
        }
    ).to_csv(season_root / "gws" / "merged_gw.csv", index=False)
    parsed = HistoricalRepository(tmp_path).gameweeks("2024-25")
    assert parsed["code"].tolist() == [700]
    assert str(parsed["kickoff_time"].dtype) == "datetime64[ns, UTC]"


def test_understat_filter_excludes_matches_after_cutoff():
    data = pd.DataFrame(
        {
            "code": [1, 1],
            "date": pd.to_datetime(["2024-01-01", "2024-02-01"], utc=True),
            "xG": [1.0, 99.0],
            "xA": [0.0, 0.0],
            "npxG": [1.0, 99.0],
            "shots": [1, 99],
            "key_passes": [0, 0],
            "xGChain": [1.0, 99.0],
            "xGBuildup": [0.0, 0.0],
        }
    )
    result = _understat_before(data, pd.Timestamp("2024-01-15", tz="UTC"), pd.Series([1]))
    assert result["understat_xg"].iloc[0] == 1.0


def test_missing_source_fields_remain_missing_not_zero():
    result = ensure_numeric(pd.DataFrame({"total_points": [2]}), ["total_points", "expected_goals"])
    assert np.isnan(result["expected_goals"].iloc[0])
