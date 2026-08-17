from pathlib import Path

import pandas as pd
import pytest

from research.fpl_research.elo import join_elo_asof
from research.fpl_research.odds import normalized_implied_probabilities, prepare_team_match_history, team_features_before
from research.fpl_research.provenance import collection_sha256, sha256_file


def test_bookmaker_probabilities_remove_overround():
    probabilities = normalized_implied_probabilities([2.0, 4.0, 4.0])
    assert probabilities.tolist() == pytest.approx([0.5, 0.25, 0.25])
    assert probabilities.sum() == pytest.approx(1.0)


def test_bookmaker_probabilities_reject_invalid_odds():
    with pytest.raises(ValueError):
        normalized_implied_probabilities([1.0, 3.0, 4.0])


def test_team_features_are_strictly_before_cutoff():
    matches = pd.DataFrame(
        {
            "Date": ["01/01/2024", "10/01/2024"],
            "HomeTeam": ["Arsenal", "Arsenal"],
            "AwayTeam": ["Chelsea", "Chelsea"],
            "FTHG": [2, 0],
            "FTAG": [0, 5],
            "HS": [10, 1],
            "AS": [2, 20],
            "AvgH": [2.0, 10.0],
            "AvgD": [4.0, 5.0],
            "AvgA": [4.0, 1.5],
        }
    )
    history = prepare_team_match_history(matches)
    features = team_features_before(history, "Arsenal", pd.Timestamp("2024-01-10", tz="UTC"))
    assert features["team_context_matches"] == 1
    assert features["team_goal_difference"] == 2


def test_elo_asof_never_joins_future_rating():
    rows = pd.DataFrame({"team": ["Arsenal", "Arsenal"], "cutoff_time": ["2024-01-05", "2024-01-20"]})
    ratings = pd.DataFrame(
        {"team": ["Arsenal", "Arsenal"], "rating_date": ["2024-01-01", "2024-01-10"], "elo": [1700, 1710]}
    )
    result = join_elo_asof(rows, ratings)
    assert result["elo"].tolist() == [1700, 1710]
    assert (result["rating_date"] <= result["cutoff_time"]).all()


def test_manifest_checksum_utilities_are_deterministic(tmp_path: Path):
    first = tmp_path / "a.txt"
    second = tmp_path / "b.txt"
    first.write_text("alpha", encoding="utf-8")
    second.write_text("beta", encoding="utf-8")
    assert sha256_file(first) == sha256_file(first)
    assert collection_sha256([second, first], tmp_path) == collection_sha256([first, second], tmp_path)
